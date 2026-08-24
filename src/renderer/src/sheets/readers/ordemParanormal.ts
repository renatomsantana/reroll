import type {
  PdfField,
  PdfSheet,
  SheetImport,
  SheetImportField,
  SheetImportPreset
} from '@shared/types/sheetImport'
import type { DiceExpression } from '@shared/types/dice'
import { parseDiceExpression, parseTestBonus } from '@shared/dice/parseDiceExpression'
import { extrairGenerico, valorDeFicha } from './generic'
import { labelForField } from '../labelForField'
import type { SheetReader } from './types'

/**
 * Leitor da ficha oficial de ORDEM PARANORMAL (Jambô).
 *
 * O que ele sabe, e o genérico não tem como saber:
 *
 * - os ataques vivem numa GRADE de nome previsível, `Atq<bloco>.<i>.<j>.<linha>.<coluna>`, com as
 *   colunas 0..3 sendo nome, teste, dano e "crítico/alcance/especial". Isso foi lido do arquivo e
 *   conferido contra os rótulos impressos (a coluna 1 fica embaixo de "TESTE", a 2 de "DANO");
 * - a coluna TESTE traz só o BÔNUS ("+7"), porque o d20 é implícito no sistema. É exatamente o caso
 *   pra que `parseTestBonus` existe;
 * - os atributos têm nome curto e fixo (`AGI`, `FOR`, `INT`, `PRE`, `VIG`), e `Personagem`,
 *   `Jogador`, `Classe`, `Trilha`, `PV`, `PE`, `SAN` são nomes de campo estáveis.
 *
 * Por isso cada linha de ataque vira ATÉ DOIS presets — o teste de acerto e o dano —, que é o que o
 * usuário autorizou ("pode criar dois tipos de presets diferentes"). Um preset guarda uma expressão
 * só (ver `Preset`), então um ataque não cabe num preset só sem perder metade.
 */

/**
 * `Atq1.0.0.3.2` — os DOIS últimos números são linha e coluna, e tudo antes é o bloco.
 *
 * A leitura é feita partindo o nome nos pontos, e não por grupos de captura, porque a quantidade de
 * níveis varia (`Atq1.0.0.3.2` tem cinco, outras versões da ficha têm quatro). O que não varia é
 * que os dois últimos são a posição na grade.
 */
function posicaoNaGrade(name: string): { bloco: string; linha: number; coluna: number } | null {
  if (!name.startsWith('Atq')) return null
  const partes = name.split('.')
  if (partes.length < 3) return null
  const coluna = Number(partes[partes.length - 1])
  const linha = Number(partes[partes.length - 2])
  if (!Number.isInteger(linha) || !Number.isInteger(coluna)) return null
  return { bloco: partes.slice(0, -2).join('.'), linha, coluna }
}

/** Grade das perícias: `Pericias.<linha>.<coluna>`. A coluna 1 é o número treinado. */
const CAMPO_DE_PERICIA = /^Pericias\.(\d+)\.(\d+)$/
const COLUNA_DA_PERICIA = 1

/**
 * A outra grade da mesma tabela de perícias: `Bns1.<linha>`, a coluna de BÔNUS.
 *
 * Ela sai inteira, pelo mesmo motivo que a de perícias: sem o nome da perícia ao lado, um número
 * solto não é informação. E ela produzia uma linha com cara de verdadeira — a célula `Bns1.0` fica
 * embaixo do cabeçalho impresso "TREINO", então a importação da ficha do Matais trazia
 * "Treino = 0" como se fosse um atributo do personagem. Não é: é a primeira célula de uma tabela
 * vazia, rotulada com o título da coluna.
 */
const CAMPO_DE_BONUS = /^Bns\d*\./

/** As lacunas numeradas da ficha — `RITUAIS 1`…`20`, `ITEM 1`…`11` e a segunda página `ITEM 1_2`. */
const CAMPO_DE_RITUAL = /^RITUAIS \d+$/
const CAMPO_DE_ITEM = /^ITEM \d+(_2)?$/

/**
 * `NEXPE` — o menu que a ficha usa pro NEX. O valor dele traz DOIS números na mesma string, com um
 * punhado de espaços entre eles ("5         1"): o NEX em porcentagem e o limite de PE por turno,
 * que em Ordem Paranormal é derivado dele. É a diagramação do menu virando conteúdo.
 *
 * Sem tratamento a ficha importava um campo chamado "NEX" valendo "5 1", que não quer dizer nada em
 * lugar nenhum. O NEX é uma das primeiras coisas que se olha numa ficha de agente, então vale
 * escrever a regra.
 */
const CAMPO_DE_NEX = 'NEXPE'

/**
 * As cinco abreviações de atributo, como aparecem IMPRESSAS na grade de perícias.
 *
 * Elas precisam ficar de fora na hora de achar o nome da perícia, e esse é o detalhe todo: o texto
 * mais próximo de cada campo da grade é sempre "AGI", "PRE"… — nunca "ACROBACIA". Foi o que fez a
 * primeira leitura produzir quarenta linhas "PRE = 0" em vez do nome das perícias.
 */
const ABREVIACOES = new Set(['AGI', 'FOR', 'INT', 'PRE', 'VIG'])

const COLUNA_NOME = 0
const COLUNA_TESTE = 1
const COLUNA_DANO = 2

