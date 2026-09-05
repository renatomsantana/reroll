import { describe, expect, it } from 'vitest'
import type { PdfField, PdfSheet, PdfText } from '@shared/types/sheetImport'
import { extrairRecursos } from '@shared/types/extrairRecursos'
import { rolagemDoCampo } from '@shared/types/sheetRoll'
import { readSheet } from './index'
import { tormenta20Reader } from './tormenta20'

/**
 * O leitor de Tormenta20 foi escrito SEM ficha real na mão (ver o cabeçalho de `tormenta20.ts`),
 * então estes testes montam as três formas em que uma ficha de T20 chega: formulário com nomes em
 * português (a editável e as de comunidade), formulário com a grade de ataques em colunas
 * numeradas, e documento de texto sem formulário nenhum (a caseira do Google Docs). Os valores são
 * os de um personagem plausível de nível 5 — e a edição de 2019 e a Jogo do Ano aparecem as duas,
 * porque a rolagem do atributo muda entre elas.
 */

function campo(name: string, value: string, y = 700): PdfField {
  return { name, type: 'text', value, page: 1, rect: [200, y, 260, y + 14] }
}

function texto(text: string, x: number, y: number): PdfText {
  return { text, page: 1, x, y, width: text.length * 5, height: 8 }
}

function formulario(campos: [string, string][], fileName = 'ficha.pdf'): PdfSheet {
  return {
    fileName,
    pageCount: 1,
    fields: campos.map(([nome, valor], i) => campo(nome, valor, 760 - i * 16)),
    texts: []
  }
}

/**
 * Ficha de texto: uma linha "Rótulo: valor" por fragmento, como o Google Docs exporta. Cada linha
 * é um parágrafo próprio — 18 pontos de entrelinha com fonte de 8, acima do que `camposDoTexto`
 * junta como continuação do campo anterior (1,8 alturas).
 */
function documento(linhas: string[], fileName = 'ficha.pdf'): PdfSheet {
  return {
    fileName,
    pageCount: 1,
    fields: [],
    texts: linhas.map((linha, i) => texto(linha, 72, 760 - i * 18))
  }
}

const FICHA_JOGO_DO_ANO: [string, string][] = [
  ['Nome', 'Kaori'],
  ['Jogador', 'Nádia'],
  ['Raça', 'Qareen'],
  ['Classe', 'Arcanista'],
  ['Nível', '5'],
  ['Origem', 'Acólito'],
  ['Divindade', 'Wynna'],
  ['Força', '-1'],
  ['Destreza', '+2'],
  ['Constituição', '+1'],
  ['Inteligência', '+4'],
  ['Sabedoria', '+1'],
  ['Carisma', '+3'],
  ['PV atual', '22'],
  ['PV máximo', '38'],
  ['PM atual', '9'],
  ['PM máximo', '25'],
  ['Defesa', '15'],
  ['Deslocamento', '9m'],
  ['Misticismo', '+12'],
  ['Percepção', '+6'],
  ['Iniciativa', '+7'],
  ['Ofício (Alquimia)', '+9'],
  ['Arma 1', 'Adaga'],
  ['Teste 1', '+5'],
  ['Dano 1', '1d4+2'],
  ['Crítico 1', '19'],
  ['Arma 2', 'Bola de fogo'],
  ['Teste 2', ''],
  ['Dano 2', '6d6'],
  ['Crítico 2', ''],
  ['Arma 3', ''],
  ['Dano 3', ''],
  ['Poderes', 'Caminho do Arcanista (Mago); Foco em Magia'],
  ['Magias', 'Mísseis Mágicos, Bola de Fogo, Sono'],
  ['Equipamento', 'Grimório, mochila, 3 poções de cura'],
  ['Tibar', '145'],
  ['História', 'Cresceu no templo de Wynna em Valkaria.']
]

