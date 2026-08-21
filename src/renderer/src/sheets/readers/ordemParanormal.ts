import type {
  PdfField,
  PdfSheet,
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
  { name: 'PV', label: 'PV máximo', group: 'Recursos' },
  { name: 'pvat', label: 'PV atual', group: 'Recursos' },
  { name: 'PE', label: 'PE máximo', group: 'Recursos' },
  { name: 'peat', label: 'PE atual', group: 'Recursos' },
  { name: 'SAN', label: 'Sanidade máxima', group: 'Recursos' },
  { name: 'sanat', label: 'Sanidade atual', group: 'Recursos' },
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
    if (atributos >= 4) return 0.6
    return 0
  },

  extract: (sheet) => {
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
    const conhecidos = CAMPOS_CONHECIDOS.map(({ name, label, group, rotulo, roll }) => {
      const campo = acharCampo(name, rotulo)
      if (campo) consumidos.add(campo)
      // Mesma régua do genérico (`valorDeFicha`): descarta vazio, `Off` e o texto de instrução que
      // a ficha em branco traz DENTRO do campo ("Escolha uma Classe").
      const valor = valorDeFicha(campo?.value, campo?.type)
      return valor ? { label, value: valor, group, roll } : null
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
        !CAMPO_DE_BONUS.test(nome))
    const restantes = base.fields.filter((campo) => foraDaLista(campo.fieldName))

    /**
     * PERÍCIAS: importadas por `periciasTreinadas`, e o aviso que existia aqui saiu junto.
     *
     * Elas ficaram de fora numa primeira versão porque o nome de cada uma é texto impresso e o
     * vizinho mais próximo do campo é a abreviação do atributo. Com a ficha preenchida em mãos deu
     * pra MEDIR onde o nome fica e casar as 29 linhas — ver o comentário da função.
     */
    const pericias = periciasTreinadas(sheet)
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
      fields: [...conhecidos, ...(nex ? [nex] : []), ...pericias, ...restantes],
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
function periciasTreinadas(sheet: PdfSheet): SheetImportField[] {
  const campos: SheetImportField[] = []
  for (const campo of sheet.fields) {
    const posicao = CAMPO_DE_PERICIA.exec(campo.name)
    if (!posicao || Number(posicao[2]) !== COLUNA_DA_PERICIA) continue
    const valor = valorDeFicha(campo.value, campo.type)
    if (!valor || Number(valor) === 0) continue
    const nome = nomeDaPericia(sheet, campo)
    if (!nome) continue
    campos.push({ label: nome, value: valor, group: 'Perícias', fieldName: campo.name })
  }
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