/**
 * Campos com nome estável, e o rótulo com que eles aparecem na conferência.
 *
 * O `rotulo` é o desempate, e ele existe por um fato MEDIDO no arquivo: os nomes de campo se
 * repetem. `INT` aparece 11 vezes, `PRE` 10, `AGI` 8, `FOR` 3, `VIG` 2, e até `Personagem` 2 — o
 * primeiro é o atributo de verdade e os outros são a coluna de atributo de cada PERÍCIA, que a ficha
 * batizou com o mesmo nome.
 *
 * Isso passou despercebido enquanto eu só tinha a ficha em branco (todos valiam "0", então tanto
 * fazia qual fosse lido) e apareceu no primeiro teste com valores: os cinco atributos SUMIRAM da
 * importação, porque o índice por nome ficava com a última ocorrência, que é sempre uma perícia.
 *
 * O que separa os dois é o rótulo IMPRESSO ao lado: o atributo tem a palavra inteira ("AGILIDADE"),
 * a coluna de perícia tem a abreviação ("AGI").
 */
/**
 * O `roll` é o que faz o número na ficha virar dado rolável (ver `sheetRoll.ts`), e aqui ele está só
 * nos ATRIBUTOS de propósito.
 *
 * Um teste de PERÍCIA em Ordem Paranormal é a soma de duas coisas — os dados do atributo mais o
 * bônus de treinamento —, e o campo da perícia guarda só o bônus. Rolar "1d20 + 5" ali seria uma
 * regra de outro sistema com cara de certa; rolar o atributo e somar de cabeça é o que o jogador já
 * faz na mesa. Os atributos, esses, são a regra inteira num número só: Agilidade 3 é "role 3d20 e
 * fique com o maior".
 */
const CAMPOS_CONHECIDOS: {
  name: string
  label: string
  group: string
  rotulo?: RegExp
  roll?: SheetImportField['roll']
  /**
   * Vem MESMO VAZIO — ver `ESQUELETO_DOS_RECURSOS`.
   *
   * Campo vazio normalmente é descartado (é o que impede uma ficha em branco de importar duzentas
   * linhas em branco), mas há um punhado deles que a ficha PRECISA ter mesmo sem valor: PV, PE e
   * Sanidade têm um par atual/máximo cada, e na ficha do Matias só os máximos estão preenchidos.
   * Trazer só metade do par deixa a ficha importada dizendo "PV máximo 45" sem lugar nenhum pra
   * anotar quanto ele tem AGORA — que é o número que muda toda sessão e o motivo de se olhar a
   * ficha. Foi o que o usuário reportou: "ficou faltando, coloca o máximo e atuais de tudo".
   */
  sempre?: boolean
}[] = [
  { name: 'Personagem', label: 'Personagem', group: 'Identificação', rotulo: /^PERSONAGEM/i },
  { name: 'Jogador', label: 'Jogador', group: 'Identificação' },
  { name: 'Classe', label: 'Classe', group: 'Identificação' },
  { name: 'Trilha', label: 'Trilha', group: 'Identificação' },
  { name: 'Origem', label: 'Origem', group: 'Identificação' },
  { name: 'AGI', label: 'Agilidade', group: 'Atributos', roll: 'pool-d20', rotulo: /^AGILIDADE/i },
  { name: 'FOR', label: 'Força', group: 'Atributos', roll: 'pool-d20', rotulo: /^FOR[ÇC]A/i },
  { name: 'INT', label: 'Intelecto', group: 'Atributos', roll: 'pool-d20', rotulo: /^INTELECTO/i },
  { name: 'PRE', label: 'Presença', group: 'Atributos', roll: 'pool-d20', rotulo: /^PRESEN[ÇC]A/i },
  { name: 'VIG', label: 'Vigor', group: 'Atributos', roll: 'pool-d20', rotulo: /^VIGOR/i },
  { name: 'pvat', label: 'PV atual', group: 'Recursos', sempre: true },
  { name: 'PV', label: 'PV máximo', group: 'Recursos', sempre: true },
  { name: 'peat', label: 'PE atual', group: 'Recursos', sempre: true },
  { name: 'PE', label: 'PE máximo', group: 'Recursos', sempre: true },
  { name: 'sanat', label: 'Sanidade atual', group: 'Recursos', sempre: true },
  { name: 'SAN', label: 'Sanidade máxima', group: 'Recursos', sempre: true },
  { name: 'Def', label: 'Defesa', group: 'Recursos' },
  { name: 'Desl', label: 'Deslocamento', group: 'Recursos' },
  { name: 'DT', label: 'DT de rituais', group: 'Recursos' },
  { name: 'Simples', label: 'Armas simples', group: 'Proficiências' },
  { name: 'Táticas', label: 'Armas táticas', group: 'Proficiências' }
]

/**
 * Campos que a ficha tem, mas que não são do PERSONAGEM.
 *
 * `DEZ` é o "10" impresso da fórmula da defesa — "DEFESA = 10 + AGI + Equip. + Outros". É um número
 * fixo do papel, e ele saía na importação como "AGI = 10", porque o texto impresso mais próximo dele
 * é o "AGI" da mesma fórmula. Duas mentiras numa linha só: nem o rótulo nem o valor são do agente,
 * que tem Agilidade 1 e Defesa 11 — as duas já importadas por `CAMPOS_CONHECIDOS`.
 */
const CAMPOS_IGNORADOS = new Set(['DEZ'])

/**
 * Os cinco atributos da FICHA DA COMUNIDADE — a marca que separa os dois modelos. Ver
 * `extrairFichaDaComunidade`, no fim do arquivo.
 */
const ATRIBUTOS_DA_COMUNIDADE = ['atr_agi', 'atr_for', 'atr_int', 'atr_pre', 'atr_vig']