describe('leitor de Tormenta20 — formulário em português', () => {
  const sheet = formulario(FICHA_JOGO_DO_ANO)
  const lido = readSheet(sheet)

  it('reconhece pelo vocabulário do sistema, com acento e tudo, e nomeia o sistema', () => {
    expect(tormenta20Reader.detect(sheet)).toBeGreaterThanOrEqual(0.9)
    expect(lido.readerId).toBe('tormenta20')
    expect(lido.system).toBe('Tormenta20')
    expect(lido.characterName).toBe('Kaori')
  })

  it('agrupa como a ficha de Tormenta agrupa, mantendo o rótulo como está escrito', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Raça', value: 'Qareen', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Origem', value: 'Acólito', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Inteligência', value: '+4', group: 'Atributos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Defesa', value: '15', group: 'Combate' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Misticismo', value: '+12', group: 'Perícias' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Ofício (Alquimia)', value: '+9', group: 'Perícias' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Poderes', group: 'Habilidades' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Magias', group: 'Magia' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Tibar', value: '145', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'História', group: 'História' }))
  })

  it('na edição Jogo do Ano o atributo é o modificador: Inteligência +4 rola 1d20+4', () => {
    const inteligencia = lido.fields.find((c) => c.label === 'Inteligência')
    expect(inteligencia?.roll).toBe('d20')
    expect(rolagemDoCampo(inteligencia!.value, inteligencia!.roll)).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: [{ type: 'flat', value: 4 }]
    })
    // Perícia e Iniciativa (que em T20 é perícia) rolam d20 + o número.
    const iniciativa = lido.fields.find((c) => c.label === 'Iniciativa')
    expect(iniciativa?.roll).toBe('d20')
    expect(iniciativa?.group).toBe('Perícias')
  })

  it('PV e PM viram as duas barras da tela de rolagem, com atual e máximo', () => {
    const barras = extrairRecursos(lido.fields).map((r) => `${r.nome} ${r.atual}/${r.maximo}`)
    expect(barras).toEqual(['PV 22/38', 'PM 9/25'])
    // Atributo não vira barra, mesmo com número.
    expect(barras.some((b) => /Força|Destreza/.test(b))).toBe(false)
  })

  it('a grade de ataques vira uma linha por arma e os presets de teste e dano', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Adaga', value: '+5 · 1d4+2 · 19', group: 'Ataques' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Bola de fogo', value: '6d6', group: 'Ataques' }))
    // As células soltas da grade não sobram como campos "Teste 1 = +5".
    expect(lido.fields.some((c) => /^(Arma|Teste|Dano|Crítico) \d$/.test(c.label))).toBe(false)

    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Adaga (ataque)', kind: 'test' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Adaga (dano)', kind: 'damage' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Bola de fogo (dano)', kind: 'damage' }))
    // Sem o preset genérico "Dano 1" duplicando o da arma.
    expect(lido.presets.some((p) => /^Dano \d/.test(p.name))).toBe(false)
    const adaga = lido.presets.find((p) => p.name === 'Adaga (ataque)')
    expect(adaga?.expression).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 5 }] })
  })

  it('ficha com dono traz o esqueleto: cada perícia que faltou entra vazia, pra completar no app', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Acrobacia', value: '', group: 'Perícias', roll: 'd20' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Vontade', value: '', group: 'Perícias' }))
    // O que veio preenchido não ganha uma cópia vazia.
    expect(lido.fields.filter((c) => c.label === 'Misticismo')).toHaveLength(1)
    expect(lido.fields.filter((c) => /^Percep/.test(c.label))).toHaveLength(1)
    // PV/PM vieram: nada de "PV atual" vazio a mais.
    expect(lido.fields.filter((c) => c.label === 'PV atual')).toHaveLength(1)
  })
})

describe('leitor de Tormenta20 — edição de 2019, atributo como valor', () => {
  const sheet = formulario([
    ['Nome', 'Dário Sallum'],
    ['Raça', 'Minotauro'],
    ['Classe', 'Bárbaro'],
    ['Nível', '6'],
    ['FOR', '18'],
    ['DES', '12'],
    ['CON', '16'],
    ['INT', '8'],
    ['SAB', '10'],
    ['CAR', '9'],
    ['PV', '74'],
    ['PM', '12'],
    ['Defesa', '17'],
    ['Luta', '+11'],
    ['Ataque', 'Machado grande +11 3d6+6 20/x3']
  ])
  const lido = readSheet(sheet)

  it('as siglas FOR/DES/CON são atributos, e valor 18 rola o modificador (+4), não 1d20+18', () => {
    expect(lido.readerId).toBe('tormenta20')
    const forca = lido.fields.find((c) => c.label === 'FOR')
    expect(forca).toEqual(expect.objectContaining({ value: '18', group: 'Atributos', roll: 'd20-valor' }))
    expect(rolagemDoCampo('18', forca!.roll)).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: [{ type: 'flat', value: 4 }]
    })
  })

  it('PV e PM com um número só viram barra cheia', () => {
    const barras = extrairRecursos(lido.fields).map((r) => `${r.nome} ${r.atual}/${r.maximo}`)
    expect(barras).toEqual(['PV 74/74', 'PM 12/12'])
  })

  it('o ataque escrito numa célula só rende nome, teste, dano e crítico', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Machado grande', value: '+11 · 3d6+6 · 20/x3', group: 'Ataques' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Machado grande (ataque)', kind: 'test' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Machado grande (dano)', kind: 'damage' }))
    expect(lido.presets.some((p) => p.name === 'Ataque')).toBe(false)
  })
})

