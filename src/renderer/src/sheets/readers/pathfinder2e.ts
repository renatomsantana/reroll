import type { SheetImportField, SheetImportPreset } from '@shared/types/sheetImport'
import type { SheetWarningId } from '@shared/types/sheetWarning'
import type { Language } from '@shared/types/idioma'
import { parseDiceExpression, parseTestBonus } from '@shared/dice/parseDiceExpression'
import { extrairGenerico, valorDeFicha } from './generic'
import type { SheetReader } from './types'

/**
 * O leitor de PATHFINDER 2e (Remaster) — pra família de fichas preenchíveis "Ficha Editável com
 * Cálculos", a que circula em português e que o usuário trouxe em quatro exemplares (uma preenchida,
 * o Rilver do Kauan, e três modelos em branco).
 *
 * O que a torna legível é o que a ficha oficial da Paizo NÃO tem: nomes de campo com significado.
 * A oficial (`RemasterPlayerCoreCharacterSheet Form Fillable.pdf`) nomeia os 517 campos como
 * `text_15gujr` e `checkbox_5xofc` — nada a mapear, e ela fica com o leitor genérico e os rótulos
 * impressos. Esta família nomeia `Character Name`, `STRENGTH STAT`, `FORTITUDE`, `MELEE STRIKE 1
 * DAMAGE`, e é isso que este leitor lê.
 *
 * Duas coisas MEDIDAS na ficha do Rilver que decidem a forma do leitor:
 *
 * 1. os TOTAIS são calculados por JavaScript dentro do PDF, e o arquivo guarda o total só quando
 *    alguém o tocou: `STEALTH = 7` está lá, `ACROBATICS` está vazio — mas os componentes estão
 *    sempre (`ACROBATICS DEXTERITY = 4`, `ACROBATICS PROFICIENCY = 3`). Total vazio se refaz da
 *    soma dos componentes, que é exatamente a conta que o PDF faria (7 = 4 + 3, conferido em
 *    Furtividade, Atletismo, Arcanismo, Fortitude e Reflexos);
 * 2. a grade de ataques à distância tem numeração TORTA no modelo: o nome e o dano moram em
 *    `RANGED STRIKE 4`/`5`/`6`, o bônus de ataque em `RANGED STRIKE 1`/`2`/`3` — a linha k usa
 *    `k + 3` num par de campos e `k` no outro. O leitor tenta as duas numerações, então uma versão
 *    do modelo que conserte isso continua lendo.
 *
 * Como o de D&D, o leitor genérico é a base (rótulos impressos, campos soltos, avisos) e este
 * SUBSTITUI campos, presets, nome e sistema pelo que sabe. E como em Ordem Paranormal e D&D, ficha
 * COM DONO traz o esqueleto de lacunas — cada perícia, salvaguarda e recurso, mesmo vazio —, e o
 * modelo em branco não traz nada além do que está escrito nele.
 */

interface Rotulo {
  pt: string
  en: string
}

const GRUPOS = {
  identificacao: { pt: 'Identificação', en: 'Identity' },
  atributos: { pt: 'Atributos', en: 'Attributes' },
  salvaguardas: { pt: 'Salvaguardas', en: 'Saving Throws' },
  pericias: { pt: 'Perícias', en: 'Skills' },
  combate: { pt: 'Combate', en: 'Combat' },
  ataques: { pt: 'Ataques', en: 'Strikes' },
  proficiencias: { pt: 'Proficiências', en: 'Proficiencies' },
  magia: { pt: 'Magia', en: 'Spellcasting' },
  inventario: { pt: 'Inventário', en: 'Equipment' },
  habilidades: { pt: 'Habilidades', en: 'Features' },
  aparencia: { pt: 'Aparência', en: 'Appearance' },
  historia: { pt: 'História', en: 'Backstory' }
} satisfies Record<string, Rotulo>