export const ordemParanormalReader: SheetReader = {
  id: 'ordem-paranormal',
  label: 'Ordem Paranormal',

  /**
   * Reconhece pelos NOMES DE CAMPO, não pelo texto impresso.
   *
   * É a marca mais confiável que esta ficha tem: o texto pode mudar de edição, de idioma ou de
   * diagramação, e alguém pode escrever "Ordem Paranormal" à mão numa ficha de outro sistema. Já a
   * combinação `Atq...` + os cinco atributos abreviados é estrutura, e estrutura não se digita por
   * acidente.
   */
  detect: (sheet) => {
    if (sheet.fields.length === 0) return 0
    const nomes = new Set(sheet.fields.map((campo) => campo.name))
    const atributos = ['AGI', 'FOR', 'INT', 'PRE', 'VIG'].filter((nome) => nomes.has(nome)).length
    const temAtaques = sheet.fields.some((campo) => posicaoNaGrade(campo.name) !== null)
    if (atributos === 5 && temAtaques) return 0.95
    // A ficha DA COMUNIDADE (ver `extrairFichaDaComunidade`): outra estrutura, o mesmo sistema.
    const daComunidade = ATRIBUTOS_DA_COMUNIDADE.filter((nome) => nomes.has(nome)).length
    if (daComunidade === 5) return 0.95
    if (atributos >= 4 || daComunidade >= 4) return 0.6
    return 0
  },

  extract: (sheet) =>
    ATRIBUTOS_DA_COMUNIDADE.filter((nome) => sheet.fields.some((c) => c.name === nome)).length >= 4
      ? extrairFichaDaComunidade(sheet)
      : extrairFichaOficial(sheet)
}

function extrairFichaOficial(sheet: PdfSheet): SheetImport {
  {
    const base = extrairGenerico(sheet, 'ordem-paranormal', 'Ordem Paranormal', 0.95)

    /**
     * O campo certo entre os de mesmo nome (ver o comentário de `CAMPOS_CONHECIDOS`): com `rotulo`,
     * vence quem tem aquele texto impresso ao lado. Sem `rotulo`, ou se nenhum casar, fica o
     * PRIMEIRO — e primeiro, não último, porque nesta ficha o atributo vem antes das perícias.
     */
    function acharCampo(name: string, rotulo?: RegExp): PdfField | undefined {
      const candidatos = sheet.fields.filter((campo) => campo.name === name)
      if (candidatos.length <= 1 || !rotulo) return candidatos[0]
      const casando = candidatos.find((campo) => {
        const impresso = labelForField(sheet, campo)
        return impresso !== null && rotulo.test(impresso)
      })
      return casando ?? candidatos[0]
    }

    /** Os campos que ESTE leitor consumiu — o resto do genérico é filtrado por eles, sem casar texto. */
    const consumidos = new Set<PdfField>()

    /**
     * Os campos conhecidos entram NA FRENTE e agrupados, substituindo o que o genérico tinha achado
     * por proximidade pros mesmos nomes. O genérico acerta o rótulo na maioria deles, mas erra em
     * alguns por diagramação — `peat` sai como "DE ESFORÇO" e `Origem` como "o", porque o rótulo
     * impresso mais próximo é um pedaço de outra frase.
     */
    /**
     * A ficha é DE ALGUÉM, ou é o modelo em branco baixado do site?
     *
     * O nome do personagem é o corte: ninguém preenche o nome de uma ficha que não vai usar, e a
     * ficha em branco de Ordem Paranormal vem com 76 campos já preenchidos de fábrica (zeros,
     * "Escolha uma Classe", defesa 10) mas nunca com nome. É o que decide se os pares atual/máximo
     * entram vazios: numa ficha de verdade eles são espaço pra anotar, num modelo em branco seriam
     * seis linhas vazias a mais na tela de quem só quer ver o que o arquivo tinha.
     */
    const temDono = Boolean(valorDeFicha(acharCampo('Personagem', /^PERSONAGEM/i)?.value))

    const conhecidos = CAMPOS_CONHECIDOS.map(({ name, label, group, rotulo, roll, sempre }) => {
      const campo = acharCampo(name, rotulo)
      if (campo) consumidos.add(campo)
      // Mesma régua do genérico (`valorDeFicha`): descarta vazio, `Off` e o texto de instrução que
      // a ficha em branco traz DENTRO do campo ("Escolha uma Classe").
      const valor = valorDeFicha(campo?.value, campo?.type)
      if (valor) return { label, value: valor, group, roll }
      // O par atual/máximo vem inteiro mesmo com metade em branco — ver `sempre`. Só quando a ficha
      // é DE ALGUÉM: num modelo em branco (nenhum campo preenchido) isso encheria a tela de vazios.
      return sempre && temDono ? { label, value: '', group, roll } : null
    }).filter((campo): campo is NonNullable<typeof campo> => campo !== null)

    /**
     * As OUTRAS ocorrências dos nomes repetidos são as colunas de atributo das perícias. Saem junto
     * com a grade de perícias, pelo mesmo motivo: sem o nome da perícia ao lado, "AGI = 3" repetido
     * oito vezes não é informação, é ruído.
     */
    const nomesRepetidos = new Set(CAMPOS_CONHECIDOS.filter((c) => c.rotulo).map((c) => c.name))

    /**
     * O que o genérico achou e este leitor NÃO tratou. O corte é pelo nome do campo do PDF
     * (`fieldName`), que é exato — casar por valor juntaria dois atributos que valem "2".
     *
     * Os campos da grade de ataque também saem: eles viraram PRESETS, e repetir "1d12+2" como
     * anotação seria dizer duas vezes a mesma coisa.
     */
    const jaTratados = new Set(CAMPOS_CONHECIDOS.map((campo) => campo.name))
    const foraDaLista = (nome: string | undefined): boolean =>
      nome === undefined ||
      (!jaTratados.has(nome) &&
        !nomesRepetidos.has(nome) &&
        !CAMPOS_IGNORADOS.has(nome) &&
        nome !== CAMPO_DE_NEX &&
        posicaoNaGrade(nome) === null &&
        !CAMPO_DE_PERICIA.test(nome) &&
        !CAMPO_DE_BONUS.test(nome) &&
        /**
         * As lacunas numeradas são de `lacunasNumeradas`, e SÓ dela. Sem esta linha um ritual
         * preenchido entrava duas vezes: como "RITUAIS 1" pelo genérico e como "Ritual 1" pela
         * lacuna — achado da revisão de código, e coberto pelo teste do ritual preenchido.
         */
        !CAMPO_DE_RITUAL.test(nome) &&
        !CAMPO_DE_ITEM.test(nome))
    const restantes = base.fields.filter((campo) => foraDaLista(campo.fieldName))

    /**
     * PERÍCIAS: importadas por `periciasTreinadas`, e o aviso que existia aqui saiu junto.
     *
     * Elas ficaram de fora numa primeira versão porque o nome de cada uma é texto impresso e o
     * vizinho mais próximo do campo é a abreviação do atributo. Com a ficha preenchida em mãos deu
     * pra MEDIR onde o nome fica e casar as 29 linhas — ver o comentário da função.
     */
    const pericias = periciasTreinadas(sheet, temDono)
    const lacunas = temDono ? lacunasNumeradas(sheet) : []
    const nex = campoDeNex(acharCampo(CAMPO_DE_NEX))
    const avisos = [...base.warnings]

    const presets = presetsDeAtaques(sheet.fields)

    /**
     * O aviso do "maior dado" saiu daqui quando o preset passou a CARREGAR a regra (ver
     * `comRegraDoMaior`). Ele existia pra pedir que a pessoa fizesse de cabeça a conta que o app
     * fazia errado; agora o app faz certo, e um aviso sobre isso só assustaria à toa.
     */
    const testeComVariosDados = presets.some((preset) => preset.expression.keep !== undefined)
    if (testeComVariosDados) avisos.push('ordem-maior-dado')
    const personagem = valorDeFicha(acharCampo('Personagem', /^PERSONAGEM/i)?.value)

    return {
      ...base,
      characterName: personagem || base.characterName,
      system: 'Ordem Paranormal',
      warnings: avisos,
      fields: [...conhecidos, ...(nex ? [nex] : []), ...pericias, ...restantes, ...lacunas],
      /**
       * Os presets dos ATAQUES entram na frente e os do genérico continuam atrás: aqueles são
       * dirigidos (sei que aquela coluna é dano), estes são o que sobrou de varrer a ficha atrás de
       * notação de dado, e podem pescar um ritual ou uma anotação de margem que vale como rolagem.
       */
      /**
       * Os presets dos ATAQUES entram na frente, e os do genérico só entram se vierem de FORA da
       * grade. Sem esse corte, cada célula de dano virava preset duas vezes: uma como
       * "Pistola .38 (dano)", dirigida, e outra como "DANO", que é o rótulo impresso da coluna.
       */
      presets: [...presets, ...base.presets.filter((preset) => foraDaLista(preset.fieldName))]
    }
  }
}

