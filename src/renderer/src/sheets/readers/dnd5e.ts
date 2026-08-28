import type { PdfField, SheetImportField, SheetImportPreset } from '@shared/types/sheetImport'
import { parseDiceExpression, parseTestBonus } from '@shared/dice/parseDiceExpression'
import { extrairGenerico, valorDeFicha } from './generic'
import type { Language } from '@shared/types/idioma'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de DUNGEONS & DRAGONS 5ª EDIÇÃO.
 *
 * É o sistema mais jogado do mundo, e até aqui era o caso pior do importador: a ficha oficial tem
 * uns 160 campos de formulário e quase nenhum rótulo IMPRESSO ao lado deles — os nomes ("FORÇA",
 * "DESTREZA", "Percepção") são parte da arte da página, desenhados dentro das caixas. O leitor
 * genérico, que vive de casar campo com o texto ao lado (ver `labelForField`), não tinha o que casar:
 * o resultado era uma lista de "1_2 = 16" e "Check Box 22 = sim" que ninguém reconheceria como a
 * própria ficha.
 *
 * O que salva o caso é o outro lado: os NOMES DE CAMPO da ficha oficial da Wizards são estáveis e
 * falam ("STR", "ProfBonus", "Wpn1 AtkBonus", "ST Dexterity"), e as fichas preenchíveis que a
 * comunidade publica quase todas descendem dela e mantêm os mesmos nomes. Então aqui o caminho é o
 * INVERSO do genérico: o nome do campo é a fonte, e o texto impresso não é consultado.
 *
 * Duas armadilhas do arquivo oficial, as duas medidas e não supostas:
 *
 * - vários nomes terminam em ESPAÇO, e de forma inconsistente entre si — `Race `, `Deception `,
 *   `Wpn2 AtkBonus `, `Wpn3 AtkBonus  ` (dois espaços). Casar por igualdade crua perde metade da
 *   ficha, então tudo aqui passa por `chave()`;
 * - a ficha guarda o VALOR do atributo e o MODIFICADOR em campos separados (`STR` e `STRmod`), e
 *   quem preenche à mão frequentemente escreve só um dos dois. Ver `atributos()`.
 */

/** Nome de campo normalizado: sem espaço nas pontas e sem caixa. Ver o comentário do arquivo. */
function chave(nome: string): string {
  return nome.trim().toLowerCase()
}

/**
 * AS MAGIAS DA PÁGINA DE CONJURAÇÃO, lidas pela POSIÇÃO — pedido do usuário: cada sistema raspado
 * "igual o de Oblívio, cada um com seu jeito específico dependendo do PDF".
 *
 * O nome do campo não diz nada (`Spells 1014`, `Spells 10100` — numeração de quem montou o
 * formulário por cópia), e por isso elas viravam só um aviso. Mas a PÁGINA diz: a folha oficial
 * tem três colunas, cada nível é um bloco encabeçado pelo campo `SlotsTotal N` (N de 19, o 1º
 * nível, a 27, o 9º), e os truques são o bloco do alto da primeira coluna, sem cabeçalho. Uma
 * magia pertence ao cabeçalho mais próximo ACIMA dela na mesma coluna; sem cabeçalho acima, é
 * truque. Medido na ficha do Go (goblin ladino/mago): oito truques e onze magias de 1º nível
 * chegavam como "Spells 1014" e sumiam.
 *
 * Sai uma linha por nível ("Magias de nível 1 (3 espaços) = flash, mísseis mágicos…"), e não uma
 * por magia: é assim que se lê a lista na mesa, e uma ficha de conjurador tem dezenas delas.
 */
const CABECALHO_DE_NIVEL = /^slotstotal\s*(\d+)$/i
const LINHA_DE_MAGIA = /^spells\s*\d+$/i
/** `SlotsTotal 19` é o 1º nível; 27 é o 9º. */
const PRIMEIRO_CABECALHO = 19
/** Distância horizontal entre o cabeçalho (x=52) e a magia (x=40) na mesma coluna: 12. Colunas distam ~190. */
const MESMA_COLUNA = 60