const TEXTO = {
  sufixoAtaque: { pt: '(ataque)', en: '(attack)' },
  sufixoDano: { pt: '(dano)', en: '(damage)' },
  sufixoDistancia: { pt: ' (à distância)', en: ' (ranged)' },
  ataqueMagico: { pt: 'Ataque mágico', en: 'Spell attack' },
  cdDeMagia: { pt: 'CD de magia', en: 'Spell DC' },
  tradicao: { pt: 'Tradição mágica', en: 'Magical tradition' },
  pvAtual: { pt: 'PV atual', en: 'Current HP' },
  pvMaximo: { pt: 'PV máximo', en: 'Max HP' },
  pontosDeHeroi: { pt: 'Pontos de herói', en: 'Hero points' },
  conhecimento: { pt: 'Conhecimento', en: 'Lore' },
  treinado: { pt: 'Treinado', en: 'Trained' },
  perito: { pt: 'Perito', en: 'Expert' },
  mestre: { pt: 'Mestre', en: 'Master' },
  lendario: { pt: 'Lendário', en: 'Legendary' },
  moedas: { pt: 'Moedas', en: 'Coins' },
  volume: { pt: 'vol.', en: 'bulk' },
  truque: { pt: 'Truque', en: 'Cantrip' },
  magia: { pt: 'Magia', en: 'Spell' },
  foco: { pt: 'Magia de foco', en: 'Focus spell' },
  inata: { pt: 'Magia inata', en: 'Innate spell' },
  ritual: { pt: 'Ritual', en: 'Ritual' },
  acao: { pt: 'Ação', en: 'Action' },
  reacao: { pt: 'Reação', en: 'Reaction' },
  gatilho: { pt: 'gatilho', en: 'trigger' },
  outrasProficiencias: { pt: 'Outras proficiências', en: 'Other proficiencies' }
} satisfies Record<string, Rotulo>

/** Campo → rótulo, nos dois idiomas. `sempre` = entra vazio numa ficha com dono (lacuna). */
interface Campo {
  name: string
  pt: string
  en: string
  roll?: 'd20'
  sempre?: boolean
}

const IDENTIFICACAO: Campo[] = [
  { name: 'character name', pt: 'Personagem', en: 'Character', sempre: true },
  { name: 'player name', pt: 'Jogador', en: 'Player', sempre: true },
  { name: 'ancestry', pt: 'Ancestralidade', en: 'Ancestry', sempre: true },
  { name: 'background', pt: 'Antecedente', en: 'Background', sempre: true },
  { name: 'class', pt: 'Classe', en: 'Class', sempre: true },
  { name: 'level', pt: 'Nível', en: 'Level', sempre: true },
  { name: 'size', pt: 'Tamanho', en: 'Size' },
  { name: 'key attribute', pt: 'Atributo-chave', en: 'Key attribute' },
  { name: 'deity or philosophy', pt: 'Divindade ou filosofia', en: 'Deity or philosophy' },
  { name: 'languages', pt: 'Idiomas', en: 'Languages', sempre: true }
]

const ATRIBUTOS: Campo[] = [
  { name: 'strength stat', pt: 'Força', en: 'Strength', roll: 'd20', sempre: true },
  { name: 'dexterity stat', pt: 'Destreza', en: 'Dexterity', roll: 'd20', sempre: true },
  { name: 'constitution stat', pt: 'Constituição', en: 'Constitution', roll: 'd20', sempre: true },
  { name: 'intelligence stat', pt: 'Inteligência', en: 'Intelligence', roll: 'd20', sempre: true },
  { name: 'wisdom stat', pt: 'Sabedoria', en: 'Wisdom', roll: 'd20', sempre: true },
  { name: 'charisma stat', pt: 'Carisma', en: 'Charisma', roll: 'd20', sempre: true }
]

/** Salvaguarda: o total, e os dois componentes de que ela se refaz quando o total está vazio. */
const SALVAGUARDAS: { name: string; pt: string; en: string; atributo: string; proficiencia: string }[] = [
  { name: 'fortitude', pt: 'Fortitude', en: 'Fortitude', atributo: 'constitution', proficiencia: 'proficiency' },
  { name: 'reflex', pt: 'Reflexos', en: 'Reflex', atributo: 'dexterity', proficiencia: 'proficiency2' },
  { name: 'will', pt: 'Vontade', en: 'Will', atributo: 'wisdom', proficiencia: 'proficiency3' }
]