/**
 * A regra de TESTE de Ordem Paranormal: role N dados e use o MAIOR.
 *
 * A coluna TESTE da ficha traz quantos dados se rola — "2d20" quer dizer dois d20, dos quais vale o
 * melhor, e não a soma dos dois. Somar dá em média 21 onde a regra dá 13,8. Enquanto o app não sabia
 * fazer isso, o importador criava o preset somando e avisava a pessoa pra fazer a conta de cabeça
 * olhando a bandeja; agora a regra vai gravada no preset (ver `KeepRule`).
 *
 * Um dado só não ganha regra nenhuma: não há o que escolher, e uma regra ali só encheria o rótulo.
 *
 * O que NÃO dá pra deduzir da ficha é o atributo ZERO, que em Ordem rola 2d20 e fica com o PIOR. Ele
 * se escreve na coluna exatamente igual a um atributo 2, e a ficha não diz qual atributo cada ataque
 * usa. Fica no caso comum — o maior — e quem tiver um atributo zero troca no editor de presets, que
 * é uma escolha de dois cliques contra um palpite que erraria calado.
 */
function comRegraDoMaior(expressao: DiceExpression): DiceExpression {
  const dados = expressao.groups.reduce((soma, grupo) => soma + grupo.count, 0)
  if (dados < 2) return expressao
  return { ...expressao, keep: { mode: 'highest', count: 1 } }
}

/**
 * Percorre a grade de ataques e monta os presets.
 *
 * Uma linha só vira preset se tiver NOME — linha em branco no meio da grade é normal (a ficha traz
 * seis por bloco e ninguém preenche todas), e importar "linha 4" sem nome seria criar preset
 * fantasma. Já teste e dano são opcionais entre si: arma sem dano fixo ainda tem teste de acerto.
 */