describe('leitor de Tormenta20 — documento de texto, sem formulário', () => {
  const sheet = documento([
    'TORMENTA20 — FICHA DE PERSONAGEM',
    'Nome: Valdo Brasa',
    'Raça: Anão',
    'Classe: Clérigo',
    'Nível: 3',
    'Divindade: Khalmyr',
    'Força: +2',
    'Destreza: 0',
    'Constituição: +3',
    'Inteligência: 0',
    'Sabedoria: +3',
    'Carisma: +1',
    'PV: 31/31',
    'PM: 7/12',
    'Defesa: 16',
    'Cura: +8',
    'Religião: +8',
    'Vontade: +6',
    'Maça +5 1d8+2',
    'Jurou proteger a forja do clã depois do incêndio.'
  ])
  const lido = readSheet(sheet)

  it('reconhece pelo título e pelos rótulos impressos', () => {
    expect(lido.readerId).toBe('tormenta20')
    expect(lido.characterName).toBe('Valdo Brasa')
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Divindade', value: 'Khalmyr', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Sabedoria', value: '+3', group: 'Atributos', roll: 'd20' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Cura', value: '+8', group: 'Perícias', roll: 'd20' }))
  })

  it('"PM: 7/12" vira a barra de mana com 7 de 12', () => {
    const barras = extrairRecursos(lido.fields).map((r) => `${r.nome} ${r.atual}/${r.maximo}`)
    expect(barras).toEqual(['PV 31/31', 'PM 7/12'])
  })

  it('o que o jogador escreveu fora de rótulo não se perde: vai como texto da ficha', () => {
    expect(lido.rawText).toContain('Jurou proteger a forja')
    // O título do modelo não é anotação de ninguém.
    expect(lido.rawText ?? '').not.toMatch(/TORMENTA20/)
  })

  it('a arma escrita solta ainda vira preset (pela regra que vale pra toda ficha)', () => {
    expect(lido.presets.some((p) => /Maça/.test(p.name) && p.kind !== 'test')).toBe(true)
  })
})

describe('leitor de Tormenta20 — o que ele NÃO reivindica', () => {
  it('ficha de D&D traduzida: os seis atributos em português não bastam sem uma marca de Tormenta', () => {
    const sheet = formulario([
      ['Nome', 'Go'],
      ['Raça', 'Goblin'],
      ['Classe', 'Ladino'],
      ['Nível', '3'],
      ['Força', '6'],
      ['Destreza', '16'],
      ['Constituição', '12'],
      ['Inteligência', '16'],
      ['Sabedoria', '13'],
      ['Carisma', '9'],
      ['PV', '18'],
      ['CA', '14'],
      ['Bônus de proficiência', '+2']
    ])
    expect(tormenta20Reader.detect(sheet)).toBe(0)
  })

  it('ficha de Ordem Paranormal em texto: PV, Origem e Classe são vocabulário compartilhado', () => {
    const sheet = documento([
      'Nome: Vincenzo',
      'Origem: Policial',
      'Classe: Combatente',
      'NEX: 25%',
      'Agilidade: 1',
      'Força: 3',
      'Intelecto: 1',
      'Presença: 2',
      'Vigor: 2',
      'PV: 30',
      'PE: 8',
      'Sanidade: 20',
      'Defesa: 14',
      'Luta: +10'
    ])
    expect(tormenta20Reader.detect(sheet)).toBe(0)
  })

  it('ficha genérica com "Mana" e "PV" não é Tormenta só por ter mana', () => {
    const sheet = formulario([
      ['Nome', 'Ada'],
      ['PV atual', '18'],
      ['PV máximo', '24'],
      ['Mana', '5 (12)']
    ])
    expect(tormenta20Reader.detect(sheet)).toBe(0)
  })

  it('modelo em branco: reconhece pelos nomes de campo, mas não inventa dono nem esqueleto', () => {
    const sheet = formulario(
      [
        ['Nome', ''],
        ['Raça', 'Escolha uma raça'],
        ['Classe', 'Escolha uma classe'],
        ['Força', ''],
        ['Destreza', ''],
        ['PV', ''],
        ['PM', '']
      ],
      'Ficha Tormenta20 editavel.pdf'
    )
    const lido = readSheet(sheet)
    expect(lido.readerId).toBe('tormenta20')
    expect(lido.characterName).toBe('')
    expect(lido.fields).toHaveLength(0)
    expect(lido.warnings).toContain('formulario-vazio')
  })
})