/** Perícia: o total, e o atributo de que ela depende (o nome do componente é `<PERÍCIA> <ATRIBUTO>`). */
const PERICIAS: { name: string; pt: string; en: string; atributo: string }[] = [
  { name: 'acrobatics', pt: 'Acrobacia', en: 'Acrobatics', atributo: 'dexterity' },
  { name: 'arcana', pt: 'Arcanismo', en: 'Arcana', atributo: 'intelligence' },
  { name: 'athletics', pt: 'Atletismo', en: 'Athletics', atributo: 'strength' },
  { name: 'crafting', pt: 'Ofícios', en: 'Crafting', atributo: 'intelligence' },
  { name: 'deception', pt: 'Enganação', en: 'Deception', atributo: 'charisma' },
  { name: 'diplomacy', pt: 'Diplomacia', en: 'Diplomacy', atributo: 'charisma' },
  { name: 'intimidation', pt: 'Intimidação', en: 'Intimidation', atributo: 'charisma' },
  { name: 'medicine', pt: 'Medicina', en: 'Medicine', atributo: 'wisdom' },
  { name: 'nature', pt: 'Natureza', en: 'Nature', atributo: 'wisdom' },
  { name: 'occultism', pt: 'Ocultismo', en: 'Occultism', atributo: 'intelligence' },
  { name: 'performance', pt: 'Atuação', en: 'Performance', atributo: 'charisma' },
  { name: 'religion', pt: 'Religião', en: 'Religion', atributo: 'wisdom' },
  { name: 'society', pt: 'Sociedade', en: 'Society', atributo: 'intelligence' },
  { name: 'stealth', pt: 'Furtividade', en: 'Stealth', atributo: 'dexterity' },
  { name: 'survival', pt: 'Sobrevivência', en: 'Survival', atributo: 'wisdom' },
  { name: 'thievery', pt: 'Ladinagem', en: 'Thievery', atributo: 'dexterity' }
]

/** As categorias de proficiência com armas e armadura, e os quatro graus em ordem. */
const CATEGORIAS: { prefixo: string; pt: string; en: string }[] = [
  { prefixo: 'unarmed', pt: 'Desarmado', en: 'Unarmed' },
  { prefixo: 'simple weapons', pt: 'Armas simples', en: 'Simple weapons' },
  { prefixo: 'martial weapons', pt: 'Armas marciais', en: 'Martial weapons' },
  { prefixo: 'advanced weapon', pt: 'Armas avançadas', en: 'Advanced weapons' },
  { prefixo: 'other weapons', pt: 'Outras armas', en: 'Other weapons' },
  { prefixo: 'unarmored', pt: 'Sem armadura', en: 'Unarmored' },
  { prefixo: 'light', pt: 'Armadura leve', en: 'Light armor' },
  { prefixo: 'medium', pt: 'Armadura média', en: 'Medium armor' },
  { prefixo: 'heavy', pt: 'Armadura pesada', en: 'Heavy armor' }
]
const GRAUS: { sufixo: string; rotulo: keyof typeof TEXTO }[] = [
  { sufixo: 'legendary', rotulo: 'lendario' },
  { sufixo: 'master', rotulo: 'mestre' },
  { sufixo: 'expert', rotulo: 'perito' },
  { sufixo: 'trained', rotulo: 'treinado' }
]