function magiasPorNivel(
  fields: PdfField[],
  nesteIdioma: (par: Rotulo) => string,
  grupo: string
): SheetImportField[] {
  const cabecalhos = fields
    .map((campo) => ({ campo, nivel: CABECALHO_DE_NIVEL.exec(campo.name) }))
    .filter((c): c is { campo: PdfField; nivel: RegExpExecArray } => c.nivel !== null)
    .map(({ campo, nivel }) => ({
      nivel: Number(nivel[1]) - PRIMEIRO_CABECALHO + 1,
      page: campo.page,
      x: campo.rect[0],
      topo: campo.rect[3],
      espacos: valorDeFicha(campo.value, campo.type)
    }))

  const porNivel = new Map<number, string[]>()
  for (const campo of fields) {
    if (!LINHA_DE_MAGIA.test(campo.name)) continue
    const nomeDaMagia = valorDeFicha(campo.value, campo.type)
    if (!nomeDaMagia) continue
    const acima = cabecalhos
      .filter((c) => c.page === campo.page && Math.abs(c.x - campo.rect[0]) <= MESMA_COLUNA && c.topo >= campo.rect[3])
      .sort((a, b) => a.topo - b.topo)[0]
    const nivel = acima ? acima.nivel : 0
    porNivel.set(nivel, [...(porNivel.get(nivel) ?? []), nomeDaMagia])
  }

  return [...porNivel]
    .sort((a, b) => a[0] - b[0])
    .map(([nivel, nomes]) => {
      const espacos = cabecalhos.find((c) => c.nivel === nivel)?.espacos
      const rotulo =
        nivel === 0
          ? nesteIdioma(TEXTO.truques)
          : nesteIdioma(TEXTO.nivelDeMagia).replace('{n}', String(nivel)) +
            (espacos ? ` (${espacos} ${nesteIdioma(TEXTO.espacos)})` : '')
      return { label: rotulo, value: nomes.join(', '), group: grupo }
    })
}

/**
 * Um rótulo nos dois idiomas da interface.
 *
 * D&D é o único leitor daqui que precisa disto, e a razão é que o sistema é publicado em inglês: os
 * nomes de campo que este leitor reconhece (`STR`, `Deception`, `ProfBonus`) são do arquivo oficial,
 * então o que aparece na tela é escolha nossa. Nos leitores de Ordem Paranormal e de Oblivio não há
 * escolha nenhuma a fazer — o rótulo é o que está IMPRESSO na ficha, em português, e traduzi-lo faria
 * a tela deixar de bater com o papel.
 */
interface Rotulo {
  pt: string
  en: string
}

function rotulo(par: Rotulo, idioma: Language): string {
  return idioma === 'en-US' ? par.en : par.pt
}

/**
 * Os GRUPOS, que viram as seções da ficha.
 *
 * Os nomes em inglês não são tradução livre: eles passam por `SHEET_BLOCK_MATCHERS`
 * (`shared/types/sheetBlocks.ts`), que decide o que vira bloco de texto e o que vira quadro de
 * valores. "Attributes" e não "Ability Scores" por isso — a segunda casa com a expressão de
 * HABILIDADES e mandaria os seis atributos, que são números em caixa, pro bloco de texto livre.
 */
const GRUPOS = {
  identificacao: { pt: 'Identificação', en: 'Identity' },
  atributos: { pt: 'Atributos', en: 'Attributes' },
  salvaguardas: { pt: 'Salvaguardas', en: 'Saving Throws' },
  pericias: { pt: 'Perícias', en: 'Skills' },
  combate: { pt: 'Combate', en: 'Combat' },
  magia: { pt: 'Magia', en: 'Spellcasting' },
  inventario: { pt: 'Inventário', en: 'Equipment' },
  habilidades: { pt: 'Habilidades', en: 'Features' },
  aparencia: { pt: 'Aparência', en: 'Appearance' },
  historia: { pt: 'História', en: 'Backstory' }
} satisfies Record<string, Rotulo>

/**
 * Os seis atributos, com o nome do campo do VALOR e o do MODIFICADOR.
 *
 * `chamod` não é erro de digitação: na ficha oficial o campo do modificador de Carisma se chama
 * `CHamod`, com o "a" minúsculo, enquanto os outros cinco seguem o padrão. É um deslize de quem
 * montou o PDF que virou parte do formato — a ficha está publicada assim desde 2014 e todas as
 * cópias preenchíveis herdaram.
 */
