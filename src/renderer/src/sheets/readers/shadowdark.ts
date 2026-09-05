import type { PdfField, PdfSheet, SheetImport, SheetImportField, SheetImportPreset } from '@shared/types/sheetImport'
import type { Language } from '@shared/types/idioma'
import { parseDiceExpression, parseTestBonus } from '@shared/dice/parseDiceExpression'
import { extrairGenerico, presetsSemRepetidos, valorDeFicha } from './generic'
import { linhasDe } from './porPosicao'
import type { SheetReader } from './types'

/**
 * Leitor de SHADOWDARK (The Arcane Library): d20 de escola velha, com atributos de 3 a 18 e o
 * modificador de D&D, PV, CA, equipamento em espaços (dez, ou o valor de Força) e os talentos e
 * magias escritos em prosa. A ficha oficial (`ShadowDark Character Sheet Fillable`, baixada do
 * blog da editora em 02/09/2026) nomeia os campos com significado: `Strength Total`, `Strength
 * Modifier`, `Hit Points`, `Armor Class`, `Gear 1`…`Gear 20`, `Talents / Spells`, `Attacks`,
 * `XP Current`/`XP Target`, `Gold Pieces`… É por esses nomes que ela é lida — e traduzida, como a
 * de D&D: a ficha é inglesa, e o rótulo que vai pra tela é o do idioma de quem joga.
 */
interface Rotulo {
  pt: string
  en: string
}

const GRUPOS = {
  identificacao: { pt: 'Identificação', en: 'Identity' },
  atributos: { pt: 'Atributos', en: 'Stats' },
  recursos: { pt: 'Recursos', en: 'Resources' },
  combate: { pt: 'Combate', en: 'Combat' },
  ataques: { pt: 'Ataques', en: 'Attacks' },
  habilidades: { pt: 'Talentos e magias', en: 'Talents / Spells' },
  inventario: { pt: 'Equipamento', en: 'Gear' }
} satisfies Record<string, Rotulo>

const IDENTIFICACAO: { name: string; pt: string; en: string; sempre?: boolean }[] = [
  { name: 'name', pt: 'Nome', en: 'Name', sempre: true },
  { name: 'ancestry', pt: 'Ancestralidade', en: 'Ancestry', sempre: true },
  { name: 'race', pt: 'Ancestralidade', en: 'Ancestry', sempre: true },
  { name: 'class', pt: 'Classe', en: 'Class', sempre: true },
  { name: 'level', pt: 'Nível', en: 'Level', sempre: true },
  { name: 'title', pt: 'Título', en: 'Title', sempre: true },
  { name: 'alignment', pt: 'Tendência', en: 'Alignment' },
  { name: 'background', pt: 'Antecedente', en: 'Background' },
  { name: 'deity', pt: 'Divindade', en: 'Deity' }
]

const ATRIBUTOS: { name: string; pt: string; en: string }[] = [
  { name: 'strength', pt: 'Força', en: 'Strength' },
  { name: 'dexterity', pt: 'Destreza', en: 'Dexterity' },
  { name: 'constitution', pt: 'Constituição', en: 'Constitution' },
  { name: 'intelligence', pt: 'Inteligência', en: 'Intelligence' },
  { name: 'wisdom', pt: 'Sabedoria', en: 'Wisdom' },
  { name: 'charisma', pt: 'Carisma', en: 'Charisma' }
]

const TEXTO = {
  pv: { pt: 'PV', en: 'HP' },
  ca: { pt: 'CA', en: 'AC' },
  xp: { pt: 'XP', en: 'XP' },
  ataques: { pt: 'Ataques', en: 'Attacks' },
  talentos: { pt: 'Talentos e magias', en: 'Talents / Spells' },
  moedas: { pt: 'Moedas', en: 'Coins' },
  espacosLivres: { pt: 'Espaços livres', en: 'Free to carry' },
  sufixoAtaque: { pt: '(ataque)', en: '(attack)' },
  sufixoDano: { pt: '(dano)', en: '(damage)' }
} satisfies Record<string, Rotulo>

const MARCAS = ['strength total', 'dexterity total', 'hit points', 'armor class', 'gear 1', 'talents / spells', 'free to carry', 'xp target', 'title']