/** Os blocos de texto livre da ficha, e pra que grupo (logo, pra que bloco da ficha) cada um vai. */
const TEXTOS_LIVRES: { name: string; pt: string; en: string; grupo: Rotulo }[] = [
  { name: 'ancestry & heritage abilities', pt: 'Habilidades de ancestralidade', en: 'Ancestry & heritage abilities', grupo: GRUPOS.habilidades },
  { name: 'ancestry feat', pt: 'Talento de ancestralidade', en: 'Ancestry feat', grupo: GRUPOS.habilidades },
  { name: 'background skill feat', pt: 'Talento de perícia (antecedente)', en: 'Background skill feat', grupo: GRUPOS.habilidades },
  { name: 'class feats & features', pt: 'Talentos e habilidades de classe', en: 'Class feats & features', grupo: GRUPOS.habilidades },
  { name: 'appearance', pt: 'Aparência', en: 'Appearance', grupo: GRUPOS.aparencia },
  { name: 'age', pt: 'Idade', en: 'Age', grupo: GRUPOS.aparencia },
  { name: 'gender & pronouns', pt: 'Gênero e pronomes', en: 'Gender & pronouns', grupo: GRUPOS.aparencia },
  { name: 'height', pt: 'Altura', en: 'Height', grupo: GRUPOS.aparencia },
  { name: 'weight', pt: 'Peso', en: 'Weight', grupo: GRUPOS.aparencia },
  { name: 'ethnicity', pt: 'Etnia', en: 'Ethnicity', grupo: GRUPOS.aparencia },
  { name: 'nationality', pt: 'Nacionalidade', en: 'Nationality', grupo: GRUPOS.historia },
  { name: 'birthplace', pt: 'Local de nascimento', en: 'Birthplace', grupo: GRUPOS.historia },
  { name: 'attitude', pt: 'Atitude', en: 'Attitude', grupo: GRUPOS.historia },
  { name: 'likes', pt: 'Gosta de', en: 'Likes', grupo: GRUPOS.historia },
  { name: 'dislikes', pt: 'Não gosta de', en: 'Dislikes', grupo: GRUPOS.historia },
  { name: 'catchphrases', pt: 'Bordões', en: 'Catchphrases', grupo: GRUPOS.historia },
  { name: 'edicts', pt: 'Éditos', en: 'Edicts', grupo: GRUPOS.historia },
  { name: 'anathema', pt: 'Anátema', en: 'Anathema', grupo: GRUPOS.historia },
  { name: 'allies', pt: 'Aliados', en: 'Allies', grupo: GRUPOS.historia },
  { name: 'enemies', pt: 'Inimigos', en: 'Enemies', grupo: GRUPOS.historia },
  { name: 'organizations', pt: 'Organizações', en: 'Organizations', grupo: GRUPOS.historia },
  { name: 'notes', pt: 'Anotações', en: 'Notes', grupo: GRUPOS.historia }
]

/** As listas de magia: prefixo do NOME, prefixo do grau (quando existe), quantas linhas o modelo tem. */
const MAGIAS: { nome: (i: number) => string; grau?: (i: number) => string; rotulo: keyof typeof TEXTO; linhas: number }[] = [
  { nome: (i) => `cantrip name ${i}`, rotulo: 'truque', linhas: 18 },
  { nome: (i) => `spell ${i}`, grau: (i) => `spell rank ${i}`, rotulo: 'magia', linhas: 76 },
  { nome: (i) => `focus spell ${i}`, rotulo: 'foco', linhas: 9 },
  { nome: (i) => `innate spell ${i}`, rotulo: 'inata', linhas: 6 },
  { nome: (i) => `ritual spell ${i}`, grau: (i) => `ritual rank ${i}`, rotulo: 'ritual', linhas: 6 }
]

const MOEDAS: { name: string; pt: string; en: string }[] = [
  { name: 'platinum', pt: 'platina', en: 'pp' },
  { name: 'gold', pt: 'ouro', en: 'gp' },
  { name: 'silver', pt: 'prata', en: 'sp' },
  { name: 'copper', pt: 'cobre', en: 'cp' }
]

/**
 * A chave de comparação de um nome de campo: minúsculas e UM espaço entre palavras. O modelo tem
 * `THIEVERY  PROFICIENCY` com dois espaços e `CONSTITUTION PARTIAL BOODST` com erro de digitação —
 * o primeiro se resolve aqui, o segundo não importa (o campo não é lido).
 */