const ATRIBUTOS = [
  { valor: 'str', mod: 'strmod', pt: 'Força', en: 'Strength' },
  { valor: 'dex', mod: 'dexmod', pt: 'Destreza', en: 'Dexterity' },
  { valor: 'con', mod: 'conmod', pt: 'Constituição', en: 'Constitution' },
  { valor: 'int', mod: 'intmod', pt: 'Inteligência', en: 'Intelligence' },
  { valor: 'wis', mod: 'wismod', pt: 'Sabedoria', en: 'Wisdom' },
  { valor: 'cha', mod: 'chamod', pt: 'Carisma', en: 'Charisma' }
]

/** As seis salvaguardas, na ordem da ficha. O valor delas já é o bônus — rola 1d20 + ele. */
const SALVAGUARDAS = [
  { name: 'st strength', pt: 'Força', en: 'Strength' },
  { name: 'st dexterity', pt: 'Destreza', en: 'Dexterity' },
  { name: 'st constitution', pt: 'Constituição', en: 'Constitution' },
  { name: 'st intelligence', pt: 'Inteligência', en: 'Intelligence' },
  { name: 'st wisdom', pt: 'Sabedoria', en: 'Wisdom' },
  { name: 'st charisma', pt: 'Carisma', en: 'Charisma' }
]

/**
 * As dezoito perícias, com o nome que a ficha oficial dá ao campo e o nome em português.
 *
 * `animal` é `Animal` no PDF (a ficha corta "Animal Handling" no meio) e `sleightofhand` vem sem
 * espaço nenhum. São nomes de campo, não texto pra ler — a tradução do lado é que vai pra tela.
 */
const PERICIAS = [
  { name: 'acrobatics', pt: 'Acrobacia', en: 'Acrobatics' },
  { name: 'animal', pt: 'Adestrar Animais', en: 'Animal Handling' },
  { name: 'arcana', pt: 'Arcanismo', en: 'Arcana' },
  { name: 'athletics', pt: 'Atletismo', en: 'Athletics' },
  { name: 'deception', pt: 'Enganação', en: 'Deception' },
  { name: 'history', pt: 'História', en: 'History' },
  { name: 'insight', pt: 'Intuição', en: 'Insight' },
  { name: 'intimidation', pt: 'Intimidação', en: 'Intimidation' },
  { name: 'investigation', pt: 'Investigação', en: 'Investigation' },
  { name: 'medicine', pt: 'Medicina', en: 'Medicine' },
  { name: 'nature', pt: 'Natureza', en: 'Nature' },
  { name: 'perception', pt: 'Percepção', en: 'Perception' },
  { name: 'performance', pt: 'Atuação', en: 'Performance' },
  { name: 'persuasion', pt: 'Persuasão', en: 'Persuasion' },
  { name: 'religion', pt: 'Religião', en: 'Religion' },
  { name: 'sleightofhand', pt: 'Prestidigitação', en: 'Sleight of Hand' },
  { name: 'stealth', pt: 'Furtividade', en: 'Stealth' },
  { name: 'survival', pt: 'Sobrevivência', en: 'Survival' }
]

const IDENTIFICACAO = [
  { name: 'charactername', pt: 'Personagem', en: 'Character' },
  { name: 'playername', pt: 'Jogador', en: 'Player' },
  { name: 'classlevel', pt: 'Classe e nível', en: 'Class & Level' },
  { name: 'race', pt: 'Raça', en: 'Race' },
  { name: 'background', pt: 'Antecedente', en: 'Background' },
  { name: 'alignment', pt: 'Tendência', en: 'Alignment' },
  { name: 'xp', pt: 'Experiência', en: 'Experience' }
]

/**
 * COMBATE. `initiative` é o único que se rola — os outros são números que se consultam —, e é por
 * isso que a régua de rolagem aqui é por CAMPO e não por seção: um botão de dado ao lado da Classe
 * de Armadura rolaria uma coisa que não existe no sistema.
 */