function chave(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Um ataque escrito em prosa numa linha: "Longsword +3, 1d8" ou "Shortbow +1 (1d4)". */
const ATAQUE_EM_LINHA = /^(.*?\p{L}.*?)[\s,:]+(?:([+-]\s*\d{1,2})[\s,(]+)?(\d*[dD]\d+(?:\s*[+-]\s*\d+)?)/u

function confianca(sheet: PdfSheet): number {
  if (sheet.fields.length === 0) return 0
  const nomes = new Set(sheet.fields.map((campo) => chave(campo.name)))
  const quantas = MARCAS.filter((marca) => nomes.has(marca)).length
  if (quantas >= 6) return 0.95
  if (quantas >= 4) return 0.6
  return 0
}

function extrair(sheet: PdfSheet, idioma: Language): SheetImport {
  const base = extrairGenerico(sheet, 'shadowdark', 'Shadowdark', 0.95)
  const t = (par: Rotulo): string => (idioma === 'en-US' ? par.en : par.pt)

  const porNome = new Map<string, PdfField>()
  for (const campo of sheet.fields) {
    const k = chave(campo.name)
    if (!porNome.has(k)) porNome.set(k, campo)
  }
  const consumidos = new Set<string>()
  const pegar = (nome: string, cru = false): string | null => {
    const campo = porNome.get(nome)
    if (!campo) return null
    consumidos.add(campo.name)
    const valor = valorDeFicha(campo.value, campo.type)
    return valor === null ? null : cru ? campo.value.trim() : valor
  }

  const nome = pegar('name') ?? ''
  const temDono = nome !== ''
  const campos: SheetImportField[] = []
  const presets: SheetImportPreset[] = []
  const push = (label: string, valor: string | null, grupo: Rotulo, roll?: SheetImportField['roll'], sempre = false): void => {
    if (valor) campos.push({ label, value: valor, group: t(grupo), roll })
    else if (sempre && temDono) campos.push({ label, value: '', group: t(grupo), roll })
  }

  for (const campo of IDENTIFICACAO) {
    // A ficha oficial escreve `Race` onde o livro diz ancestralidade; as duas entram no mesmo rótulo,
    // uma vez só: o nome que a ficha não tem não vira lacuna ao lado do que ela tem.
    if (campo.name === 'race' && porNome.has('ancestry')) continue
    if (campo.name === 'ancestry' && !porNome.has('ancestry') && porNome.has('race')) continue
    push(t(campo), pegar(campo.name), GRUPOS.identificacao, undefined, campo.sempre)
  }
  const xpAtual = pegar('xp current')
  const xpAlvo = pegar('xp target')
  push(t(TEXTO.xp), xpAtual && xpAlvo ? `${xpAtual}/${xpAlvo}` : (xpAtual ?? xpAlvo), GRUPOS.identificacao)

  /**
   * ATRIBUTOS: o valor (3 a 18) é o que se lê e o que rola pelo modificador de D&D, que Shadowdark
   * usa igual (`d20-valor`). Se só o modificador estiver escrito, ele rola direto.
   */
  for (const atributo of ATRIBUTOS) {
    const total = pegar(`${atributo.name} total`)
    const modificador = pegar(`${atributo.name} modifier`)
    if (total) push(t(atributo), total, GRUPOS.atributos, 'd20-valor', true)
    else if (modificador) push(t(atributo), modificador, GRUPOS.atributos, 'd20', true)
    else push(t(atributo), null, GRUPOS.atributos, 'd20-valor', true)
  }

  push(t(TEXTO.pv), pegar('hit points'), GRUPOS.recursos, undefined, true)
  push(t(TEXTO.ca), pegar('armor class'), GRUPOS.combate, undefined, true)

  // Ataques em prosa, uma linha por arma: a linha vira campo, e o bônus e o dano viram presets.
  const ataques = linhasDe(pegar('attacks', true))
  for (const linha of ataques) {
    const lido = ATAQUE_EM_LINHA.exec(linha)
    if (!lido) {
      campos.push({ label: t(TEXTO.ataques), value: linha, group: t(GRUPOS.ataques) })
      continue
    }
    const arma = lido[1].trim()
    campos.push({ label: arma, value: linha.slice(arma.length).replace(/^[\s,:]+/, ''), group: t(GRUPOS.ataques) })
    const teste = lido[2] ? parseTestBonus(lido[2].replace(/\s+/g, '')) : null
    if (teste) presets.push({ name: `${arma} ${t(TEXTO.sufixoAtaque)}`, kind: 'test', expression: teste, source: linha })
    const dano = parseDiceExpression(lido[3])
    if (dano) presets.push({ name: `${arma} ${t(TEXTO.sufixoDano)}`, kind: 'damage', expression: dano.expression, source: linha })
  }

  push(t(TEXTO.talentos), pegar('talents / spells'), GRUPOS.habilidades)

  for (let i = 1; i <= 20; i++) {
    const item = pegar(`gear ${i}`)
    if (item) campos.push({ label: item, value: '', group: t(GRUPOS.inventario) })
  }
  const moedas = [
    [pegar('gold pieces'), idioma === 'en-US' ? 'gp' : 'ouro'],
    [pegar('silver pieces'), idioma === 'en-US' ? 'sp' : 'prata'],
    [pegar('copper pieces'), idioma === 'en-US' ? 'cp' : 'cobre']
  ].filter(([valor]) => valor && Number(valor) !== 0)
  if (moedas.length > 0) push(t(TEXTO.moedas), moedas.map(([valor, nomeDaMoeda]) => `${valor} ${nomeDaMoeda}`).join(', '), GRUPOS.inventario)
  push(t(TEXTO.espacosLivres), pegar('free to carry'), GRUPOS.inventario)

  const restantes = base.fields.filter((campo) => !campo.fieldName || !consumidos.has(campo.fieldName))
  const presetsRestantes = base.presets.filter((preset) => !preset.fieldName || !consumidos.has(preset.fieldName))
  const nomeDoArquivo = base.characterName
  return {
    ...base,
    characterName: nome || nomeDoArquivo,
    system: 'Shadowdark',
    fields: [...campos, ...restantes],
    presets: presetsSemRepetidos([...presets, ...presetsRestantes])
  }
}

export const shadowdarkReader: SheetReader = {
  id: 'shadowdark',
  label: 'Shadowdark',
  detect: confianca,
  extract: (sheet, idioma) => extrair(sheet, idioma)
}