function chave(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Um número escrito no campo ("4", "+4", "-1", " 7 "), ou `null`. */
function numero(valor: string | null): number | null {
  if (valor === null) return null
  const limpo = valor.replace(/\s+/g, '')
  if (!/^[+-]?\d+$/.test(limpo)) return null
  return Number(limpo)
}

/** "+4" pra positivo, "-1" pra negativo, "0" pra zero — como toda ficha d20 escreve um bônus. */
function comSinal(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export const pathfinder2eReader: SheetReader = {
  id: 'pathfinder2e',
  label: 'Pathfinder 2e',

  /**
   * Reconhece pela COMBINAÇÃO de nomes: `Ancestry` e `Key attribute` só existem em Pathfinder 2e,
   * e `STRENGTH STAT`/`FORTITUDE`/`CLASS DC` fecham a conta. A ficha de D&D 5e escreve `STR` e
   * `HPMax`, então nenhuma das duas reivindica a outra.
   */
  detect: (sheet) => {
    if (sheet.fields.length === 0) return 0
    const nomes = new Set(sheet.fields.map((campo) => chave(campo.name)))
    if (!nomes.has('ancestry')) return 0
    const marcas = ['character name', 'strength stat', 'dexterity stat', 'fortitude', 'reflex', 'class dc', 'key attribute', 'melee strike 1']
    const quantas = marcas.filter((m) => nomes.has(m)).length
    if (quantas >= 6) return 0.95
    if (quantas >= 3) return 0.6
    return 0
  },

  extract: (sheet, idioma) => extrairPathfinder(sheet, idioma)
}

function extrairPathfinder(sheet: Parameters<SheetReader['extract']>[0], idioma: Language): ReturnType<SheetReader['extract']> {
  const base = extrairGenerico(sheet, 'pathfinder2e', 'Pathfinder 2e', 0.95)
  const t = (par: Rotulo): string => (idioma === 'en-US' ? par.en : par.pt)
  const texto = (nome: keyof typeof TEXTO): string => t(TEXTO[nome])

  const porNome = new Map<string, { value: string; type: string }>()
  for (const campo of sheet.fields) {
    const k = chave(campo.name)
    // O primeiro ganha: o modelo repete `MEDIUM LEGENDARY` (um erro dele), e o primeiro é o certo.
    if (!porNome.has(k)) porNome.set(k, { value: campo.value, type: campo.type })
  }
  const bruto = (nome: string): string | null => {
    const campo = porNome.get(nome)
    return campo ? valorDeFicha(campo.value, campo.type) : null
  }
  const marcado = (nome: string): boolean => bruto(nome) === 'sim'

  const nome = bruto('character name') ?? ''
  const temDono = nome !== ''

  const campos: SheetImportField[] = []
  const presets: SheetImportPreset[] = []
  const avisos: SheetWarningId[] = [...base.warnings]

  /** Empurra o campo se tem valor; e vazio, quando é lacuna (`sempre`) numa ficha com dono. */
  const push = (label: string, valor: string | null, grupo: Rotulo, roll?: 'd20', sempre = false, fieldName?: string): void => {
    if (valor) campos.push({ label, value: valor, group: t(grupo), roll, fieldName })
    else if (sempre && temDono) campos.push({ label, value: '', group: t(grupo), roll, fieldName })
  }

  for (const campo of IDENTIFICACAO) push(t(campo), bruto(campo.name), GRUPOS.identificacao, undefined, campo.sempre, campo.name)

  /**
   * ATRIBUTOS em Pathfinder 2e (Remaster) são o próprio modificador (+4, não 18), então o valor
   * já é o bônus do d20. Entram com sinal, como a ficha impressa mostra.
   */
  for (const campo of ATRIBUTOS) {
    const n = numero(bruto(campo.name))
    push(t(campo), n === null ? null : comSinal(n), GRUPOS.atributos, 'd20', campo.sempre, campo.name)
  }

  /**
   * O TOTAL de uma perícia ou salvaguarda: o que está escrito no campo de total ou, com ele vazio,
   * a soma dos componentes — ver o cabeçalho do arquivo. Sem nenhum dos dois, fica a lacuna.
   */
  const total = (campoTotal: string, componentes: string[]): string | null => {
    const escrito = numero(bruto(campoTotal))
    if (escrito !== null) return comSinal(escrito)
    // A soma só se refaz numa ficha com dono: no modelo em branco os componentes são "0" de fábrica,
    // e dezoito perícias valendo "0" não são informação de ninguém.
    if (!temDono) return null
    const partes = componentes.map((c) => numero(bruto(c)))
    if (partes.some((p) => p === null)) return null
    return comSinal((partes as number[]).reduce((soma, p) => soma + p, 0))
  }

  for (const s of SALVAGUARDAS) {
    push(t(s), total(s.name, [s.atributo, s.proficiencia]), GRUPOS.salvaguardas, 'd20', true, s.name)
  }

  for (const p of PERICIAS) {
    push(t(p), total(p.name, [`${p.name} ${p.atributo}`, `${p.name} proficiency`]), GRUPOS.pericias, 'd20', true, p.name)
  }
  for (const i of [1, 2]) {
    const categoria = bruto(`lore catagory ${i}`) ?? bruto(`lore category ${i}`)
    const valor = total(`lore${i}`, [`lore${i} intelligence`, `lore${i} proficiency`])
    const rotulo = categoria ? `${texto('conhecimento')} (${categoria})` : `${texto('conhecimento')} ${i}`
    push(rotulo, valor, GRUPOS.pericias, 'd20', true, `lore${i}`)
  }

  // Combate: percepção, CA, CD de classe, PV, deslocamento, pontos de herói.
  push(idioma === 'en-US' ? 'Perception' : 'Percepção', total('perception', ['perception wisdom', 'perception proficiency']), GRUPOS.combate, 'd20', true, 'perception')
  push(idioma === 'en-US' ? 'AC' : 'CA', bruto('ac'), GRUPOS.combate, undefined, true, 'ac')
  push(idioma === 'en-US' ? 'Class DC' : 'CD de classe', bruto('class dc'), GRUPOS.combate, undefined, true, 'class dc')
  push(texto('pvMaximo'), bruto('maximum hit points'), GRUPOS.combate, undefined, true, 'maximum hit points')
  // O modelo não tem campo de PV ATUAL — e é o número mais usado na mesa. Entra como lacuna.
  push(texto('pvAtual'), bruto('current hit points'), GRUPOS.combate, undefined, true, 'current hit points')
  push(idioma === 'en-US' ? 'Speed' : 'Deslocamento', (bruto('speed') ?? '').split(/\s+/).filter(Boolean)[0] ?? null, GRUPOS.combate, undefined, true, 'speed')
  const herois = [1, 2, 3].filter((i) => marcado(`hero point ${i}`)).length
  push(texto('pontosDeHeroi'), temDono ? String(herois) : null, GRUPOS.combate, undefined, true)

  // Ataques: as três linhas corpo a corpo e as três à distância (com a numeração torta — ver o cabeçalho).
  const corpoACorpo = new Set<string>()
  const linhaDeAtaque = (nomeCampo: string, ataque: string, dano: string, notas: string, distancia = false): void => {
    const nomeDaArma = bruto(nomeCampo)
    if (!nomeDaArma) return
    /**
     * O Rilver tem "fist" nas duas grades — corpo a corpo (+5) e à distância (+7). Dois presets
     * chamados "fist (ataque)" com bônus diferentes seriam indistinguíveis na lista; o segundo ganha
     * o "à distância" no nome. Só quando o nome repete: "Shortbow" continua "Shortbow".
     */
    const arma = distancia && corpoACorpo.has(nomeDaArma) ? `${nomeDaArma}${texto('sufixoDistancia')}` : nomeDaArma
    if (!distancia) corpoACorpo.add(nomeDaArma)
    const bonus = bruto(ataque) ?? ''
    const danoBruto = bruto(dano) ?? ''
    const resumo = [bonus ? comSinal(numero(bonus) ?? 0) : '', danoBruto].filter(Boolean).join(' · ')
    const extra = bruto(notas)
    campos.push({ label: arma, value: extra ? `${resumo}, ${extra}` : resumo, group: t(GRUPOS.ataques), fieldName: nomeCampo })
    const expressaoAtaque = parseTestBonus(bonus)
    if (expressaoAtaque) presets.push({ name: `${arma} ${texto('sufixoAtaque')}`, kind: 'test', expression: expressaoAtaque, source: bonus })
    const expressaoDano = parseDiceExpression(danoBruto)
    if (expressaoDano) presets.push({ name: `${arma} ${texto('sufixoDano')}`, kind: 'damage', expression: expressaoDano.expression, source: danoBruto })
  }
  for (const k of [1, 2, 3]) {
    linhaDeAtaque(`melee strike ${k}`, `melee strike ${k} attack bonus`, `melee strike ${k} damage`, `melee strike ${k} traits and notes`)
  }
  for (const k of [1, 2, 3]) {
    const nomeCampo = porNome.has(`ranged strike ${k + 3}`) ? `ranged strike ${k + 3}` : `ranged strike ${k}`
    const dano = porNome.has(`ranged strike ${k + 3} damage`) ? `ranged strike ${k + 3} damage` : `ranged strike ${k} damage`
    const notas = porNome.has(`ranged strike ${k + 3} traits and notes`) ? `ranged strike ${k + 3} traits and notes` : `ranged strike ${k} traits and notes`
    linhaDeAtaque(nomeCampo, `ranged strike ${k} attack bonus`, dano, notas, true)
  }

  // Proficiências: o grau mais alto marcado em cada categoria.
  for (const categoria of CATEGORIAS) {
    const grau = GRAUS.find((g) => marcado(`${categoria.prefixo} ${g.sufixo}`))
    if (grau) campos.push({ label: t(categoria), value: texto(grau.rotulo), group: t(GRUPOS.proficiencias) })
  }

  // Magia: só numa ficha com dono, e só o que tem sentido (o guerreiro não ganha 76 linhas vazias).
  const ataqueMagico = bruto('spell attack')
  const cdDeMagia = bruto('spell save dc')
  const tradicao = ['arcane', 'divine', 'occult', 'primal'].find((tr) => marcado(tr)) ?? bruto('magical tradition')
  const conjura = (numero(ataqueMagico) ?? 0) !== 0 || Boolean(tradicao) || MAGIAS.some((lista) => bruto(lista.nome(1)))
  if (temDono && conjura) {
    push(texto('tradicao'), tradicao ? tradicao.charAt(0).toUpperCase() + tradicao.slice(1) : null, GRUPOS.magia, undefined, true)
    push(texto('ataqueMagico'), ataqueMagico, GRUPOS.magia, 'd20', true, 'spell attack')
    push(texto('cdDeMagia'), cdDeMagia, GRUPOS.magia, undefined, true, 'spell save dc')
    const expressaoMagica = parseTestBonus(ataqueMagico ?? '')
    if (expressaoMagica && (numero(ataqueMagico) ?? 0) !== 0) {
      presets.push({ name: texto('ataqueMagico'), kind: 'test', expression: expressaoMagica, source: ataqueMagico ?? '' })
    }
    for (const lista of MAGIAS) {
      let vazias = 0
      for (let i = 1; i <= lista.linhas; i++) {
        const nomeDaMagia = bruto(lista.nome(i))
        if (nomeDaMagia) {
          const grau = lista.grau ? bruto(lista.grau(i)) : null
          campos.push({ label: `${texto(lista.rotulo)} ${i}`, value: grau ? `${nomeDaMagia} (${grau})` : nomeDaMagia, group: t(GRUPOS.magia), fieldName: lista.nome(i) })
        } else if (vazias < 1) {
          // UMA lacuna por lista, pra ter onde anotar a próxima — e não o modelo inteiro em branco.
          campos.push({ label: `${texto(lista.rotulo)} ${i}`, value: '', group: t(GRUPOS.magia), fieldName: lista.nome(i) })
          vazias += 1
        }
      }
    }
  }

  /**
   * Ações e reações — com o EFEITO e o GATILHO escritos, não só o nome. A página 3 da ficha
   * remaster tem, pra cada ação, `ACTION NAME i` e a caixa `EFFECTS i-1`; pra cada reação,
   * `REACTION NAME i`, `REACTIONS TRIGGER i-2` e `REACTIONS EFFECTS i-1`. Na ficha do Rilver os
   * efeitos dos talentos estavam nessas caixas SEM nome de ação, e sumiam inteiros.
   */
  for (const i of [1, 2, 3, 4]) {
    const acao = bruto(`action name ${i}`)
    const efeito = bruto(`effects ${i}-1`)
    if (acao || efeito) {
      campos.push({ label: `${texto('acao')} ${i}`, value: [acao, efeito].filter(Boolean).join(': '), group: t(GRUPOS.habilidades), fieldName: `action name ${i}` })
    }
    const reacao = bruto(`reaction name ${i}`)
    const gatilho = bruto(`reactions trigger ${i}-2`)
    const efeitoDaReacao = bruto(`reactions effects ${i}-1`)
    if (reacao || gatilho || efeitoDaReacao) {
      const detalhe = [gatilho && `${texto('gatilho')}: ${gatilho}`, efeitoDaReacao].filter(Boolean).join('. ')
      campos.push({ label: `${texto('reacao')} ${i}`, value: [reacao, detalhe].filter(Boolean).join(': '), group: t(GRUPOS.habilidades), fieldName: `reaction name ${i}` })
    }
  }

  // A caixa livre das proficiências de arma ("bow - E" na ficha do Rilver).
  push(texto('outrasProficiencias'), bruto('unarmed, simple, advanced, other'), GRUPOS.proficiencias, undefined, false, 'unarmed, simple, advanced, other')

  for (const livre of TEXTOS_LIVRES) push(t(livre), bruto(livre.name), livre.grupo, undefined, false, livre.name)

  // Inventário: o que está na mão, vestido e nos consumíveis, com o volume; e as moedas.
  const itens: { prefixo: string; bulk: (i: number) => string; ate: number }[] = [
    { prefixo: 'held', bulk: (i) => `held bulk ${i}`, ate: 11 },
    { prefixo: 'worn', bulk: (i) => `worn bulk ${i}`, ate: 18 },
    { prefixo: 'consumables', bulk: (i) => `consumables bulk ${i}`, ate: 11 },
    { prefixo: 'gems & art', bulk: (i) => `art bulk ${i}`, ate: 5 }
  ]
  for (const lista of itens) {
    for (let i = 1; i <= lista.ate; i++) {
      // O modelo escreve `HELD1` e `HELD 2` — com e sem espaço — na mesma lista.
      const item = bruto(`${lista.prefixo} ${i}`) ?? bruto(`${lista.prefixo}${i}`)
      if (!item) continue
      const volume = bruto(lista.bulk(i))
      campos.push({ label: item, value: volume ? `${texto('volume')} ${volume}` : '', group: t(GRUPOS.inventario) })
    }
  }
  const moedas = MOEDAS.map((m) => ({ m, n: numero(bruto(m.name)) })).filter(({ n }) => n !== null && n !== 0)
  if (moedas.length > 0) {
    campos.push({ label: texto('moedas'), value: moedas.map(({ m, n }) => `${n} ${t(m)}`).join(', '), group: t(GRUPOS.inventario) })
  }

  // A base (leitor genérico) pode já ter avisado o mesmo; o aviso entra uma vez só.
  if (!temDono && presets.length === 0 && !avisos.includes('sem-nome-nem-rolagem')) avisos.push('sem-nome-nem-rolagem')

  return { ...base, characterName: nome, system: 'Pathfinder 2e', warnings: avisos, fields: campos, presets }
}