const COMBATE: { name: string; pt: string; en: string; roll?: 'd20' }[] = [
  { name: 'ac', pt: 'CA', en: 'AC' },
  { name: 'initiative', pt: 'Iniciativa', en: 'Initiative', roll: 'd20' },
  { name: 'speed', pt: 'Deslocamento', en: 'Speed' },
  { name: 'hpmax', pt: 'PV máximo', en: 'Max HP' },
  { name: 'hpcurrent', pt: 'PV atual', en: 'Current HP' },
  { name: 'hptemp', pt: 'PV temporário', en: 'Temp HP' },
  { name: 'hdtotal', pt: 'Dados de vida', en: 'Hit Dice' },
  // O DADO de vida ("1d8") — campo `HD` ao lado do total. Vira preset também (ver `extract`).
  { name: 'hd', pt: 'Dado de vida', en: 'Hit Die' },
  { name: 'profbonus', pt: 'Bônus de proficiência', en: 'Proficiency Bonus' },
  { name: 'passive', pt: 'Percepção passiva', en: 'Passive Perception' }
]

/**
 * Os campos de TEXTO LONGO e para onde eles vão na ficha do app.
 *
 * O `group` aqui não é enfeite de conferência: ele é o que manda o conteúdo pro bloco certo (ver
 * `sheetBlocks.ts`), e foi o pedido explícito do usuário — "backstory pra backstory, inventário pra
 * inventário". Uma ficha de D&D preenchida tem parágrafos nesses campos, e como linha de formulário
 * eles ficariam espremidos numa caixa de uma linha.
 */
const TEXTOS: { name: string; pt: string; en: string; grupo: Rotulo }[] = [
  { name: 'equipment', pt: 'Equipamento', en: 'Equipment', grupo: GRUPOS.inventario },
  { name: 'features and traits', pt: 'Características', en: 'Features & Traits', grupo: GRUPOS.habilidades },
  { name: 'feat+traits', pt: 'Características (continuação)', en: 'Features & Traits (cont.)', grupo: GRUPOS.habilidades },
  { name: 'proficiencieslang', pt: 'Proficiências e idiomas', en: 'Proficiencies & Languages', grupo: GRUPOS.habilidades },
  { name: 'attacksspellcasting', pt: 'Ataques e magias', en: 'Attacks & Spellcasting', grupo: GRUPOS.habilidades },
  { name: 'personalitytraits', pt: 'Traços de personalidade', en: 'Personality Traits', grupo: GRUPOS.historia },
  { name: 'ideals', pt: 'Ideais', en: 'Ideals', grupo: GRUPOS.historia },
  { name: 'bonds', pt: 'Vínculos', en: 'Bonds', grupo: GRUPOS.historia },
  { name: 'flaws', pt: 'Fraquezas', en: 'Flaws', grupo: GRUPOS.historia },
  { name: 'backstory', pt: 'História', en: 'Backstory', grupo: GRUPOS.historia },
  { name: 'allies', pt: 'Aliados e organizações', en: 'Allies & Organizations', grupo: GRUPOS.historia },
  { name: 'factionname', pt: 'Organização', en: 'Faction', grupo: GRUPOS.historia },
  { name: 'treasure', pt: 'Tesouro', en: 'Treasure', grupo: GRUPOS.inventario },
  { name: 'age', pt: 'Idade', en: 'Age', grupo: GRUPOS.aparencia },
  { name: 'height', pt: 'Altura', en: 'Height', grupo: GRUPOS.aparencia },
  { name: 'weight', pt: 'Peso', en: 'Weight', grupo: GRUPOS.aparencia },
  { name: 'eyes', pt: 'Olhos', en: 'Eyes', grupo: GRUPOS.aparencia },
  { name: 'skin', pt: 'Pele', en: 'Skin', grupo: GRUPOS.aparencia },
  { name: 'hair', pt: 'Cabelo', en: 'Hair', grupo: GRUPOS.aparencia },
  { name: 'characterappearance', pt: 'Aparência', en: 'Appearance', grupo: GRUPOS.aparencia }
]

/** As moedas, que viram uma linha só no inventário em vez de cinco campos de uma letra. */
const MOEDAS = [
  { name: 'cp', pt: 'PC', en: 'cp' },
  { name: 'sp', pt: 'PP', en: 'sp' },
  { name: 'ep', pt: 'PE', en: 'ep' },
  { name: 'gp', pt: 'PO', en: 'gp' },
  { name: 'pp', pt: 'PL', en: 'pp' }
]

