import type { PdfField, PdfSheet, SheetImport, SheetImportField, SheetImportPreset } from '@shared/types/sheetImport'
import type { SheetRollKind } from '@shared/types/sheetRoll'
import { parseDiceExpression, parseTestBonus } from '@shared/dice/parseDiceExpression'
import { lerCamposDoTexto } from '../camposDoTexto'
import { ehTituloDeFicha } from '../anotacoesSobreImagem'
import { nomeDeCampoDecodificado } from '../labelForField'
import { extrairGenerico, presetsSemRepetidos, valorDeFicha } from './generic'
import type { SheetReader } from './types'

/**
 * Leitor de TORMENTA20 — o sistema brasileiro mais jogado, e o que mais chega em ficha de formato
 * variado: a editável da Jambô, as caseiras feitas no Word ou no Google Docs, as de comunidade com
 * cálculo automático. Não existe UM modelo, e este leitor foi escrito sem nenhuma ficha real na mão
 * (as duas de teste, `23-tormenta20-formulario-em-portugues` e `46-tormenta20-modelo-em-branco`, são
 * fabricadas). Por isso ele é diferente dos de Ordem, D&D e Pathfinder, que casam NOME DE CAMPO
 * exato: aqui o que se casa é o VOCABULÁRIO do sistema, seja ele nome de campo ou rótulo impresso,
 * com ou sem acento, em maiúsculas ou não. Uma ficha de T20 que o app nunca viu ainda cai no lugar
 * certo se chamar as coisas do jeito que o livro chama.
 *
 * O que só quem conhece o sistema sabe, e é o que este leitor acrescenta ao genérico:
 *
 * - os seis atributos são os de D&D em português, e a ROLAGEM depende da edição: no livro de 2019 o
 *   atributo é um VALOR (Força 14, modificador +2), na edição Jogo do Ano é só o MODIFICADOR (Força
 *   +2). A mesma ficha nunca mistura os dois, então a decisão é por ficha, olhando os seis juntos
 *   (`estiloDosAtributos`);
 * - PV e PM são os recursos que se gastam, e viram barra. Entram com nome canônico ("PV atual",
 *   "PM máximo") porque a barra é montada pelo nome (ver `extrairRecursos`), e "PONTOS DE VIDA
 *   TOTAL" não vira barra sozinho;
 * - as 29 perícias (com Iniciativa entre elas, que em T20 é perícia) rolam d20 + o número;
 * - a grade de ataques (Arma, Teste, Dano, Crítico) vira uma linha por arma e dois presets — o
 *   teste e o dano —, tanto quando vem em colunas numeradas quanto quando alguém escreve tudo numa
 *   célula só ("Adaga +5 1d4+2").
 *
 * Como nos outros leitores brasileiros, o rótulo que vai pra tela é o que está IMPRESSO na ficha —
 * "FORÇA" fica "FORÇA" — porque a pessoa lê a tela com o papel do lado. A exceção são os recursos,
 * pelo motivo acima. E como em Ordem e Pathfinder, ficha COM DONO traz o esqueleto de lacunas (cada
 * atributo, recurso e perícia, mesmo vazio); o modelo em branco não traz nada além do que está nele.
 */

const GRUPOS = {
  identificacao: 'Identificação',
  atributos: 'Atributos',
  recursos: 'Recursos',
  pericias: 'Perícias',
  combate: 'Combate',
  ataques: 'Ataques',
  magia: 'Magia',
  habilidades: 'Habilidades',
  inventario: 'Inventário',
  aparencia: 'Aparência',
  historia: 'História'
}

/**
 * A chave de comparação de um rótulo ou nome de campo: sem acento, minúsculas, sem os dois-pontos
 * do fim e com um espaço só entre palavras. É o que faz "CONSTITUIÇÃO", "Constituicao:" e
 * `constituição` serem a mesma coisa — e é a razão de este leitor servir pra ficha que ninguém
 * mediu.
 */
function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:*]+\s*$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Atributo {
  id: string
  nome: string
  padrao: RegExp
}

const ATRIBUTOS: Atributo[] = [
  { id: 'for', nome: 'Força', padrao: /^(for|forca)$/ },
  { id: 'des', nome: 'Destreza', padrao: /^(des|destreza)$/ },
  { id: 'con', nome: 'Constituição', padrao: /^(con|constituicao)$/ },
  { id: 'int', nome: 'Inteligência', padrao: /^(int|inteligencia)$/ },
  { id: 'sab', nome: 'Sabedoria', padrao: /^(sab|sabedoria)$/ },
  { id: 'car', nome: 'Carisma', padrao: /^(car|carisma)$/ }
]

/**
 * As perícias de Tormenta20 (edição Jogo do Ano; as do livro de 2019 são as mesmas). Iniciativa
 * está aqui porque em T20 ela É perícia — rola d20 + o número, como as outras.
 */
