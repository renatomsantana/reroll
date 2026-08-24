import { describe, expect, it } from 'vitest'
import type { PdfField, PdfSheet } from '@shared/types/sheetImport'
import { pathfinder2eReader } from './pathfinder2e'
import { dnd5eReader } from './dnd5e'
import { readSheet } from './index'

/**
 * O leitor de Pathfinder 2e, com a ficha do Rilver reduzida ao essencial — os nomes de campo são os
 * da família "Ficha Editável com Cálculos", copiados do arquivo real.
 */

function campo(name: string, value: string, type = 'text'): PdfField {
  return { name, type, value, page: 1, rect: [0, 0, 10, 10] }
}

function ficha(fields: PdfField[], fileName = 'ficha.pdf'): PdfSheet {
  return { fileName, pageCount: 4, fields, texts: [] }
}

const RILVER: PdfField[] = [
  campo('Character Name', 'Rilver'),
  campo('LEVEL', '1'),
  campo('Player Name', 'Kauan'),
  campo('Ancestry', 'Humano'),
  campo('Background', 'Discipulo marcial'),
  campo('Class', 'Monge'),
  campo('Size', 'Médio'),
  campo('KEY ATTRIBUTE', 'DEXTERITY'),
  campo('STRENGTH STAT', '0'),
  campo('DEXTERITY STAT', '4'),
  campo('CONSTITUTION STAT', '3'),
  campo('INTELLIGENCE STAT', '2'),
  campo('WISDOM STAT', '0'),
  campo('CHARISMA STAT', '0'),
  campo('AC', '19'),
  campo('CLASS DC', '17'),
  campo('MAXIMUM HIT POINTS', '21'),
  campo('SPEED', '7.5\r\n7.5'),
  campo('FORTITUDE', '8'),
  campo('CONSTITUTION', '3'),
  campo('PROFICIENCY', '5'),
  campo('REFLEX', '9'),
  campo('DEXTERITY', '4'),
  campo('PROFICIENCY2', '5'),
  // Total de Vontade VAZIO: o PDF calcula por JavaScript e só grava quando alguém toca no campo.
  campo('WILL', ''),
  campo('WISDOM', '0'),
  campo('PROFICIENCY3', '5'),
  campo('PERCEPTION', '3'),
  campo('PERCEPTION WISDOM', '0'),
  campo('PERCEPTION PROFICIENCY', '3'),
  campo('ACROBATICS', ''),
  campo('ACROBATICS DEXTERITY', '4'),
  campo('ACROBATICS PROFICIENCY', '3'),
  campo('STEALTH', '7'),
  campo('STEALTH DEXTERITY', '4'),
  campo('STEALTH PROFICIENCY', '3'),
  campo('ARCANA', '2'),
  campo('ARCANA INTELLIGENCE', '2'),
  campo('ARCANA PROFICIENCY', '0'),
  campo('THIEVERY', '4'),
  campo('THIEVERY DEXTERITY', '4'),
  campo('THIEVERY  PROFICIENCY', '0'),
  campo('LORE CATAGORY 1', 'Warfare'),
  campo('LORE1', '5'),
  campo('LORE1 INTELLIGENCE', '2'),
  campo('LORE1 PROFICIENCY', '3'),
  campo('HERO POINT 1', 'Yes', 'checkbox'),
  campo('HERO POINT 2', 'Off', 'checkbox'),
  campo('HERO POINT 3', 'Off', 'checkbox'),
  campo('MELEE STRIKE 1', 'fist'),
  campo('MELEE STRIKE 1 ATTACK BONUS', '5'),
  campo('MELEE STRIKE 1 DAMAGE', '1d6'),
  campo('MELEE STRIKE 1 TRAITS AND NOTES', 'Brawling Agile, finesse'),
  campo('RANGED STRIKE 4', 'Shortbow'),
  campo('RANGED STRIKE 1 ATTACK BONUS', '7'),
  campo('RANGED STRIKE 4 DAMAGE', '1d8 P'),
  campo('RANGED STRIKE 4 TRAITS AND NOTES', '10 arrows. 60 ft.'),
  // O punho de novo, na grade à distância (é assim na ficha real do Rilver).
  campo('RANGED STRIKE 5', 'fist'),
  campo('RANGED STRIKE 2 ATTACK BONUS', '7'),
  campo('RANGED STRIKE 5 DAMAGE', '1d6 B'),
  campo('UNARMED TRAINED', 'Yes', 'checkbox'),
  campo('SIMPLE WEAPONS TRAINED', 'Yes', 'checkbox'),
  campo('UNARMORED TRAINED', 'Off', 'checkbox'),
  campo('UNARMORED EXPERT', 'Yes', 'checkbox'),
  campo('LANGUAGES', 'comun\r\nFey'),
  campo('ANCESTRY FEAT', 'Fast Recovery'),
  campo('CLASS FEATS & FEATURES', 'FLURRY OF BLOWS: Make two unarmed'),
  campo('HELD1', 'Adventurer’s pack'),
  campo('HELD BULK 1', '1'),
  campo('HELD 2', 'Healer’s Toolkits'),
  campo('HELD BULK 2', '1'),
  campo('SILVER', '4'),
  campo('GOLD', '3'),
  campo('SPELL ATTACK', '0'),
  campo('SPELL SAVE DC', '10')
]