function presetsDeAtaques(fields: PdfField[]): SheetImportPreset[] {
  const linhas = new Map<string, Map<number, string>>()

  for (const campo of fields) {
    const posicao = posicaoNaGrade(campo.name)
    if (!posicao) continue
    // A chave leva o BLOCO junto: a ficha tem mais de uma grade de ataques, as duas numeram as
    // linhas a partir de zero, e sem o bloco a segunda sobrescreveria a primeira.
    const chave = `${posicao.bloco}|${posicao.linha}`
    const atual = linhas.get(chave) ?? new Map<number, string>()
    atual.set(posicao.coluna, campo.value.trim())
    linhas.set(chave, atual)
  }

  const presets: SheetImportPreset[] = []
  for (const colunas of linhas.values()) {
    const nome = colunas.get(COLUNA_NOME)?.trim()
    if (!nome) continue

    const teste = colunas.get(COLUNA_TESTE)?.trim() ?? ''
    const dano = colunas.get(COLUNA_DANO)?.trim() ?? ''

    /**
     * A coluna TESTE aceita as duas escritas que aparecem em ficha de verdade: o bônus solto
     * ("+7"), que é o normal, e a expressão inteira ("1d20+7"), que aparece em quem prefere deixar
     * explícito. Tentar a expressão primeiro importa: `parseTestBonus` recusaria "1d20+7" e a
     * rolagem se perderia.
     */
    const expressaoTeste = parseDiceExpression(teste)?.expression ?? parseTestBonus(teste)
    if (expressaoTeste) {
      presets.push({
        name: `${nome} (teste)`,
        kind: 'test',
        expression: comRegraDoMaior(expressaoTeste),
        source: teste
      })
    }

    const expressaoDano = parseDiceExpression(dano)
    if (expressaoDano) {
      presets.push({
        name: `${nome} (dano)`,
        kind: 'damage',
        expression: expressaoDano.expression,
        source: dano
      })
    }
  }
  return presets
}

/**
 * O NEX, legível. Ver `CAMPO_DE_NEX` sobre por que o valor vem com dois números grudados.
 *
 * Só reescreve quando reconhece a forma exata "número espaços número"; qualquer outra coisa vai como
 * está. Uma ficha de outra versão pode guardar só a porcentagem ali, e inventar "PE por turno" em
 * cima de um valor que não tem esse número seria pior que mostrar o texto cru.
 */
function campoDeNex(campo: PdfField | undefined): SheetImportField | null {
  const valor = valorDeFicha(campo?.value, campo?.type)
  if (!valor) return null
  const partes = /^(\d{1,3})\s+(\d{1,3})$/.exec(valor)
  // Curto porque o campo é estreito: "5% (1 PE por turno)" não cabia na caixa e aparecia cortado
  // no meio de uma palavra, que é pior que abreviar.
  const texto = partes ? `${partes[1]}% · ${partes[2]} PE/turno` : valor
  return { label: 'NEX', value: texto, group: 'Identificação', fieldName: CAMPO_DE_NEX }
}

/**
 * As perícias TREINADAS, lidas da grade `Pericias.<linha>.<coluna>`.
 *
 * O nome da perícia não é campo: é parte do desenho da ficha. Ele sai então do TEXTO IMPRESSO na
 * mesma linha do campo, à esquerda, pulando a abreviação do atributo. Foi medido no arquivo real:
 * o nome fica numa coluna fixa (x≈349), a abreviação em outra (x≈447) e o campo em x≈476 — pegar o
 * vizinho mais próximo QUE NÃO SEJA abreviação acerta as 29 linhas. Outros textos da página caem na
 * mesma altura ("ATRIBUTOS", "ORIGEM", "FICHA DE AGENTE"), mas todos bem mais à esquerda, e por isso
 * "o mais próximo" já resolve sem precisar fixar uma faixa de x — que quebraria em outra diagramação.
 *
 * Só entram as perícias com número DIFERENTE DE ZERO. A ficha tem 29 linhas e quem não treinou nada
 * fica com 29 zeros; importar isso repetiria exatamente o que o usuário já apontou uma vez ("fica
 * uma bagunça, não dá para entender"). Zero aqui não é informação, é a ausência dela.
 */
function periciasTreinadas(sheet: PdfSheet, comLacunas: boolean): SheetImportField[] {
  const campos: SheetImportField[] = []
  for (const campo of sheet.fields) {
    const posicao = CAMPO_DE_PERICIA.exec(campo.name)
    if (!posicao || Number(posicao[2]) !== COLUNA_DA_PERICIA) continue
    const valor = valorDeFicha(campo.value, campo.type)
    const treinada = valor && Number(valor) !== 0
    /**
     * SEM `comLacunas`, só as treinadas entram — é o que uma ficha "de leitura" quer.
     *
     * COM ele, as 29 entram, inclusive zeradas: pedido do usuário, e a razão é de mesa — perícia
     * que não estava treinada passa a estar no meio da sessão, e sem a linha não há onde escrever.
     * O zero fica de fora do valor de propósito: linha vazia é lacuna pra preencher, e "0" escrito
     * é afirmação de que a perícia foi conferida.
     */
    if (!treinada && !comLacunas) continue
    const nome = nomeDaPericia(sheet, campo)
    if (!nome) continue
    campos.push({
      label: nome,
      value: treinada ? valor : '',
      group: 'Perícias',
      fieldName: campo.name
    })
  }
  return campos
}

/**
 * As LACUNAS numeradas da ficha — rituais, itens e ataques.
 *
 * Elas existem no arquivo como campos vazios (`RITUAIS 1`… `RITUAIS 20`, `ITEM 1`… `ITEM 11` e a
 * segunda página deles, e a grade de ataques), e a importação as descartava por estarem em branco.
 * O pedido do usuário: "coloca lacunas para TUDO que é preenchível, porque às vezes precisamos
 * preencher no app também mesmo que não tenha, porque é um item novo na sessão".
 *
 * O que NÃO entra, e é escolha: os 38 campos sem nome do PDF (`1_2`, `2_2`…), as trinta caixas de
 * marcação e os círculos de nível de ritual. Lacuna sem nome não é lugar pra escrever — é linha em
 * branco com um número do lado, e trinta delas fariam a ficha parecer defeito em vez de espaço.
 */