const PERICIAS = [
  'Acrobacia', 'Adestramento', 'Atletismo', 'Atuação', 'Cavalgar', 'Conhecimento', 'Cura',
  'Diplomacia', 'Enganação', 'Fortitude', 'Furtividade', 'Guerra', 'Iniciativa', 'Intimidação',
  'Intuição', 'Investigação', 'Jogatina', 'Ladinagem', 'Luta', 'Misticismo', 'Nobreza', 'Ofício',
  'Percepção', 'Pilotagem', 'Pontaria', 'Reflexos', 'Religião', 'Sobrevivência', 'Vontade'
]

/** Perícia por chave: "oficio" → "Ofício". "Ofício (Alquimia)" e "Conhecimento 2" também casam. */
const PERICIA_POR_CHAVE = new Map(PERICIAS.map((nome) => [chave(nome), nome]))
function pericia(k: string): string | null {
  const raiz = /^([a-z]+)(?:\s*[(\d].*)?$/.exec(k)?.[1] ?? k
  return PERICIA_POR_CHAVE.get(raiz) ?? null
}

/**
 * Recurso: PV ou PM, com o LADO que o rótulo diz. "PV", "Pontos de Vida", "PV atual", "PV total",
 * "PM máx." — todas as formas que ficha de T20 usa, inclusive as que escrevem "Vida"/"Mana" por
 * extenso. Devolve o nome canônico que `extrairRecursos` reconhece.
 */
const RECURSO = /^(?:(pv|pontos? de vida|vida)|(pm|pontos? de mana|mana))(?:\s+(atual|atuais|total|totais|max|maximo|maximos|maxima))?$/
function recurso(k: string): { label: string; id: string } | null {
  const achado = RECURSO.exec(k)
  if (!achado) return null
  const base = achado[1] ? 'PV' : 'PM'
  const lado = achado[3]
  if (!lado) return { label: base, id: base.toLowerCase() }
  if (/^atua/.test(lado)) return { label: `${base} atual`, id: `${base.toLowerCase()}-atual` }
  return { label: `${base} máximo`, id: `${base.toLowerCase()}-maximo` }
}

/**
 * MARCAS FORTES: palavras que, entre os sistemas que o app conhece e os que passaram pelo corpus
 * de teste, só Tormenta20 usa como rótulo de ficha. Não entram aqui as que outro sistema também
 * tem: "Adestramento" e "Origem" estão em Ordem Paranormal; "Ladinagem", "Reflexos" e "Vontade"
 * na tradução de Pathfinder; os seis atributos em toda ficha d20 em português.
 */
const MARCAS_FORTES = [/^(pm|pontos? de mana)$/, /^(tibar|tibares|t\$)$/, /^misticismo$/, /^jogatina$/, /^nobreza$/, /^guerra$/, /^cavalgar$/]

/** MARCAS GERAIS: o vocabulário de ficha d20 em português que sustenta a decisão. */
const MARCAS_GERAIS = [
  ...ATRIBUTOS.map((a) => a.padrao),
  /^(pv|pontos? de vida)$/,
  /^defesa$/,
  /^raca$/,
  /^classe( e nivel)?$/,
  /^nivel$/,
  /^origem$/,
  /^divindade$/,
  /^deslocamento$/,
  /^(pericias?|poderes|magias|equipamento|tibar)$/
]

const TITULO = /tormenta\s*20|\bt20\b/i

/**
 * Tudo que pode ser rótulo nesta ficha, já como chave: nomes de campo (do formulário, mesmo os
 * vazios — o modelo em branco também é de Tormenta) e os textos impressos curtos.
 */
function chavesDaFicha(sheet: PdfSheet): Set<string> {
  const chaves = new Set<string>()
  for (const campo of sheet.fields) chaves.add(chave(campo.name))
  for (const texto of sheet.texts) {
    // Ficha de texto escreve "Nome: Valdo Brasa" num fragmento só: o rótulo é o que vem antes dos dois-pontos.
    const limpo = texto.text.trim().split(':')[0].trim()
    if (limpo.length > 0 && limpo.length <= 40) chaves.add(chave(limpo))
  }
  return chaves
}

function confiancaDeTormenta(sheet: PdfSheet): number {
  const chaves = chavesDaFicha(sheet)
  const casa = (padrao: RegExp): boolean => [...chaves].some((k) => padrao.test(k))
  const temTitulo = TITULO.test(sheet.fileName) || sheet.texts.some((t) => TITULO.test(t.text))
  const fortes = MARCAS_FORTES.filter(casa).length + (temTitulo ? 2 : 0)
  const gerais = MARCAS_GERAIS.filter(casa).length
  // Perícias distintivas já contaram como fortes; as outras contam uma vez cada como gerais.
  const periciasAchadas = PERICIAS.filter((nome) => chaves.has(chave(nome))).length
  const apoio = gerais + Math.min(periciasAchadas, 6)
  if (fortes === 0) return 0
  if (fortes >= 2 && apoio >= 4) return 0.9
  if (fortes >= 1 && apoio >= 5) return 0.9
  if (fortes >= 1 && apoio >= 3) return 0.6
  return 0
}

/** O número de um valor de ficha, aceitando sinal e o que vier depois ("14", "+2", "7 (T)"). */
function numero(valor: string): { n: number; comSinal: boolean } | null {
  const achado = /^([+-]?)\s*(\d{1,3})(?!\d)/.exec(valor.trim())
  if (!achado) return null
  return { n: Number(achado[2]) * (achado[1] === '-' ? -1 : 1), comSinal: achado[1] !== '' }
}

/**
 * VALOR ou MODIFICADOR? Ver o cabeçalho. Um único atributo escrito sem sinal e valendo 8 ou mais
 * é valor de atributo (nenhum modificador de T20 chega a +8); do contrário são modificadores.
 * Decidido pela ficha inteira, e não campo a campo, porque uma ficha nunca mistura as duas
 * edições — e "Força 7" sozinho seria ambíguo.
 */
function estiloDosAtributos(valores: string[]): SheetRollKind {
  const lidos = valores.map(numero).filter((v): v is NonNullable<typeof v> => v !== null)
  const pareceValor = lidos.some((v) => !v.comSinal && v.n >= 8)
  return pareceValor ? 'd20-valor' : 'd20'
}

interface Classificado {
  grupo: string
  /** Identidade do campo pro esqueleto de lacunas ("for", "pv-atual", "pericia:Acrobacia"). */
  id?: string
  /** Rótulo canônico, quando o impresso não serve (só recursos — ver o cabeçalho). */
  label?: string
  roll?: SheetRollKind
  /** Coluna da grade de ataques: `arma`, `teste`, `dano` ou `critico`, com o índice da linha. */
  ataque?: { coluna: 'arma' | 'teste' | 'dano' | 'critico'; indice: string }
}

const COLUNA_DE_ATAQUE = /^(arma|ataque|ataques|teste|bonus|dano|critico|crit)\s*(\d*)$/

/** Em que lugar da ficha de Tormenta este rótulo mora — ou `null`, se o leitor não o conhece. */
function classificar(label: string): Classificado | null {
  const k = chave(label)
  if (!k) return null

  const atributo = ATRIBUTOS.find((a) => a.padrao.test(k))
  if (atributo) return { grupo: GRUPOS.atributos, id: atributo.id }

  const r = recurso(k)
  if (r) return { grupo: GRUPOS.recursos, id: r.id, label: r.label }

  const p = pericia(k)
  if (p) return { grupo: GRUPOS.pericias, id: `pericia:${p}`, roll: 'd20' }

  const coluna = COLUNA_DE_ATAQUE.exec(k)
  if (coluna) {
    const nome = coluna[1]
    const tipo = /^(arma|ataques?)$/.test(nome) ? 'arma' : /^(teste|bonus)$/.test(nome) ? 'teste' : nome === 'dano' ? 'dano' : 'critico'
    return { grupo: GRUPOS.ataques, ataque: { coluna: tipo, indice: coluna[2] } }
  }

  if (/^(nome( do personagem)?|personagem|jogador|nome do jogador|raca|classe( e nivel)?|nivel|origem|divindade|tamanho|tendencia)$/.test(k)) {
    return { grupo: GRUPOS.identificacao, id: /^(nome|personagem)/.test(k) && !/jogador/.test(k) ? 'nome' : undefined }
  }
  if (/^(defesa|deslocamento|ca|armadura|escudo|penalidade( de armadura)?|bonus de ataque|proficiencias?)$/.test(k)) {
    return { grupo: GRUPOS.combate, id: /^(defesa|deslocamento)$/.test(k) ? k : undefined }
  }
  if (/^(cd|cd de magia|atributo[- ]chave|magias?|truques?|conjura(cao)?|circulo \d)/.test(k)) return { grupo: GRUPOS.magia }
  if (/^(poder(es)?|habilidades?( de (raca|classe|origem))?|talentos?)/.test(k)) return { grupo: GRUPOS.habilidades }
  if (/^(equipamentos?|inventario|itens?|tibar(es)?|t\$|dinheiro|carga|espaco|armas e equipamentos?)/.test(k)) return { grupo: GRUPOS.inventario }
  if (/^(aparencia|descricao|idade|altura|peso|genero|olhos|cabelos?|pele)$/.test(k)) return { grupo: GRUPOS.aparencia }
  if (/^(historia|historico|anotacoes|notas|personalidade|aliados|inimigos|objetivos|motivacao)/.test(k)) return { grupo: GRUPOS.historia }
  return null
}

/** Um ataque escrito numa célula só: "Adaga +5 1d4+2 19" → nome, bônus de teste e dano. */
const ATAQUE_NUMA_LINHA = /^(.*?\p{L}.*?)\s+(?:([+-]\s*\d{1,2})\s+)?(\d*[dD]\d+(?:\s*[+-]\s*\d+)?)\b(.*)$/u

interface LinhaDeAtaque {
  nome: string
  teste: string
  dano: string
  critico: string
}

function presetsDoAtaque(linha: LinhaDeAtaque, origem: string): SheetImportPreset[] {
  const presets: SheetImportPreset[] = []
  const teste = parseTestBonus(linha.teste.replace(/\s+/g, ''))
  if (teste) presets.push({ name: `${linha.nome} (ataque)`, kind: 'test', expression: teste, source: origem })
  const dano = parseDiceExpression(linha.dano)
  if (dano) presets.push({ name: `${linha.nome} (dano)`, kind: 'damage', expression: dano.expression, source: origem })
  return presets
}

/** A linha da grade como a ficha mostra: "+5 · 1d4+2 · 19". */
function resumoDoAtaque(linha: LinhaDeAtaque): string {
  return [linha.teste, linha.dano, linha.critico].map((parte) => parte.trim()).filter(Boolean).join(' · ')
}

/**
 * O que SOBROU do texto de uma ficha sem formulário — a mesma regra do genérico (que só a aplica a
 * si mesmo): Tormenta não tem modelo único, então este leitor não sabe separar o impresso do
 * digitado como o de Oblívio faz, e traz tudo pra caixa da conferência decidir. Regra do usuário:
 * "qualquer anotação de player no pdf precisamos trazer".
 */
function sobraDoTexto(sheet: PdfSheet): string | undefined {
  if (sheet.fields.length > 0) return undefined
  const lido = lerCamposDoTexto(sheet)
  const sobra = sheet.texts
    .filter((texto) => !lido.usados.has(texto))
    .map((texto) => texto.text.trim())
    .filter((texto) => /[\p{L}\p{N}]{2}/u.test(texto) && !ehTituloDeFicha(texto) && !TITULO.test(texto) && !texto.endsWith(':'))
  return sobra.length > 0 ? [...new Set(sobra)].join('\n') : undefined
}

/* ------------------------------------------------------------------------------------------ */
/* O MODELO EDITÁVEL: a "Ficha Tormenta20 editável" que circula na comunidade.                 */
/* ------------------------------------------------------------------------------------------ */

/**
 * A ficha que um testador trouxe (a do Milo, 02/09/2026) e que "ficou horrível" pelo caminho do
 * vocabulário: é a editável de comunidade, com 343 campos de NOME PRÓPRIO, e o que ela tem de
 * bom é exatamente o que o vocabulário não vê. Medido no arquivo:
 *
 * - atributos como MODIFICADOR em `ModFor`…`ModCar`; PV/PM em `Pontos de Vida atuais` e
 *   `Pontos de Vida m#C3#A1ximos` (o `#C3#A1` é "á" escapado à moda do PDF, ver
 *   `nomeDeCampoDecodificado`);
 * - a GRADE DE PERÍCIAS em células numeradas por linha: `NN1` é a metade do nível, `NN3` o bônus
 *   de treino, `NN4` outros bônus, `ModAtribXxxx` o modificador do atributo escolhido em
 *   `SeleAtribXxxx`, e `Mar Trei xxxx` a caixa de treinada. `ModAtribXxxx` é campo OCULTO
 *   (bandeira 2 do PDF) e o extrator o descarta de propósito, então o modificador sai do atributo
 *   ESCOLHIDO: `SeleAtribAcro = "Des"` lê `ModDes`. O TOTAL só existe gravado em algumas linhas
 *   (`NN0`, e zerado onde o JavaScript do PDF não rodou), então ele é REFEITO daqui: metade do
 *   nível + atributo + treino + outros (+ o modificador de tamanho, na Furtividade). Conferido
 *   nas linhas em que o arquivo guardou o total: Pilotagem 6, Pontaria 4, Reflexos 6, Vontade 4;
 * - cinco linhas de ataque (`Ataque N`, `Bonus do ataque N`, `Dano causado pelo ataque N`,
 *   `Margem de cr#C3#ADtico e multiplicador N`, `Tipo de dano do ataque N`, `Alcance do ataque N`);
 * - dezessete linhas de item (`Item N`, `Quantidade Item N`, `Slots Item N`), `Tibares`, `Carga
 *   Usada` e `Limite de carga`;
 * - Defesa em `CA` (com os componentes em `Base CA`, `ModAtribDefe`, `B.Arm`, `B.Esc`, `Outros
 *   B.CA`), armadura e escudo com bônus e penalidade, `Lv`, `SeleTamanho`, e os textos longos
 *   da página 2 (habilidades de raça/origem e de classe, magias, descrição, anotações).
 *
 * As células numéricas da grade não têm rótulo e caíam no texto sem rótulo da ficha ("2 0 4 6 5
 * 8 10 3" no bloco de história): neste modelo TODO campo é conhecido, então nada vai pra lá.
 */
const MARCAS_DO_MODELO = ['modfor', 'moddes', 'modcar', 'seleatribacro', 'pontos de vida atuais', 'pontos de mana atuais', 'ataque 1', 'tibares', 'lv']

function confiancaDoModelo(sheet: PdfSheet): number {
  if (sheet.fields.length === 0) return 0
  const nomes = new Set(sheet.fields.map((campo) => chave(nomeDeCampoDecodificado(campo.name))))
  const achadas = MARCAS_DO_MODELO.filter((marca) => nomes.has(marca)).length
  return achadas >= 6 ? 0.97 : 0
}

const ATRIBUTOS_DO_MODELO = [
  { sigla: 'For', nome: 'Força' },
  { sigla: 'Des', nome: 'Destreza' },
  { sigla: 'Con', nome: 'Constituição' },
  { sigla: 'Int', nome: 'Inteligência' },
  { sigla: 'Sab', nome: 'Sabedoria' },
  { sigla: 'Car', nome: 'Carisma' }
]

/** As 30 linhas da grade, na ordem da ficha: linha, sufixo de `SeleAtrib`/`ModAtrib`, sufixo de `Mar Trei`, nome. */
const GRADE_DE_PERICIAS: { linha: string; atrib: string; trei: string; nome: string }[] = [
  { linha: '01', atrib: 'Acro', trei: 'acro', nome: 'Acrobacia' },
  { linha: '02', atrib: 'Ades', trei: 'ades', nome: 'Adestramento' },
  { linha: '03', atrib: 'Atle', trei: 'atle', nome: 'Atletismo' },
  { linha: '04', atrib: 'Atua', trei: 'atua', nome: 'Atuação' },
  { linha: '05', atrib: 'Cava', trei: 'caval', nome: 'Cavalgar' },
  { linha: '06', atrib: 'Conh', trei: 'conhe', nome: 'Conhecimento' },
  { linha: '07', atrib: 'Cura', trei: 'cura', nome: 'Cura' },
  { linha: '08', atrib: 'Dipl', trei: 'dipl', nome: 'Diplomacia' },
  { linha: '09', atrib: 'Enga', trei: 'enga', nome: 'Enganação' },
  { linha: '10', atrib: 'Fort', trei: 'forti', nome: 'Fortitude' },
  { linha: '11', atrib: 'Furt', trei: 'furti', nome: 'Furtividade' },
  { linha: '12', atrib: 'Guer', trei: 'guerra', nome: 'Guerra' },
  { linha: '13', atrib: 'Inic', trei: 'ini', nome: 'Iniciativa' },
  { linha: '14', atrib: 'Inti', trei: 'inti', nome: 'Intimidação' },
  { linha: '15', atrib: 'Intu', trei: 'intu', nome: 'Intuição' },
  { linha: '16', atrib: 'Inve', trei: 'inve', nome: 'Investigação' },
  { linha: '17', atrib: 'Joga', trei: 'joga', nome: 'Jogatina' },
  { linha: '18', atrib: 'Ladi', trei: 'ladi', nome: 'Ladinagem' },
  { linha: '19', atrib: 'Luta', trei: 'luta', nome: 'Luta' },
  { linha: '20', atrib: 'Mist', trei: 'misti', nome: 'Misticismo' },
  { linha: '21', atrib: 'Nobr', trei: 'nobre', nome: 'Nobreza' },
  { linha: '22', atrib: 'Ofi1', trei: 'ofi1', nome: 'Ofício 1' },
  { linha: '23', atrib: 'Ofi2', trei: 'ofi2', nome: 'Ofício 2' },
  { linha: '24', atrib: 'Perc', trei: 'perce', nome: 'Percepção' },
  { linha: '25', atrib: 'Pilo', trei: 'pilo', nome: 'Pilotagem' },
  { linha: '26', atrib: 'Pont', trei: 'ponta', nome: 'Pontaria' },
  { linha: '27', atrib: 'Refl', trei: 'refle', nome: 'Reflexos' },
  { linha: '28', atrib: 'Reli', trei: 'reli', nome: 'Religião' },
  { linha: '29', atrib: 'Sobr', trei: 'sobre', nome: 'Sobrevivência' },
  { linha: '30', atrib: 'Vont', trei: 'vonta', nome: 'Vontade' }
]

/** "+4" pra positivo, "-1" pra negativo, "0" pra zero: como toda ficha d20 escreve um bônus. */
function comSinal(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

function extrairModeloEditavel(sheet: PdfSheet): SheetImport {
  const base = extrairGenerico(sheet, 'tormenta20', 'Tormenta20', 0.97)

  const porNome = new Map<string, PdfField>()
  for (const campo of sheet.fields) {
    const k = chave(nomeDeCampoDecodificado(campo.name))
    if (!porNome.has(k)) porNome.set(k, campo)
  }
  /** Os nomes CRUS dos campos que este leitor leu: o que sobrar do genérico entra como veio. */
  const consumidos = new Set<string>()
  const pegar = (nome: string): string | null => {
    const campo = porNome.get(chave(nome))
    if (!campo) return null
    consumidos.add(campo.name)
    const valor = valorDeFicha(campo.value, campo.type)
    // "?" é o que o modelo deixa impresso no nome do ofício ainda não escolhido; "-" é alcance vazio.
    return valor === '?' || valor === '-' ? null : valor
  }
  const numeroDe = (nome: string): number | null => {
    const lido = numero(pegar(nome) ?? '')
    return lido ? lido.n : null
  }

  const nome = pegar('Nome do Personagem') ?? ''
  const temDono = nome !== ''

  const campos: SheetImportField[] = []
  const presets: SheetImportPreset[] = []
  const push = (label: string, valor: string | null, grupo: string, roll?: SheetRollKind, sempre = false): void => {
    if (valor) campos.push({ label, value: valor, group: grupo, roll })
    else if (sempre && temDono) campos.push({ label, value: '', group: grupo, roll })
  }

  push('Nome', nome || null, GRUPOS.identificacao, undefined, true)
  push('Jogador', pegar('Nome do Jogador'), GRUPOS.identificacao, undefined, true)
  push('Raça', pegar('Raca do Personagem'), GRUPOS.identificacao, undefined, true)
  push('Classe', pegar('Classe(s) do personagem'), GRUPOS.identificacao, undefined, true)
  push('Nível', pegar('Lv'), GRUPOS.identificacao, undefined, true)
  push('Origem', pegar('Origem do Personagem'), GRUPOS.identificacao, undefined, true)
  push('Divindade', pegar('Divindade'), GRUPOS.identificacao, undefined, true)
  push('Tamanho', pegar('SeleTamanho'), GRUPOS.identificacao)
  push('Experiência', pegar('Experiencia total do personagem'), GRUPOS.identificacao)

  // Atributos: o modelo guarda o MODIFICADOR, e é ele que rola (Força +2 → 1d20+2).
  for (const atributo of ATRIBUTOS_DO_MODELO) {
    const n = numeroDe(`Mod${atributo.sigla}`)
    push(atributo.nome, n === null ? null : comSinal(n), GRUPOS.atributos, 'd20', true)
  }

  push('PV atual', pegar('Pontos de Vida atuais'), GRUPOS.recursos, undefined, true)
  push('PV máximo', pegar('Pontos de Vida máximos'), GRUPOS.recursos, undefined, true)
  push('PM atual', pegar('Pontos de Mana atuais'), GRUPOS.recursos, undefined, true)
  push('PM máximo', pegar('Pontos de Mana máximos'), GRUPOS.recursos, undefined, true)

  /**
   * COMBATE. A Defesa é o total em `CA`; os componentes são consumidos pra não sobrarem como
   * "Base CA = 10" e "Outros B.CA = 0" numa seção "Outros". Armadura e escudo entram com o nome
   * e o que dão (bônus e penalidade), que é como a ficha impressa os mostra.
   */
  push('Defesa', pegar('CA'), GRUPOS.combate, undefined, true)
  for (const componente of ['Base CA', 'SeleAtribDefe', 'ModAtribDefe', 'B.Arm', 'B.Esc', 'Outros B.CA', 'PArmTotal', 'arm pesa', 'Reset']) pegar(componente)
  const equipamentoDeDefesa = (campoNome: string, bonus: string, penalidade: string): string | null => {
    const nomeDoItem = pegar(campoNome)
    const b = numeroDe(bonus)
    const p = numeroDe(penalidade)
    if (!nomeDoItem) return null
    const detalhes = [b !== null && b !== 0 ? `Defesa ${comSinal(b)}` : '', p !== null && p !== 0 ? `penalidade ${p}` : ''].filter(Boolean)
    return detalhes.length > 0 ? `${nomeDoItem} (${detalhes.join(', ')})` : nomeDoItem
  }
  push('Armadura', equipamentoDeDefesa('Armadura', 'B.Arm1', 'Pa'), GRUPOS.combate)
  push('Escudo', equipamentoDeDefesa('Escudo', 'B.Esc2', 'Pe'), GRUPOS.combate)
  push('Deslocamento', pegar('Deslocamento do personagem'), GRUPOS.combate, undefined, true)
  const modFurtividadeTamanho = numeroDe('ModFurtTam')
  const modManobraTamanho = numeroDe('ModManTam')
  if ((modFurtividadeTamanho ?? 0) !== 0 || (modManobraTamanho ?? 0) !== 0) {
    push('Modificadores de tamanho', `Furtividade ${comSinal(modFurtividadeTamanho ?? 0)}, manobras ${comSinal(modManobraTamanho ?? 0)}`, GRUPOS.combate)
  }
  push('Testes de resistência', pegar('Teste de resistencias'), GRUPOS.combate)

  /**
   * PERÍCIAS: o total refeito dos componentes (ver o cabeçalho), com "(treinada)" quando a caixa
   * está marcada. Linha sem componente nenhum numa ficha com dono é lacuna; num modelo em branco
   * não entra.
   */
  for (const pericia of GRADE_DE_PERICIAS) {
    const metadeDoNivel = numeroDe(`${pericia.linha}1`)
    const treino = numeroDe(`${pericia.linha}3`)
    const outros = numeroDe(`${pericia.linha}4`)
    pegar(`${pericia.linha}0`)
    const atributoEscolhido = pegar(`SeleAtrib${pericia.atrib}`)
    // O `ModAtrib` é oculto e não chega aqui; o valor está no `Mod<atributo escolhido>` (ver o cabeçalho).
    const atributo = numeroDe(`ModAtrib${pericia.atrib}`) ?? (atributoEscolhido ? numeroDe(`Mod${atributoEscolhido}`) : null)
    const treinada = pegar(`Mar Trei ${pericia.trei}`) === 'sim'
    const partes = [metadeDoNivel, treino, outros, atributo, pericia.atrib === 'Furt' ? modFurtividadeTamanho : null]
    const temAlgo = partes.some((parte) => parte !== null)
    const total = partes.reduce<number>((soma, parte) => soma + (parte ?? 0), 0)
    let rotulo = pericia.nome
    let semOficio = false
    if (pericia.atrib === 'Ofi1' || pericia.atrib === 'Ofi2') {
      const nomeDoOficio = pegar(pericia.atrib === 'Ofi1' ? 'Ofício 1' : 'Ofício_2')
      if (nomeDoOficio) rotulo = `Ofício (${nomeDoOficio})`
      // Ofício sem nome escolhido e sem treino é a linha vazia do modelo: fica como lacuna, não como "+1".
      else semOficio = !treinada
    }
    push(rotulo, temAlgo && !semOficio ? `${comSinal(total)}${treinada ? ' (treinada)' : ''}` : null, GRUPOS.pericias, 'd20', true)
  }

  // Ataques: uma linha por arma, e os presets de teste e dano.
  for (let i = 1; i <= 5; i++) {
    const arma = pegar(`Ataque ${i}`)
    const bonus = numeroDe(`Bonus do ataque ${i}`)
    const dano = pegar(`Dano causado pelo ataque ${i}`) ?? ''
    const critico = pegar(`Margem de crítico e multiplicador ${i}`) ?? ''
    const tipo = pegar(`Tipo de dano do ataque ${i}`) ?? ''
    const alcance = pegar(`Alcance do ataque ${i}`) ?? ''
    if (!arma) continue
    const linha: LinhaDeAtaque = { nome: arma, teste: bonus === null ? '' : comSinal(bonus), dano, critico }
    const resumo = [linha.teste, dano, critico, tipo, alcance].filter(Boolean).join(' · ')
    campos.push({ label: arma, value: resumo, group: GRUPOS.ataques })
    presets.push(...presetsDoAtaque(linha, resumo))
  }

  // Magia: o texto das magias e o atributo-chave com o modificador.
  push('Magias', pegar('Magias'), GRUPOS.magia)
  const atributoChave = pegar('SeleAtribMagia')
  const modChave = numeroDe('ModAtribMagia') ?? (atributoChave ? numeroDe(`Mod${atributoChave}`) : null)
  push('Atributo-chave', atributoChave ? `${atributoChave}${modChave !== null ? ` (${comSinal(modChave)})` : ''}` : null, GRUPOS.magia)

  push('Habilidades de raça e origem', pegar('Habilidades de raca e origem'), GRUPOS.habilidades)
  push('Habilidades de classe e poderes', pegar('Habilidades de Classe e poderes'), GRUPOS.habilidades)
  push('Proficiências', pegar('Proficiencias e outras caracteristicas'), GRUPOS.habilidades)

  // Inventário: cada item com quantidade e espaços; um item com dado escrito ("Poção 2d4+4") vira preset.
  for (let i = 1; i <= 17; i++) {
    const item = pegar(`Item ${i}`)
    const quantidade = numeroDe(`Quantidade Item ${i}`)
    const espacos = numeroDe(`Slots Item ${i}`)
    if (!item) continue
    const detalhes = [quantidade !== null && quantidade !== 1 ? `×${quantidade}` : '', espacos !== null ? `${espacos} espaço${espacos === 1 ? '' : 's'}` : ''].filter(Boolean)
    campos.push({ label: item, value: detalhes.join(', '), group: GRUPOS.inventario })
    const dado = /(\d*[dD]\d+(?:\s*[+-]\s*\d+)?)/.exec(item)
    const expressao = dado ? parseDiceExpression(dado[1]) : null
    if (dado && expressao) {
      presets.push({ name: item.slice(0, dado.index).trim() || item, kind: 'other', expression: expressao.expression, source: item })
    }
  }
  push('Tibares', pegar('Tibares'), GRUPOS.inventario, undefined, true)
  const cargaUsada = pegar('Carga Usada')
  const limiteDeCarga = pegar('Limite de carga')
  push('Carga', cargaUsada && limiteDeCarga ? `${cargaUsada}/${limiteDeCarga}` : cargaUsada ?? limiteDeCarga, GRUPOS.inventario)

  push('Descrição', pegar('Descricao'), GRUPOS.aparencia)
  push('Anotações', pegar('Anotacoes'), GRUPOS.historia)

  // O que o genérico leu e este leitor não conhece entra como veio: é anotação de jogador.
  const restantes = base.fields.filter((campo) => !campo.fieldName || !consumidos.has(campo.fieldName))
  const presetsRestantes = base.presets.filter((preset) => !preset.fieldName || !consumidos.has(preset.fieldName))

  return {
    ...base,
    characterName: nome || base.characterName,
    system: 'Tormenta20',
    fields: [...campos, ...restantes],
    presets: presetsSemRepetidos([...presets, ...presetsRestantes]),
    // As células da grade sem rótulo iam pro texto sem rótulo; aqui todo campo é conhecido.
    rawText: undefined
  }
}

export const tormenta20Reader: SheetReader = {
  id: 'tormenta20',
  label: 'Tormenta20',
  detect: (sheet) => Math.max(confiancaDoModelo(sheet), confiancaDeTormenta(sheet)),
  extract: (sheet) => (confiancaDoModelo(sheet) > 0 ? extrairModeloEditavel(sheet) : extrairTormenta(sheet))
}

function extrairTormenta(sheet: PdfSheet): SheetImport {
  const confianca = confiancaDeTormenta(sheet)
  const base = extrairGenerico(sheet, 'tormenta20', 'Tormenta20', confianca)

  const estilo = estiloDosAtributos(
    base.fields.filter((campo) => classificar(campo.label)?.grupo === GRUPOS.atributos).map((campo) => campo.value)
  )

  const campos: SheetImportField[] = []
  const presentes = new Set<string>()
  const ataques = new Map<string, LinhaDeAtaque & { origem: string; fieldName?: string }>()
  const consumidos = new Set<SheetImportField>()
  const presets: SheetImportPreset[] = []
  let nome = ''

  for (const campo of base.fields) {
    const classe = classificar(campo.label)
    if (!classe) {
      campos.push(campo)
      continue
    }
    if (classe.id) presentes.add(classe.id)
    if (classe.id === 'nome' && !nome) nome = campo.value

    if (classe.ataque) {
      const { coluna, indice } = classe.ataque
      /**
       * A coluna "arma" com o ataque inteiro escrito dentro ("Adaga +5 1d4+2") é uma linha
       * completa por si — o que acontece em ficha caseira e em ficha que só tem um campo "Ataque".
       */
      const inteiro = coluna === 'arma' ? ATAQUE_NUMA_LINHA.exec(campo.value) : null
      if (inteiro) {
        const linha: LinhaDeAtaque = { nome: inteiro[1].trim(), teste: (inteiro[2] ?? '').replace(/\s+/g, ''), dano: inteiro[3], critico: inteiro[4].trim() }
        campos.push({ label: linha.nome, value: resumoDoAtaque(linha), group: GRUPOS.ataques, fieldName: campo.fieldName })
        presets.push(...presetsDoAtaque(linha, campo.value))
        consumidos.add(campo)
        continue
      }
      const linha = ataques.get(indice) ?? { nome: '', teste: '', dano: '', critico: '', origem: '' }
      linha[coluna === 'arma' ? 'nome' : coluna] = campo.value
      linha.origem = [linha.origem, campo.value].filter(Boolean).join(' ')
      if (coluna === 'arma') linha.fieldName = campo.fieldName
      ataques.set(indice, linha)
      consumidos.add(campo)
      continue
    }

    campos.push({
      ...campo,
      label: classe.label ?? campo.label,
      group: classe.grupo,
      roll: classe.grupo === GRUPOS.atributos ? estilo : classe.roll
    })
  }

  /**
   * As linhas da grade de ataques, na ordem da ficha. Coluna sem nome de arma não vira linha —
   * "Dano 2 = 1d6" sem arma é célula de fábrica ou linha meio apagada, e o preset ficaria sem nome.
   */
  for (const [, linha] of [...ataques.entries()].sort(([a], [b]) => Number(a || 0) - Number(b || 0))) {
    if (!linha.nome.trim()) continue
    campos.push({ label: linha.nome.trim(), value: resumoDoAtaque(linha), group: GRUPOS.ataques, fieldName: linha.fieldName })
    presets.push(...presetsDoAtaque(linha, linha.origem))
  }

  /**
   * O ESQUELETO de lacunas, só com dono: atributos, PV/PM, Defesa, Deslocamento e cada perícia
   * que a ficha não trouxe. É o que deixa a pessoa completar no app o que o PDF não tinha — e é o
   * que Ordem e Pathfinder já fazem.
   */
  const temDono = nome !== '' || base.characterName !== ''
  if (temDono) {
    const lacuna = (id: string, label: string, grupo: string, roll?: SheetRollKind): void => {
      if (!presentes.has(id)) campos.push({ label, value: '', group: grupo, roll })
    }
    for (const a of ATRIBUTOS) lacuna(a.id, a.nome, GRUPOS.atributos, estilo)
    if (!presentes.has('pv')) {
      lacuna('pv-atual', 'PV atual', GRUPOS.recursos)
      lacuna('pv-maximo', 'PV máximo', GRUPOS.recursos)
    }
    if (!presentes.has('pm')) {
      lacuna('pm-atual', 'PM atual', GRUPOS.recursos)
      lacuna('pm-maximo', 'PM máximo', GRUPOS.recursos)
    }
    lacuna('defesa', 'Defesa', GRUPOS.combate)
    lacuna('deslocamento', 'Deslocamento', GRUPOS.combate)
    for (const p of PERICIAS) lacuna(`pericia:${p}`, p, GRUPOS.pericias, 'd20')
  }

  /**
   * Os presets do genérico que vieram das células de ataque saem: o deste leitor tem o nome da
   * arma e diz se é teste ou dano; o do genérico se chamava "ATAQUE" e era `other`.
   */
  const fontesConsumidas = new Set([...consumidos].map((campo) => campo.value))
  const nomesConsumidos = new Set([...consumidos].map((campo) => campo.fieldName).filter(Boolean))
  const doGenerico = base.presets.filter(
    (preset) => !(preset.fieldName && nomesConsumidos.has(preset.fieldName)) && !fontesConsumidas.has(preset.source)
  )

  return {
    ...base,
    characterName: nome || base.characterName,
    system: 'Tormenta20',
    fields: campos,
    presets: presetsSemRepetidos([...presets, ...doGenerico]),
    rawText: sobraDoTexto(sheet) ?? base.rawText
  }
}