/** Os rótulos que o leitor escreve por conta própria, fora das tabelas de campo. */
const TEXTO = {
  dinheiro: { pt: 'Dinheiro', en: 'Money' },
  classeConjuradora: { pt: 'Classe conjuradora', en: 'Spellcasting Class' },
  atributoConjurador: { pt: 'Atributo de conjuração', en: 'Spellcasting Ability' },
  cdDeMagia: { pt: 'CD das magias', en: 'Spell Save DC' },
  ataqueMagico: { pt: 'Ataque mágico', en: 'Spell Attack' },
  dadoDeVida: { pt: 'Dado de vida', en: 'Hit Die' },
  truques: { pt: 'Truques', en: 'Cantrips' },
  nivelDeMagia: { pt: 'Magias de nível {n}', en: 'Level {n} spells' },
  espacos: { pt: 'espaços', en: 'slots' },
  sufixoAtaque: { pt: '(ataque)', en: '(attack)' },
  sufixoDano: { pt: '(dano)', en: '(damage)' }
} satisfies Record<string, Rotulo>

/**
 * As três linhas da grade de ARMAS. Os espaços a mais nos nomes são do arquivo oficial — ver o
 * comentário do topo; `chave()` cuida deles, e a lista fica com a forma legível.
 */
const ARMAS = [
  { nome: 'wpn name', ataque: 'wpn1 atkbonus', dano: 'wpn1 damage' },
  { nome: 'wpn name 2', ataque: 'wpn2 atkbonus', dano: 'wpn2 damage' },
  { nome: 'wpn name 3', ataque: 'wpn3 atkbonus', dano: 'wpn3 damage' }
]

/**
 * MAGIA. Os quatro campos do topo da página de conjuração, e o bônus de ataque mágico é uma rolagem
 * de verdade — vira preset como uma arma.
 *
 * Estes são procurados por PREFIXO, sem espaço nenhum, e não por igualdade: na ficha oficial eles se
 * chamam `Spellcasting Class 2`, `SpellcastingAbility 2`, `SpellSaveDC  2` (com dois espaços no
 * meio) e `SpellAtkBonus 2` — o " 2" é lixo de quando a página de magias foi montada por cópia, e a
 * quantidade de espaços varia campo a campo. Procurar `spellatkbonus` cru não acha nenhum deles, e o
 * conjurador — metade das classes do sistema — importaria sem CD e sem ataque mágico.
 */
const ATAQUE_MAGICO = 'spellatkbonus'
const CD_DE_MAGIA = 'spellsavedc'
const CLASSE_CONJURADORA = 'spellcastingclass'
const ATRIBUTO_CONJURADOR = 'spellcastingability'