function lacunasNumeradas(sheet: PdfSheet): SheetImportField[] {
  const campos: SheetImportField[] = []

  const numero = (nome: string): number => Number(nome.replace(/\D+/g, '') || 0)
  const porNome = (padrao: RegExp): PdfField[] =>
    sheet.fields.filter((c) => padrao.test(c.name)).sort((a, b) => numero(a.name) - numero(b.name))

  for (const campo of porNome(CAMPO_DE_RITUAL)) {
    campos.push({
      label: `Ritual ${numero(campo.name)}`,
      value: valorDeFicha(campo.value, campo.type) ?? '',
      group: 'Rituais',
      fieldName: campo.name
    })
  }

  /**
   * Os itens vêm em duas páginas com a mesma numeração (`ITEM 1` e `ITEM 1_2`), então a segunda
   * continua a contagem da primeira em vez de repetir "Item 1" duas vezes na ficha.
   */
  const primeiraPagina = porNome(/^ITEM \d+$/)
  const segundaPagina = porNome(/^ITEM \d+_2$/)
  ;[...primeiraPagina, ...segundaPagina].forEach((campo, i) => {
    campos.push({
      label: `Item ${i + 1}`,
      value: valorDeFicha(campo.value, campo.type) ?? '',
      group: 'Itens',
      fieldName: campo.name
    })
  })

  return campos
}

/** O nome impresso da perícia de uma linha da grade. Ver `periciasTreinadas` pra régua e medidas. */
function nomeDaPericia(sheet: PdfSheet, campo: PdfField): string | null {
  const meioY = (campo.rect[1] + campo.rect[3]) / 2
  let melhor: { distancia: number; texto: string } | null = null
  for (const item of sheet.texts) {
    if (item.page !== campo.page) continue
    const texto = item.text.trim()
    if (texto.length < 3 || ABREVIACOES.has(texto)) continue
    if (Math.abs(item.y + item.height / 2 - meioY) > 6) continue
    const distancia = campo.rect[0] - (item.x + item.width)
    if (distancia < 0 || distancia > 200) continue
    if (!melhor || distancia < melhor.distancia) melhor = { distancia, texto }
  }
  return melhor ? apresentarPericia(melhor.texto) : null
}

/**
 * O nome impresso, arrumado pra virar rótulo de ficha.
 *
 * Três coisas saem, e as três foram vistas no arquivo real:
 *
 * - a LACUNA de preencher à mão, em "PROFISSÃO* (__________)". É espaço em branco do papel, não
 *   nome de perícia — e a ficha tem duas linhas assim;
 * - o ASTERISCO, que marca perícia que exige treinamento. É regra do sistema, não do personagem;
 * - o CAIXA-ALTA. A ficha imprime tudo em maiúscula porque é diagramação; ao lado de "Agilidade" e
 *   "PV máximo", um "SOBREVIVÊNCIA" gritando destoaria do resto da tela.
 *
 * O caixa-baixa é o do português (`pt-BR`), senão "SOBREVIVÊNCIA" perde o acento no caminho.
 */
function apresentarPericia(bruto: string): string | null {
  const limpo = bruto
    .replace(/\(\s*_+\s*\)/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limpo) return null
  const minusculo = limpo.toLocaleLowerCase('pt-BR')
  return minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1)
}

// ---------------------------------------------------------------------------------------------
// A FICHA DA COMUNIDADE
// ---------------------------------------------------------------------------------------------

/**
 * O SEGUNDO modelo de ficha que Ordem Paranormal tem na prática: a editável da comunidade, que
 * chegou aqui na ficha real do Vincenzo. Outra estrutura, o mesmo sistema:
 *
 * - os atributos são `atr_agi`…`atr_vig` (minúsculos, com prefixo), não `AGI`…`VIG`;
 * - cada perícia tem TRÊS campos: `t_<perícia>` (treinamento), `o_<perícia>` (outros) e
 *   `b_<perícia>` (o bônus TOTAL, calculado por JavaScript dentro do PDF). Como na família
 *   "Editável com Cálculos" de Pathfinder, o total calculado só fica gravado quando alguém tocou o
 *   campo — vazio, ele se refaz da soma dos componentes. CONFERIDO na ficha real três vezes:
 *   atletismo 10+2=12, medicina 10+5=15, diplomacia 10+0=10;
 * - a grade de armas é `atq_name<i>` / `dano_arma<i>` / `critico_arma<i>` / `alcance_arma<i>`,
 *   seis linhas, SEM coluna de teste (o teste é a perícia de Pontaria/Luta);
 * - Classe, Origem e Trilha são LISTAS que exportam índice ("2") — o rótulo legível vem das opções
 *   do próprio campo, que a varredura traduz (ver `rotuloDaOpcao` em `sheetFromPdfDocument.ts`);
 * - `ITEM 1`…`ITEM 11` e a segunda página `_2` têm OS MESMOS nomes da ficha oficial — as lacunas
 *   numeradas (`lacunasNumeradas`) servem às duas sem mudar nada.
 */
const ATRIBUTOS_B: { name: string; label: string }[] = [
  { name: 'atr_agi', label: 'Agilidade' },
  { name: 'atr_for', label: 'Força' },
  { name: 'atr_int', label: 'Intelecto' },
  { name: 'atr_pre', label: 'Presença' },
  { name: 'atr_vig', label: 'Vigor' }
]