/**
 * A FICHA EDITÁVEL da comunidade, a que o testador trouxe (a do Milo, 02/09/2026): os nomes de
 * campo e os valores abaixo foram lidos do arquivo real com `scripts/dump-campos.mjs`. O que se
 * cobra é o que "ficou horrível" pelo caminho do vocabulário: a grade de perícias em células
 * numeradas, o `#C3#A1` nos nomes, os componentes da Defesa vazando como campos soltos.
 */
describe('leitor de Tormenta20 — a ficha editável da comunidade (a do Milo)', () => {
  const caixa = (name: string, marcada: boolean): PdfField => ({ name, type: 'checkbox', value: marcada ? 'Yes' : 'Off', page: 1, rect: [0, 0, 10, 10] })
  const sheet: PdfSheet = {
    fileName: 'Milo - T20.pdf',
    pageCount: 2,
    texts: [],
    fields: [
      campo('Nome do Personagem', 'Milo Alta-Colina Prato-Cheio'),
      campo('Nome do Jogador', 'Caio'),
      campo('Raca do Personagem', 'Halfling'),
      campo('Origem do Personagem', 'Capanga'),
      campo('Classe(s) do personagem', 'Ladino'),
      campo('Divindade', ''),
      campo('Lv', '5'),
      campo('SeleTamanho', 'Pequeno'),
      campo('ModFor', '2'),
      campo('ModDes', '2'),
      campo('ModCon', '1'),
      campo('ModInt', '1'),
      campo('ModSab', '2'),
      campo('ModCar', '4'),
      campo('Pontos de Vida m#C3#A1ximos', '29'),
      campo('Pontos de Vida atuais', '22'),
      campo('Pontos de Mana m#C3#A1ximos', '20'),
      campo('Pontos de Mana atuais', '20'),
      campo('CA', '14'),
      campo('Base CA', '10'),
      campo('SeleAtribDefe', 'Des'),
      campo('B.Arm', '2'),
      campo('B.Esc', '0'),
      campo('Outros B.CA', '0'),
      campo('Armadura', 'Armadura de Couro'),
      campo('B.Arm1', '2'),
      campo('Pa', '0'),
      campo('Deslocamento do personagem', '6'),
      campo('ModFurtTam', '2'),
      campo('ModManTam', '-2'),
      // Acrobacia (linha 01): metade do nível 2, sem treino, Destreza +2 → +4.
      campo('011', '2'), campo('013', '0'), campo('014', ''), campo('SeleAtribAcro', 'Des'), caixa('Mar Trei acro', false),
      // Enganação (linha 09): 2 + treino 2 + outros 2 + Carisma 4 → +10, treinada.
      campo('091', '2'), campo('093', '2'), campo('094', '2'), campo('SeleAtribEnga', 'Car'), caixa('Mar Trei enga', true),
      // Furtividade (linha 11): 2 + 2 + Destreza 2 + tamanho 2 → +8.
      campo('111', '2'), campo('113', '2'), campo('114', ''), campo('SeleAtribFurt', 'Des'), caixa('Mar Trei furti', true),
      // Pilotagem (linha 25): o arquivo guardou o total 6, e a conta dá o mesmo.
      campo('250', '6'), campo('251', '2'), campo('253', '2'), campo('254', ''), campo('SeleAtribPilo', 'Des'),
      campo('Ofício 1', '?'),
      campo('SeleAtribOfi1', 'Int'),
      campo('Ataque 1', 'Rapieira'),
      campo('Bonus do ataque 1', '6'),
      campo('Dano causado pelo ataque 1', '1d8'),
      campo('Margem de cr#C3#ADtico e multiplicador 1', '19'),
      campo('Tipo de dano do ataque 1', 'Perfuração'),
      campo('Alcance do ataque 1', '-'),
      campo('Ataque 2', ''),
      campo('Item 1', 'Anel de Sinete'),
      campo('Quantidade Item 1', '1'),
      campo('Slots Item 1', '0'),
      campo('Item 9', 'Poção de Cura Grande 2d4+4'),
      campo('Tibares', '5000'),
      campo('Carga Usada', '5'),
      campo('Limite de carga', ''),
      campo('Proficiencias e outras caracteristicas', 'Fala Comum e Hafling'),
      campo('Habilidades de raca e origem', 'Arremessador: Ataques com funda ganham mais 1 passo de dano'),
      campo('Magias', 'Imagem Espelhada - 1 PM, Dura a cena'),
      campo('SeleAtribMagia', 'Int'),
      campo('ModAtribMagia', '1')
    ]
  }
  const lido = readSheet(sheet)

  it('é reconhecida pelos nomes de campo do modelo, com confiança acima do vocabulário', () => {
    expect(tormenta20Reader.detect(sheet)).toBeGreaterThanOrEqual(0.95)
    expect(lido.readerId).toBe('tormenta20')
    expect(lido.characterName).toBe('Milo Alta-Colina Prato-Cheio')
  })

  it('identificação, atributos como modificador, PV/PM com o "#C3#A1" decodificado', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Raça', value: 'Halfling', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Classe', value: 'Ladino', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Nível', value: '5', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Divindade', value: '', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Carisma', value: '+4', group: 'Atributos', roll: 'd20' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'PV máximo', value: '29', group: 'Recursos' }))
    const barras = extrairRecursos(lido.fields).map((r) => `${r.nome} ${r.atual}/${r.maximo}`)
    expect(barras).toEqual(['PV 22/29', 'PM 20/20'])
    expect(lido.fields.some((c) => /#C3|m#/.test(c.label))).toBe(false)
  })

  it('a grade de perícias vira o total refeito: metade do nível + atributo escolhido + treino + outros', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Acrobacia', value: '+4', group: 'Perícias', roll: 'd20' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Enganação', value: '+10 (treinada)', group: 'Perícias' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Furtividade', value: '+8 (treinada)', group: 'Perícias' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Pilotagem', value: '+6', group: 'Perícias' }))
    // O "?" do ofício é impressão do modelo, não nome; e a linha sem nada vira lacuna (ficha com dono).
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Ofício 1', value: '', group: 'Perícias' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Vontade', value: '', group: 'Perícias' }))
    // As células numeradas e os seletores não sobram como campos soltos, nem viram texto sem rótulo.
    expect(lido.fields.some((c) => /^\d{3}$|SeleAtrib|Mar Trei|ModAtrib|Base CA|B\.Arm/.test(c.label))).toBe(false)
    expect(lido.rawText ?? '').toBe('')
  })

  it('Defesa com a armadura por extenso, e os componentes consumidos', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Defesa', value: '14', group: 'Combate' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Armadura', value: 'Armadura de Couro (Defesa +2)', group: 'Combate' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Modificadores de tamanho', value: 'Furtividade +2, manobras -2' }))
  })

  it('ataque vira uma linha e dois presets; item com dado vira preset com o nome do item', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Rapieira', value: '+6 · 1d8 · 19 · Perfuração', group: 'Ataques' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Rapieira (ataque)', kind: 'test' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Rapieira (dano)', kind: 'damage' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Poção de Cura Grande' }))
    expect(lido.presets.some((p) => /^(Item|Dano causado|Bonus)/.test(p.name))).toBe(false)
  })

  it('inventário com espaços, Tibares e carga; magia com o atributo-chave', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Anel de Sinete', value: '0 espaços', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Tibares', value: '5000', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Carga', value: '5', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Atributo-chave', value: 'Int (+1)', group: 'Magia' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Proficiências', group: 'Habilidades' }))
  })
})