export const dnd5eReader: SheetReader = {
  id: 'dnd5e',
  label: 'D&D 5e',

  /**
   * Reconhece pela COMBINAÇÃO de nomes de campo, e não por um só.
   *
   * `STR`/`DEX`/`CON`… sozinhos apareceriam em ficha de qualquer sistema d20 derivado (Pathfinder,
   * Tormenta, os OSR), e reivindicar a ficha deles seria pior que deixar no genérico: o leitor
   * traduziria os campos pra nomenclatura de D&D e o jogador de outro sistema veria a própria ficha
   * com rótulos errados. Somando `ProfBonus` (que é invenção da 5ª edição) e a grade `Wpn…` a
   * chance de coincidência some.
   */
  detect: (sheet) => {
    if (sheet.fields.length === 0) return 0
    const nomes = new Set(sheet.fields.map((campo) => chave(campo.name)))
    const atributos = ATRIBUTOS.filter((a) => nomes.has(a.valor)).length
    if (atributos < 5) return 0
    const marcas = [nomes.has('profbonus'), nomes.has('wpn name'), nomes.has('hpmax'), nomes.has('ac')]
    const quantas = marcas.filter(Boolean).length
    if (atributos === 6 && quantas >= 2) return 0.95
    if (quantas >= 1) return 0.6
    return 0
  },

  extract: (sheet, idioma) => {
    const base = extrairGenerico(sheet, 'dnd5e', 'D&D 5e', 0.95)
    /** Atalho pro par de rótulos deste idioma — ver `Rotulo`. */
    const nesteIdioma = (par: Rotulo): string => rotulo(par, idioma)

    /**
     * Índice por nome NORMALIZADO, ficando com o primeiro de cada.
     *
     * A ficha oficial repete `CharacterName` na página 2 e na de magias (é o cabeçalho de cada
     * página), e todas as cópias trazem o mesmo valor. Ficar com a última seria igualmente correto
     * hoje e frágil amanhã: numa ficha em que só a primeira página foi preenchida, a última
     * ocorrência está vazia.
     */
    const porNome = new Map<string, PdfField>()
    for (const campo of sheet.fields) {
      const k = chave(campo.name)
      const atual = porNome.get(k)
      // Preenchido ganha de vazio, independentemente da ordem: ver o comentário acima.
      if (!atual || (!valorDeFicha(atual.value, atual.type) && valorDeFicha(campo.value, campo.type))) {
        porNome.set(k, campo)
      }
    }

    const valor = (nome: string): string | null => {
      const campo = porNome.get(nome)
      return valorDeFicha(campo?.value, campo?.type)
    }

    /**
     * O campo cujo nome COMEÇA com isto, ignorando espaços. Ver o comentário dos campos de magia:
     * é o jeito de alcançar `SpellSaveDC  2` sem cadastrar cada variação de espaço e de sufixo.
     */
    const valorPorPrefixo = (prefixo: string): string | null => {
      for (const [nome, campo] of porNome) {
        if (!nome.replace(/\s+/g, '').startsWith(prefixo)) continue
        const lido = valorDeFicha(campo.value, campo.type)
        if (lido) return lido
      }
      return null
    }

    /**
     * A ficha É DE ALGUÉM? O corte é o nome do personagem, como no leitor de Ordem Paranormal: é o
     * que separa a ficha em uso do modelo em branco baixado do site da Wizards.
     */
    const nome = valorDeFicha(porNome.get('charactername')?.value) ?? ''
    const temDono = nome !== ''

    const campos: SheetImportField[] = []
    /**
     * `sempre` traz o campo MESMO VAZIO — é o esqueleto de lacunas, pedido do usuário: "coloca
     * lacunas para TUDO que é preenchível, porque às vezes precisamos preencher no app também mesmo
     * que não tenha, porque é um item novo na sessão". O leitor de Ordem Paranormal já fazia isso; o
     * de D&D descartava tudo o que estivesse em branco, e uma ficha de nível 1 com três perícias
     * treinadas chegava com três linhas de perícia, sem lugar pra anotar a quarta. Só quando a ficha
     * tem dono: no modelo em branco, seriam quarenta linhas vazias.
     */
    const push = (
      label: string,
      bruto: string | null,
      group: string,
      roll?: SheetImportField['roll'],
      sempre = false
    ): void => {
      if (bruto) campos.push({ label, value: bruto, group, roll })
      else if (sempre && temDono) campos.push({ label, value: '', group, roll })
    }

    const grupo = {
      identificacao: nesteIdioma(GRUPOS.identificacao),
      atributos: nesteIdioma(GRUPOS.atributos),
      salvaguardas: nesteIdioma(GRUPOS.salvaguardas),
      pericias: nesteIdioma(GRUPOS.pericias),
      combate: nesteIdioma(GRUPOS.combate),
      magia: nesteIdioma(GRUPOS.magia),
      inventario: nesteIdioma(GRUPOS.inventario)
    }

    for (const campo of IDENTIFICACAO) push(nesteIdioma(campo), valor(campo.name), grupo.identificacao, undefined, true)

    campos.push(...atributos(valor, nesteIdioma, grupo.atributos))

    for (const campo of SALVAGUARDAS) push(nesteIdioma(campo), valor(campo.name), grupo.salvaguardas, 'd20', true)
    for (const campo of PERICIAS) push(nesteIdioma(campo), valor(campo.name), grupo.pericias, 'd20', true)
    for (const campo of COMBATE) push(nesteIdioma(campo), valor(campo.name), grupo.combate, campo.roll, true)

    /**
     * A seção de MAGIA entra como lacuna também numa ficha com dono — o guerreiro de hoje é o
     * multiclasse de amanhã, e a página de conjuração da ficha oficial é preenchível como qualquer
     * outra. Esta regra já foi "só se tiver magia", e mudou com o pedido das lacunas (ver `push`).
     */
    push(nesteIdioma(TEXTO.classeConjuradora), valorPorPrefixo(CLASSE_CONJURADORA), grupo.magia, undefined, true)
    push(nesteIdioma(TEXTO.atributoConjurador), valorPorPrefixo(ATRIBUTO_CONJURADOR), grupo.magia, undefined, true)
    push(nesteIdioma(TEXTO.cdDeMagia), valorPorPrefixo(CD_DE_MAGIA), grupo.magia, undefined, true)
    push(nesteIdioma(TEXTO.ataqueMagico), valorPorPrefixo(ATAQUE_MAGICO), grupo.magia, 'd20', true)

    for (const campo of TEXTOS) push(nesteIdioma(campo), valor(campo.name), nesteIdioma(campo.grupo))

    campos.push(...magiasPorNivel(sheet.fields, nesteIdioma, grupo.magia))

    const dinheiro = MOEDAS.map((moeda) => {
      const bruto = valor(moeda.name)
      return bruto && Number(bruto) !== 0 ? `${bruto} ${nesteIdioma(moeda)}` : null
    }).filter(Boolean)
    if (dinheiro.length > 0) {
      campos.push({ label: nesteIdioma(TEXTO.dinheiro), value: dinheiro.join(', '), group: grupo.inventario })
    }

    const presets = presetsDeArmas(porNome, valorPorPrefixo(ATAQUE_MAGICO) ?? '', nesteIdioma)

    /**
     * O DADO DE VIDA é uma rolagem do personagem (o descanso curto rola ele), e este leitor não
     * aproveita os presets do genérico — então o botão nasce aqui.
     */
    const dadoDeVida = valor('hd')
    const expressaoDoDado = dadoDeVida ? parseDiceExpression(dadoDeVida) : null
    if (expressaoDoDado) {
      presets.push({ name: nesteIdioma(TEXTO.dadoDeVida), kind: 'other', expression: expressaoDoDado.expression, source: dadoDeVida ?? '' })
    }

    /**
     * O que o GENÉRICO achou e este leitor não tratou fica de fora, e esta é a única diferença de
     * fundo entre este leitor e o de Ordem Paranormal.
     *
     * Lá o restante vale a pena: a ficha tem rótulo impresso ao lado dos campos, então o que sobra
     * chega com nome legível. Aqui não há rótulo impresso nenhum — é tudo desenho —, e o que o
     * genérico produz pra um campo não catalogado é o nome cru do PDF: "Check Box 11 = sim". Numa
     * ficha de D&D isso são DEZENAS de linhas, e o usuário já disse o que essa lista vira na tela:
     * "fica uma bagunça, não dá para entender". As magias, que também moram em campos sem nome,
     * são lidas pela POSIÇÃO — ver `magiasPorNivel`.
     */
    const avisos = [...base.warnings]

    /**
     * O MODELO EM BRANCO baixado do site da Wizards, importado por engano antes de preencher. É o
     * erro mais comum de importação, e o app tem que dizer isso em vez de criar um personagem sem
     * nome com seis atributos vazios. O sinal é o mesmo que o leitor genérico usa: nenhum nome
     * escrito e nenhuma rolagem.
     */
    if (!nome && presets.length === 0) avisos.push('dnd5e-modelo-em-branco')

    return {
      ...base,
      characterName: nome,
      system: 'D&D 5e',
      warnings: avisos,
      fields: campos,
      presets
    }
  }
}