/** As 28 perícias do modelo, na grafia dos nomes de campo (sem acento) → o rótulo de gente. */
const PERICIAS_DA_COMUNIDADE: { slug: string; label: string }[] = [
  { slug: 'acrobacia', label: 'Acrobacia' },
  { slug: 'adestramento', label: 'Adestramento' },
  { slug: 'artes', label: 'Artes' },
  { slug: 'atletismo', label: 'Atletismo' },
  { slug: 'atualidades', label: 'Atualidades' },
  { slug: 'ciencias', label: 'Ciências' },
  { slug: 'crime', label: 'Crime' },
  { slug: 'diplomacia', label: 'Diplomacia' },
  { slug: 'enganacao', label: 'Enganação' },
  { slug: 'fortitude', label: 'Fortitude' },
  { slug: 'furtividade', label: 'Furtividade' },
  { slug: 'iniciativa', label: 'Iniciativa' },
  { slug: 'intimidacao', label: 'Intimidação' },
  { slug: 'intuicao', label: 'Intuição' },
  { slug: 'investigacao', label: 'Investigação' },
  { slug: 'luta', label: 'Luta' },
  { slug: 'medicina', label: 'Medicina' },
  { slug: 'ocultismo', label: 'Ocultismo' },
  { slug: 'percepcao', label: 'Percepção' },
  { slug: 'pilotagem', label: 'Pilotagem' },
  { slug: 'pontaria', label: 'Pontaria' },
  { slug: 'profissao', label: 'Profissão' },
  { slug: 'reflexos', label: 'Reflexos' },
  { slug: 'religiao', label: 'Religião' },
  { slug: 'sobrevivencia', label: 'Sobrevivência' },
  { slug: 'tatica', label: 'Tática' },
  { slug: 'tecnologia', label: 'Tecnologia' },
  { slug: 'vontade', label: 'Vontade' }
]

const RESISTENCIAS_B: { name: string; label: string }[] = [
  { name: 'corte', label: 'Corte' },
  { name: 'perfuracao', label: 'Perfuração' },
  { name: 'impacto', label: 'Impacto' },
  { name: 'balistica', label: 'Balística' },
  { name: 'mental', label: 'Mental' },
  { name: 'conhecimento', label: 'Conhecimento' },
  { name: 'energia', label: 'Energia' },
  { name: 'sangue', label: 'Sangue' },
  { name: 'morte', label: 'Morte' }
]

/** A grade de habilidades e rituais: `HABILIDADES  RITUAIS 1.<linha>.<coluna>` (dois espaços). */
const GRADE_DE_HABILIDADES = /^HABILIDADES\s+RITUAIS\s+1\.(\d+)\.(\d+)$/

/** O que ESTE modelo consome — o resto do genérico passa, sem rótulo roubado de vizinho. */
const CONSUMIDOS_B: RegExp[] = [
  /^atr_/,
  /^[tbo]_[a-z]+$/,
  /^(atq_name|dano_arma|critico_arma|alcance_arma|espaco_arma)\d+$/,
  /^(pv|pe|san|def|dt_ritual)_?[a-z]*$/,
  /^(PV|PE|San)$/,
  /^(defesa|esquiva|deslocamento|NivelExposicao|patente|mod_extra|pontos_prestigio)$/,
  /^(origem|classe|trilha\d)$/,
  /^protecaolistbox1$/,
  /^carga_(max|atual)$/,
  /^categoria_\d+$/,
  /^Categoria \d+$/,
  /^Espaços \d+(_2)?$/,
  /^limite_\d$/,
  /^Habilidade_\d$/,
  /^Pagina_Hab_\d$/,
  /^HABILIDADES\s+RITUAIS /,
  /^Custo /,
  /^Página /,
  /^LIMITE DE$/,
  /^Nome( do Personagem)?$/,
  /^(corte|perfuracao|impacto|balistica|mental|conhecimento|energia|sangue|morte)$/
]