/** O modelo em branco: os mesmos nomes, com o que vem de fábrica ("1", "0", "10") e o resto vazio. */
const EM_BRANCO: PdfField[] = RILVER.map((c) => {
  if (/^(LEVEL)$/.test(c.name)) return campo(c.name, '1')
  if (/STAT$|^(FORTITUDE|REFLEX|WILL|PERCEPTION|PROFICIENCY\d?|CONSTITUTION|DEXTERITY|WISDOM)$/.test(c.name)) return campo(c.name, '0')
  if (c.name === 'AC') return campo(c.name, '10')
  if (c.type === 'checkbox') return campo(c.name, 'Off', 'checkbox')
  return campo(c.name, '')
})

const valor = (lido: ReturnType<typeof readSheet>, label: string, group?: string) =>
  lido.fields.find((c) => c.label === label && (group === undefined || c.group === group))?.value

describe('reconhecimento', () => {
  it('a família "Ficha Editável com Cálculos" é reconhecida; D&D e ficha vazia, não', () => {
    expect(pathfinder2eReader.detect(ficha(RILVER))).toBeGreaterThanOrEqual(0.9)
    expect(readSheet(ficha(RILVER)).readerId).toBe('pathfinder2e')
    expect(pathfinder2eReader.detect(ficha([]))).toBe(0)
    const dnd = ficha([campo('CharacterName', 'Bramble'), campo('STR', '10'), campo('DEX', '17'), campo('CON', '14'), campo('INT', '11'), campo('WIS', '15'), campo('CHA', '9'), campo('ProfBonus', '+2'), campo('HPMax', '31')])
    expect(pathfinder2eReader.detect(dnd)).toBe(0)
    expect(dnd5eReader.detect(ficha(RILVER))).toBe(0)
  })
})