/**
 * Os seis atributos, tratando o caso que a ficha oficial cria sozinha: VALOR e MODIFICADOR em campos
 * separados, preenchidos à mão, e quase nunca os dois.
 *
 * A ficha não calcula nada — quem preenche digita 16 numa caixa e +3 na outra —, e na prática se vê
 * de tudo: ficha com os dois, ficha só com o valor, ficha só com o modificador (o pessoal que usa a
 * caixa grande pro número que importa na hora de rolar), e ficha com os dois DIVERGINDO, porque o
 * personagem subiu de nível e só um dos dois foi corrigido.
 *
 * A regra aqui, nessa ordem:
 *
 * 1. tem VALOR (3 a 30, que é a faixa que o sistema permite): mostra o valor e rola o modificador
 *    calculado a partir dele (`d20-valor`). É o número que o jogador reconhece na própria ficha, e
 *    calcular é mais confiável que ler — o modificador escrito é o campo que envelhece;
 * 2. só tem MODIFICADOR: mostra ele e rola somando (`d20`). Nada a calcular;
 * 3. o valor está fora da faixa, ou vem com SINAL na frente: quase sempre é o modificador digitado
 *    na caixa errada — ninguém escreve "+16" como valor de Força, e a caixa grande é onde a mão vai
 *    quando se preenche a ficha pensando na hora de rolar. Tratar como modificador acerta esse caso
 *    e, se for outra coisa, ainda mostra o que está escrito.
 */
