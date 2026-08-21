import { describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { montarFicha } from '@shared/types/montarFicha'
import { abrirPdfDeBytes } from './testes/abrirPdfNoNode'
import { pdfDeVariasPaginas, widget } from './testes/pdfDeMentira'

/**
 * A ficha de D&D 5e de ponta a ponta: PDF de verdade → extrator → leitor → o que aparece na aba
 * Ficha.
 *
 * O teste do leitor (`readers/dnd5e.test.ts`) monta a `PdfSheet` à mão, o que é o certo pra régua de
 * cada campo e insuficiente pra uma coisa: os nomes de campo da ficha oficial têm ESPAÇOS SOBRANDO
 * (`Race `, `Wpn2 AtkBonus `), e uma `PdfSheet` escrita à mão prova que o leitor os aceita — não
 * prova que eles chegam até ele. Se o pdf.js aparasse o espaço em algum ponto do caminho, o leitor
 * continuaria certo e a ficha do usuário continuaria vindo pela metade.
 *
 * A ficha real não está no repositório (é material da editora), então o PDF é FABRICADO aqui com os
 * nomes de campo do arquivo oficial, em três páginas como ele. Ver `testes/pdfDeMentira.ts`.
 */

/** Página 1 do formulário oficial: identificação, atributos, perícias, combate, armas. */
const PAGINA1: [string, string][] = [
  ['CharacterName', 'Thalia Corvo'],
  ['ClassLevel', 'Bruxa 5'],
  ['Background', 'Forasteira'],
  ['PlayerName', 'Renato'],
  ['Race ', 'Meio-elfa'],
  ['Alignment', 'Caotica e boa'],
  ['XP', '6500'],
  ['STR', '8'],
  ['DEX', '16'],
  ['CON', '14'],
  ['INT', '12'],
  ['WIS', '10'],
  ['CHA', '18'],
  ['ProfBonus', '+3'],
  ['ST Charisma', '+7'],
  ['ST Wisdom', '+3'],
  ['Deception ', '+7'],
  ['Perception ', '+2'],
  ['Stealth ', '+6'],
  ['AC', '15'],
  ['Initiative', '+3'],
  ['Speed', '9m'],
  ['HPMax', '38'],
  ['HPCurrent', '31'],
  ['HDTotal', '5d8'],
  ['Wpn Name', 'Adaga'],
  ['Wpn1 AtkBonus', '+6'],
  ['Wpn1 Damage', '1d4+3 perfurante'],
  ['Wpn Name 2', 'Rajada Sobrenatural'],
  ['Wpn2 AtkBonus ', '+7'],
  ['Wpn2 Damage ', '1d10 de energia'],
  ['Equipment', 'Adaga, foco arcano, mochila, corda de canhamo'],
  ['GP', '25'],
  ['Features and Traits', 'Presenca sobrenatural. Visao no escuro 18m.']
]

/** Página 2: aparência e história. O `CharacterName 2` repetido é do arquivo oficial. */
const PAGINA2: [string, string][] = [
  ['CharacterName 2', 'Thalia Corvo'],
  ['Age', '24'],
  ['Height', '1,70m'],
  ['Eyes', 'Verdes'],
  ['Backstory', 'Cresceu na estrada, jurou a um patrono que nunca viu.'],
  ['Allies', 'A Companhia do Sino'],
  ['Treasure', 'Um anel de sinete sem brasao']
]

/** Página de magias, cujas linhas não têm nome nenhum além da posição. */
const PAGINA3: [string, string][] = [
  ['Spellcasting Class 2', 'Bruxa'],
  ['SpellcastingAbility 2', 'Carisma'],
  ['SpellSaveDC  2', '15'],
  ['SpellAtkBonus 2', '+7'],
  ['Spells 1014', 'Missil Magico'],
  ['Spells 1015', 'Escudo Arcano']
]

function widgets(campos: [string, string][]): string[] {
  return campos.map(([nome, valor], i) =>
    widget(
      nome,
      valor,
      `[${40 + (i % 3) * 180} ${740 - Math.floor(i / 3) * 26} ${170 + (i % 3) * 180} ${756 - Math.floor(i / 3) * 26}]`
    )
  )
}

async function importar() {
  const bytes = pdfDeVariasPaginas([
    { widgets: widgets(PAGINA1) },
    { widgets: widgets(PAGINA2) },
    { widgets: widgets(PAGINA3) }
  ])
  return readSheet(await abrirPdfDeBytes('DnD_5E_CharacterSheet - Form Fillable.pdf', bytes))
}

describe('ficha de D&D 5e, do PDF até a aba Ficha', () => {
  it('reconhece o sistema e traz o personagem inteiro, apesar dos espaços nos nomes de campo', async () => {
    const lido = await importar()

    expect(lido.readerId).toBe('dnd5e')
    expect(lido.system).toBe('D&D 5e')
    expect(lido.characterName).toBe('Thalia Corvo')

    const porChave = new Map(lido.fields.map((c) => [`${c.group}/${c.label}`, c.value]))
    // Os três campos cujo nome tem espaço sobrando no arquivo oficial — a razão deste teste existir.
    expect(porChave.get('Identificação/Raça')).toBe('Meio-elfa')
    expect(porChave.get('Perícias/Enganação')).toBe('+7')
    expect(porChave.get('Perícias/Furtividade')).toBe('+6')
    // E o resto do personagem, de três páginas diferentes.
    expect(porChave.get('Atributos/Carisma')).toBe('18')
    expect(porChave.get('Combate/PV atual')).toBe('31')
    expect(porChave.get('Aparência/Idade')).toBe('24')
    expect(porChave.get('História/Aliados e organizações')).toBe('A Companhia do Sino')
    expect(porChave.get('Magia/CD das magias')).toBe('15')
  })

  it('as armas e o ataque mágico viram presets separados de teste e de dano', async () => {
    const lido = await importar()
    const nomes = lido.presets.map((p) => p.name)
    expect(nomes).toContain('Adaga (ataque)')
    expect(nomes).toContain('Adaga (dano)')
    expect(nomes).toContain('Rajada Sobrenatural (dano)')
    expect(nomes).toContain('Ataque mágico')
    // Nenhum preset repetido e nenhum sem nome de arma na frente.
    expect(new Set(nomes).size).toBe(nomes.length)
    expect(nomes.some((n) => /^\+?\d+$/.test(n))).toBe(false)
  })

  it('as magias escritas na página de conjuração viram AVISO, e não sessenta linhas sem nome', async () => {
    const lido = await importar()
    expect(lido.fields.some((c) => c.value === 'Missil Magico')).toBe(false)
    expect(lido.warnings).toContain('dnd5e-magias-sem-nome')
  })

  it('na aba Ficha, cada coisa cai no seu lugar', async () => {
    const lido = await importar()
    const ficha = montarFicha(lido.fields, lido.rawText)

    // Os grupos que TÊM bloco correspondente caem nele (ver `sheetBlocks.ts`)…
    expect(ficha.blocks.inventory).toContain('Adaga, foco arcano')
    expect(ficha.blocks.backstory).toContain('jurou a um patrono')
    expect(ficha.blocks.appearance).toContain('Idade: 24')
    expect(ficha.blocks.abilities).toContain('Visao no escuro')

    // …e o que é NÚMERO vira seção, com o nome que o sistema usa.
    const secoes = ficha.sections.map((s) => s.title)
    expect(secoes).toContain('Atributos')
    expect(secoes).toContain('Perícias')
    expect(secoes).toContain('Combate')
    expect(secoes).not.toContain('Outros')

    /**
     * E o tipo de rolagem atravessa até aqui: é ele que põe o botão de dado ao lado do número na
     * ficha. Sem isso a ficha importada continuaria sendo um formulário que não faz nada.
     */
    const atributos = ficha.sections.find((s) => s.title === 'Atributos')
    expect(atributos?.fields.every((c) => c.roll === 'd20-valor')).toBe(true)
    const combate = ficha.sections.find((s) => s.title === 'Combate')
    expect(combate?.fields.find((c) => c.label === 'Iniciativa')?.roll).toBe('d20')
    expect(combate?.fields.find((c) => c.label === 'CA')?.roll).toBeUndefined()
  })
})