describe('a ficha do Rilver', () => {
  const lido = readSheet(ficha(RILVER))

  it('identidade e sistema', () => {
    expect(lido.characterName).toBe('Rilver')
    expect(lido.system).toBe('Pathfinder 2e')
    expect(valor(lido, 'Classe')).toBe('Monge')
    expect(valor(lido, 'Ancestralidade')).toBe('Humano')
    expect(valor(lido, 'Idiomas')).toBe('comun Fey')
    expect(lido.warnings).not.toContain('sem-nome-nem-rolagem')
  })

  it('atributos são o próprio modificador, com sinal', () => {
    expect(valor(lido, 'Destreza', 'Atributos')).toBe('+4')
    expect(valor(lido, 'Força', 'Atributos')).toBe('0')
    expect(lido.fields.find((c) => c.label === 'Destreza')?.roll).toBe('d20')
  })

  it('total escrito vale; total vazio se refaz da soma dos componentes', () => {
    expect(valor(lido, 'Fortitude')).toBe('+8')
    expect(valor(lido, 'Reflexos')).toBe('+9')
    expect(valor(lido, 'Vontade')).toBe('+5')
    expect(valor(lido, 'Furtividade')).toBe('+7')
    expect(valor(lido, 'Acrobacia')).toBe('+7')
    expect(valor(lido, 'Ladinagem')).toBe('+4')
    expect(valor(lido, 'Percepção')).toBe('+3')
    expect(valor(lido, 'Conhecimento (Warfare)')).toBe('+5')
  })

  it('toda perícia entra, mesmo a que a ficha deixou em branco — é lacuna', () => {
    expect(valor(lido, 'Sobrevivência', 'Perícias')).toBe('')
    expect(valor(lido, 'Medicina', 'Perícias')).toBe('')
    expect(valor(lido, 'Conhecimento 2', 'Perícias')).toBe('')
  })

  it('combate: CA, CD, PV máximo, PV atual como lacuna, deslocamento e pontos de herói', () => {
    expect(valor(lido, 'CA')).toBe('19')
    expect(valor(lido, 'CD de classe')).toBe('17')
    expect(valor(lido, 'PV máximo')).toBe('21')
    expect(valor(lido, 'PV atual')).toBe('')
    expect(valor(lido, 'Deslocamento')).toBe('7.5')
    expect(valor(lido, 'Pontos de herói')).toBe('1')
  })

  it('ataques viram linhas de resumo e presets de ataque e dano — inclusive a grade à distância torta', () => {
    expect(valor(lido, 'fist', 'Ataques')).toBe('+5 · 1d6 — Brawling Agile, finesse')
    expect(valor(lido, 'Shortbow', 'Ataques')).toBe('+7 · 1d8 P — 10 arrows. 60 ft.')
    const presets = Object.fromEntries(lido.presets.map((p) => [p.name, p.expression]))
    expect(presets['fist (ataque)']).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 5 }] })
    expect(presets['fist (dano)']).toEqual({ groups: [{ sides: 6, count: 1 }], modifiers: [] })
    expect(presets['Shortbow (ataque)']).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 7 }] })
    expect(presets['Shortbow (dano)']).toEqual({ groups: [{ sides: 8, count: 1 }], modifiers: [] })
    // O mesmo nome nas duas grades: o da distância ganha o sufixo, pra não haver dois "fist (ataque)".
    expect(presets['fist (à distância) (ataque)']).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 7 }] })
    expect(lido.presets.filter((p) => p.name === 'fist (ataque)')).toHaveLength(1)
    // Ataque mágico zero não é rolagem; um monge sem magia não ganha a seção de magia.
    expect(presets['Ataque mágico']).toBeUndefined()
    expect(lido.fields.some((c) => c.group === 'Magia')).toBe(false)
  })

  it('proficiências pelo grau mais alto marcado; talentos, inventário e moedas', () => {
    expect(valor(lido, 'Desarmado', 'Proficiências')).toBe('Treinado')
    expect(valor(lido, 'Sem armadura', 'Proficiências')).toBe('Perito')
    expect(valor(lido, 'Talento de ancestralidade', 'Habilidades')).toBe('Fast Recovery')
    expect(valor(lido, 'Adventurer’s pack', 'Inventário')).toBe('vol. 1')
    expect(valor(lido, 'Moedas', 'Inventário')).toBe('3 ouro, 4 prata')
  })

  it('em inglês, os rótulos e grupos trocam junto', () => {
    const en = readSheet(ficha(RILVER), 'en-US')
    expect(valor(en, 'Dexterity', 'Attributes')).toBe('+4')
    expect(valor(en, 'Stealth', 'Skills')).toBe('+7')
    expect(en.presets.map((p) => p.name)).toContain('fist (attack)')
  })
})

describe('o modelo em branco', () => {
  const lido = readSheet(ficha(EM_BRANCO, 'fichaeditavelcomcalculos.pdf'))

  it('é reconhecido, não ganha nome, não ganha lacuna e avisa', () => {
    expect(lido.readerId).toBe('pathfinder2e')
    expect(lido.characterName).toBe('')
    expect(lido.warnings.filter((w) => w === 'sem-nome-nem-rolagem')).toHaveLength(1)
    expect(lido.presets).toEqual([])
    expect(lido.fields.every((c) => c.value !== '')).toBe(true)
    // O que vem de fábrica ainda entra (é o que está escrito), mas é pouco.
    expect(lido.fields.length).toBeLessThan(20)
  })
})