function atributos(
  valor: (nome: string) => string | null,
  nesteIdioma: (par: Rotulo) => string,
  grupo: string
): SheetImportField[] {
  const campos: SheetImportField[] = []
  for (const atributo of ATRIBUTOS) {
    const pontos = valor(atributo.valor)
    const modificador = valor(atributo.mod)
    // O sinal explícito é a marca do modificador, e vem ANTES da faixa: "+3" é um número entre 3 e
    // 30 e passaria por valor de atributo sem esta pergunta.
    const assinado = pontos !== null && /^[+-]/.test(pontos.trim())
    const numero = pontos === null || assinado ? null : Number(pontos.replace(/[^\d-]/g, ''))

    if (numero !== null && Number.isFinite(numero) && numero >= 3 && numero <= 30) {
      campos.push({ label: nesteIdioma(atributo), value: pontos as string, group: grupo, roll: 'd20-valor' })
    } else if (modificador) {
      campos.push({ label: nesteIdioma(atributo), value: modificador, group: grupo, roll: 'd20' })
    } else if (pontos) {
      campos.push({ label: nesteIdioma(atributo), value: pontos, group: grupo, roll: 'd20' })
    }
  }
  return campos
}

/**
 * As três armas da primeira página viram até DOIS presets cada — o teste de acerto e o dano —, pelo
 * mesmo motivo que em Ordem Paranormal: um preset guarda uma expressão só, e um ataque de RPG são
 * duas rolagens.
 *
 * A coluna de ataque traz o bônus solto ("+7"), porque o d20 é implícito no sistema; a de dano traz
 * notação completa, às vezes com o tipo junto ("1d8+3 cortante"), que `parseDiceExpression` já sabe
 * atravessar. Linha sem NOME não vira preset: a ficha tem três linhas e quase ninguém usa as três.
 */
function presetsDeArmas(
  porNome: Map<string, PdfField>,
  ataqueMagico: string,
  nesteIdioma: (par: Rotulo) => string
): SheetImportPreset[] {
  const presets: SheetImportPreset[] = []
  const ler = (nome: string): string => {
    const campo = porNome.get(nome)
    return valorDeFicha(campo?.value, campo?.type) ?? ''
  }

  for (const arma of ARMAS) {
    const nome = ler(arma.nome)
    const ataque = ler(arma.ataque)
    const dano = ler(arma.dano)
    if (!nome) continue

    const expressaoAtaque = parseDiceExpression(ataque)?.expression ?? parseTestBonus(ataque)
    if (expressaoAtaque) {
      presets.push({
        name: `${nome} ${nesteIdioma(TEXTO.sufixoAtaque)}`,
        kind: 'test',
        expression: expressaoAtaque,
        source: ataque
      })
    }
    const expressaoDano = parseDiceExpression(dano)
    if (expressaoDano) {
      presets.push({
        name: `${nome} ${nesteIdioma(TEXTO.sufixoDano)}`,
        kind: 'damage',
        expression: expressaoDano.expression,
        source: dano
      })
    }
  }

  const expressaoMagica = parseDiceExpression(ataqueMagico)?.expression ?? parseTestBonus(ataqueMagico)
  if (expressaoMagica) {
    presets.push({
      name: nesteIdioma(TEXTO.ataqueMagico),
      kind: 'test',
      expression: expressaoMagica,
      source: ataqueMagico
    })
  }

  return presets
}