function extrairFichaDaComunidade(sheet: PdfSheet): SheetImport {
  const base = extrairGenerico(sheet, 'ordem-paranormal', 'Ordem Paranormal', 0.95)

  const porNome = new Map<string, PdfField>()
  for (const campo of sheet.fields) if (!porNome.has(campo.name)) porNome.set(campo.name, campo)
  const bruto = (nome: string): string | null => {
    const campo = porNome.get(nome)
    return campo ? valorDeFicha(campo.value, campo.type) : null
  }
  const inteiro = (texto: string | null): number | null => {
    if (texto === null) return null
    const limpo = texto.replace(/\s+/g, '')
    return /^[+-]?\d+$/.test(limpo) ? Number(limpo) : null
  }

  const personagem = bruto('Nome do Personagem') ?? ''
  const temDono = personagem !== ''

  const campos: SheetImportField[] = []
  /** Empurra com valor; ou vazio, quando é lacuna (`sempre`) numa ficha com dono. */
  const push = (
    label: string,
    valor: string | null,
    group: string,
    roll?: SheetImportField['roll'],
    sempre = false,
    fieldName?: string
  ): void => {
    if (valor) campos.push({ label, value: valor, group, roll, fieldName })
    else if (sempre && temDono) campos.push({ label, value: '', group, roll, fieldName })
  }

  // Identificação — Classe/Origem/Trilha chegam já traduzidas de índice pra rótulo pela varredura.
  push('Personagem', personagem || null, 'Identificação', undefined, true, 'Nome do Personagem')
  push('Jogador', bruto('Nome'), 'Identificação', undefined, false, 'Nome')
  const nex = inteiro(bruto('NivelExposicao'))
  push('NEX', nex === null ? bruto('NivelExposicao') : `${nex}%`, 'Identificação', undefined, true, 'NivelExposicao')
  push('Classe', bruto('classe'), 'Identificação', undefined, true, 'classe')
  push('Origem', bruto('origem'), 'Identificação', undefined, true, 'origem')
  const trilha = bruto('trilha1') ?? bruto('trilha2') ?? bruto('trilha3')
  push('Trilha', trilha, 'Identificação')
  push('Patente', bruto('patente'), 'Identificação')

  for (const atributo of ATRIBUTOS_B) {
    push(atributo.label, bruto(atributo.name), 'Atributos', 'pool-d20', true, atributo.name)
  }

  // Recursos: os pares atual/máximo vêm inteiros numa ficha com dono, como no modelo oficial.
  push('PV atual', bruto('pv_atual'), 'Recursos', undefined, true, 'pv_atual')
  push('PV máximo', bruto('PV'), 'Recursos', undefined, true, 'PV')
  push('PE atual', bruto('pe_atual'), 'Recursos', undefined, true, 'pe_atual')
  push('PE máximo', bruto('PE'), 'Recursos', undefined, true, 'PE')
  push('Sanidade atual', bruto('san_atual'), 'Recursos', undefined, true, 'san_atual')
  push('Sanidade máxima', bruto('San'), 'Recursos', undefined, true, 'San')
  push('PE por rodada', bruto('pe_rodada'), 'Recursos', undefined, true, 'pe_rodada')
  push('Defesa', bruto('defesa'), 'Recursos', undefined, true, 'defesa')
  push('Esquiva', bruto('esquiva'), 'Recursos')
  push('Proteção', bruto('protecaolistbox1'), 'Recursos')
  push('Deslocamento', bruto('deslocamento'), 'Recursos')
  push('DT de rituais', bruto('dt_ritual'), 'Recursos')
  const cargaAtual = bruto('carga_atual')
  const cargaMax = bruto('carga_max')
  push('Carga', cargaAtual && cargaMax ? `${cargaAtual}/${cargaMax}` : (cargaAtual ?? cargaMax), 'Recursos')
  push('Pontos de prestígio', bruto('pontos_prestigio'), 'Recursos')

  /**
   * O bônus da perícia: o total calculado (`b_`) ou, com ele vazio, treinamento + outros — a mesma
   * conta que o JavaScript do PDF faria. Zero entra como lacuna ('' com dono), igual ao modelo
   * oficial: linha vazia é espaço pra preencher, "0" escrito seria afirmação.
   */
  for (const pericia of PERICIAS_DA_COMUNIDADE) {
    const total =
      inteiro(bruto(`b_${pericia.slug}`)) ??
      (bruto(`t_${pericia.slug}`) !== null || bruto(`o_${pericia.slug}`) !== null
        ? (inteiro(bruto(`t_${pericia.slug}`)) ?? 0) + (inteiro(bruto(`o_${pericia.slug}`)) ?? 0)
        : null)
    push(pericia.label, total ? String(total) : null, 'Perícias', undefined, true, `b_${pericia.slug}`)
  }

  // Ataques: seis linhas; o dano vira preset e a linha vira resumo, como no leitor de Pathfinder.
  const presets: SheetImportPreset[] = []
  for (let i = 0; i <= 5; i++) {
    const nomeDaArma = bruto(`atq_name${i}`)
    if (!nomeDaArma) continue
    const dano = bruto(`dano_arma${i}`) ?? ''
    const critico = bruto(`critico_arma${i}`)
    const alcance = bruto(`alcance_arma${i}`)
    const resumo = [dano, critico && `crítico ${critico}`, alcance && `alcance ${alcance}`]
      .filter(Boolean)
      .join(' · ')
    campos.push({ label: nomeDaArma, value: resumo, group: 'Ataques', fieldName: `atq_name${i}` })
    const expressao = parseDiceExpression(dano)
    if (expressao) {
      presets.push({ name: `${nomeDaArma} (dano)`, kind: 'damage', expression: expressao.expression, source: dano })
    }
  }

  for (let i = 1; i <= 6; i++) {
    push(`Habilidade ${i}`, bruto(`Habilidade_${i}`), 'Habilidades', undefined, false, `Habilidade_${i}`)
  }

  /**
   * A grade de habilidades e rituais: a coluna 0 é o nome, a 1 o detalhe, e `Custo`/`Página` da
   * mesma linha completam. "Velocità Mortale · custo 3PE · pág. 150" numa linha só.
   */
  const linhasDaGrade = new Map<number, Map<number, string>>()
  for (const campo of sheet.fields) {
    const posicao = GRADE_DE_HABILIDADES.exec(campo.name)
    if (!posicao) continue
    const valor = valorDeFicha(campo.value, campo.type)
    if (!valor) continue
    const linha = Number(posicao[1])
    const colunas = linhasDaGrade.get(linha) ?? new Map<number, string>()
    colunas.set(Number(posicao[2]), valor)
    linhasDaGrade.set(linha, colunas)
  }
  for (const [linha, colunas] of [...linhasDaGrade].sort((a, b) => a[0] - b[0])) {
    const titulo = colunas.get(0)
    if (!titulo) continue
    const custo = bruto(`Custo 1.${linha}.0`)
    const pagina = bruto(`Página 1.${linha}.0`)
    const detalhe = [colunas.get(1), custo && custo !== '-' && `custo ${custo}`, pagina && `pág. ${pagina}`]
      .filter(Boolean)
      .join(' · ')
    campos.push({ label: titulo, value: detalhe, group: 'Habilidades e rituais' })
  }

  for (const resistencia of RESISTENCIAS_B) {
    const valor = inteiro(bruto(resistencia.name))
    if (valor !== null && valor !== 0) {
      campos.push({ label: resistencia.label, value: String(valor), group: 'Resistências', fieldName: resistencia.name })
    }
  }

  const lacunas = temDono ? lacunasNumeradas(sheet) : []

  const consumido = (nome: string | undefined): boolean =>
    nome !== undefined &&
    (CONSUMIDOS_B.some((padrao) => padrao.test(nome)) || CAMPO_DE_ITEM.test(nome))
  const restantes = base.fields.filter((campo) => !consumido(campo.fieldName))

  return {
    ...base,
    characterName: personagem || base.characterName,
    system: 'Ordem Paranormal',
    warnings: base.warnings,
    fields: [...campos, ...lacunas, ...restantes],
    presets: [...presets, ...base.presets.filter((preset) => !consumido(preset.fieldName))]
  }
}
