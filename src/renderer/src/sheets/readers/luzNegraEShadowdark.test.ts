import { describe, expect, it } from 'vitest'
import type { PdfField, PdfSheet } from '@shared/types/sheetImport'
import { extrairRecursos } from '@shared/types/extrairRecursos'
import { readSheet } from './index'
import { breuReader } from './breu'
import { tenebraReader } from './tenebra'
import { infaernumReader } from './infaernum'
import { shadowdarkReader } from './shadowdark'

/**
 * As fichas editáveis de Breu, Tenebra e Infaernum (Luz Negra) e a oficial de Shadowdark (Arcane
 * Library), baixadas em 02/09/2026 e sondadas campo a campo (`out/testar-no-app/rects.mjs`). Os
 * retângulos abaixo são os do arquivo real; os valores são de um personagem inventado. As três da
 * Luz Negra não têm texto impresso e nomeiam os campos por máquina, então é a POSIÇÃO que este
 * teste prova (ver `porPosicao.ts`); a de Shadowdark tem nome de campo, e é por ele.
 */
function texto(name: string, x: number, y: number, w: number, h: number, value: string, page = 1): PdfField {
  return { name, type: 'text', value, page, rect: [x, y, x + w, y + h] }
}

function caixa(name: string, x: number, y: number, marcada: boolean, page = 1, oculto = false): PdfField {
  return { name, type: 'checkbox', value: marcada ? 'Yes' : 'Off', page, rect: [x, y, x + 9, y + 9], ...(oculto ? { oculto: true } : {}) }
}

function ficha(fields: PdfField[], fileName = 'ficha.pdf', pageCount = 2): PdfSheet {
  return { fileName, pageCount, fields, texts: [] }
}

const barras = (fields: ReturnType<typeof readSheet>['fields']): string[] => extrairRecursos(fields).map((r) => `${r.nome} ${r.atual}/${r.maximo}`)

describe('Infaernum — a ficha editável oficial, pela posição', () => {
  const sheet = ficha(
    [
      texto('Text Field 1', 106, 504, 225, 43, 'Irene Salgado\nEx-freira do interior'),
      texto('Text Field 2', 20, 372, 86, 64, 'Fé inabalável'),
      texto('Text Field 3', 30, 227, 97, 69, 'Perde tudo no jogo'),
      texto('Text Field 4', 307, 265, 93, 152, 'Ouve os sinos da igreja que não existe mais'),
      texto('Text Field 7', 129, 347, 154, 43, 'Nunca mais dormirá em paz'),
      texto('Text Field 5', 156, 181, 132, 32, 'As portas se abrem para ela'),
      texto('Text Field 6', 105, 21, 217, 73, 'Lanterna a querosene\nFaca de cozinha'),
      { name: 'Check Box 1', type: 'checkbox', value: 'Yes', page: 1, rect: [127, 437, 139, 449] },
      { name: 'Check Box 4', type: 'checkbox', value: 'Yes', page: 1, rect: [153, 443, 165, 455] },
      { name: 'Check Box 5', type: 'checkbox', value: 'Off', page: 1, rect: [183, 450, 195, 462] },
      { name: 'Check Box 6', type: 'checkbox', value: 'Off', page: 1, rect: [216, 451, 228, 463] },
      { name: 'Check Box 7', type: 'checkbox', value: 'Off', page: 1, rect: [245, 449, 257, 461] },
      { name: 'Check Box 8', type: 'checkbox', value: 'Off', page: 1, rect: [271, 444, 283, 456] }
    ],
    'Infaernum - Irene.pdf',
    1
  )
  const lido = readSheet(sheet)

  it('reconhece pelas sete caixas no lugar delas, sem um fragmento de texto', () => {
    expect(infaernumReader.detect(sheet)).toBeGreaterThanOrEqual(0.9)
    expect(lido.readerId).toBe('infaernum')
    expect(lido.system).toBe('Infaernum')
    expect(lido.characterName).toBe('Irene Salgado')
  })

  it('cada caixa cai no lugar dela, e as Desgraças marcadas viram barra', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Sorte', value: 'Fé inabalável', group: 'Habilidades' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Azar', value: 'Perde tudo no jogo' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Bênção', value: 'As portas se abrem para ela' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Maldição', value: 'Nunca mais dormirá em paz' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Tormentos', group: 'História' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Lanterna a querosene', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Desgraças', value: '2/6', group: 'Recursos' }))
    expect(barras(lido.fields)).toEqual(['Desgraças 2/6'])
    // Nenhum "Text Field 4" sobra como rótulo, e nada vai pro texto sem rótulo.
    expect(lido.fields.some((c) => /Text Field|Check Box/.test(c.label))).toBe(false)
    expect(lido.rawText ?? '').toBe('')
  })
})

describe('Tenebra — a ficha editável oficial, pela posição e pelas caixas ocultas', () => {
  const gotas = (prefixo: string, inicio: number, xs: number[], y: number, marcadas: number): PdfField[] =>
    xs.map((x, i) => caixa(`${prefixo}${inicio + i}`, x, y, i < marcadas, 1, true))
  const sheet = ficha([
    texto('Campo de Texto0', 74, 710, 168, 60, 'Nadia Kess\n(a Fuinha)'),
    texto('Campo de Texto1', 80, 672, 71, 23, 'A Fuinha'),
    texto('Campo de Texto2', 155, 682, 71, 21, 'Sucateira'),
    texto('Campo de Texto3', 248, 685, 23, 22, '2'),
    ...gotas('fo', 0, [129, 145, 161, 176, 192], 625, 3),
    ...gotas('fo', 5, [130, 146, 162, 177, 193], 593, 2),
    ...gotas('fo', 10, [131, 147, 162, 178, 193], 560, 0),
    ...gotas('fo', 15, [132, 148, 163, 179, 195], 526, 5),
    caixa('fad0', 217, 625, true, 1, true),
    caixa('fad1', 218, 589, false, 1, true),
    // A Barra de Feridas tem duas camadas no mesmo lugar: `fr` (marcada) e `tr` (a de trauma, vazia).
    ...gotas('fr', 0, [105, 135, 167, 197, 228, 258], 460, 2),
    ...gotas('tr', 0, [106, 136, 167, 197, 228, 258], 460, 0),
    ...gotas('tr', 6, [105, 136, 166], 416, 1),
    texto('Campo de Texto4', 313, 516, 123, 16, 'Olho de vidro'),
    texto('Campo de Texto5', 314, 504, 122, 16, 'vê no escuro'),
    ...gotas('Oil', 0, [442, 458, 474, 489, 505], 502, 4),
    texto('Campo de Texto12', 125, 71, 167, 271, 'Faca enferrujada\nRádio quebrado\n\nCorda'),
    ...[68, 79, 91, 102, 113].map((x, i) => caixa(`Caixa de Seleção${58 + i}`, x, 322, i < 2)),
    ...[68, 79, 91, 102, 113].map((x, i) => caixa(`Caixa de Seleção${64 + i}`, x, 305, false)),
    texto('Campo de Texto13', 354, 71, 167, 271, 'Bomba de fumaça'),
    texto('Campo de Texto14', 77, 40, 18, 19, '3'),
    texto('Campo de Texto15', 111, 40, 18, 19, '1'),
    texto('Campo de Texto16', 147, 40, 18, 19, '0'),
    texto('Campo de Texto17', 53, 748, 133, 23, 'Tia Zefa', 2),
    texto('Campo de Texto23', 201, 748, 349, 23, 'Vende óleo bom', 2),
    texto('Campo de Texto29', 169, 529, 139, 14, 'Machadinha', 2),
    texto('Campo de Texto30', 373, 528, 167, 14, 'curta', 2),
    texto('Campo de Texto31', 175, 509, 366, 14, 'Quebra na segunda falha', 2),
    texto('Campo de Texto38', 105, 343, 138, 14, 'Faro de sucata', 2),
    texto('Campo de Texto39', 72, 318, 465, 28, 'Acha peça útil em qualquer lixão.', 2)
  ])
  const lido = readSheet(sheet)

  it('reconhece pelas caixas-âncora, e o nome é a primeira linha da Assinatura', () => {
    expect(tenebraReader.detect(sheet)).toBeGreaterThanOrEqual(0.9)
    expect(lido.readerId).toBe('tenebra')
    expect(lido.characterName).toBe('Nadia Kess')
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Estirpe', value: 'Sucateira', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Nível de vivência', value: '2' }))
  })

  it('as Gotas de Suor saem das caixas ocultas, viram barra por Disposição, e a Fadiga vira linha', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Fôlego', value: '3/5', group: 'Disposições' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Equilíbrio', value: '2/5' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Lucidez', value: '5/5' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Fadiga', value: 'Fôlego' }))
    expect(barras(lido.fields)).toEqual(['Fôlego 3/5', 'Equilíbrio 2/5', 'Raciocínio 0/5', 'Lucidez 5/5', 'Feridas 2/6', 'Proteção 1/3'])
  })

  it('a Barra de Feridas conta só a camada marcada, e não dobra pela camada de trauma vazia', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Feridas', value: '2/6', group: 'Recursos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Proteção', value: '1/3' }))
  })

  it('biosucata com óleo, bolsos linha a linha com os estragos da fileira, trecos e tralhas', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Olho de vidro vê no escuro', value: 'óleo 4/5', group: 'Biosucatas' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Faca enferrujada', value: 'estragos 2/5', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Rádio quebrado', value: '' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Sabe montar: Bomba de fumaça' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Quantidade de tralhas', value: '3 / 1 / 0' }))
  })

  it('página 2: contatos, armas com a Sina, habilidades e traços', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Tia Zefa', value: 'Vende óleo bom', group: 'Contatos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Machadinha', value: 'distância curta · sina: Quebra na segunda falha', group: 'Armas' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Faro de sucata', value: 'Acha peça útil em qualquer lixão.', group: 'Habilidades' }))
    expect(lido.fields.some((c) => /Campo de Texto|Caixa de Sele/.test(c.label))).toBe(false)
    expect(lido.rawText ?? '').toBe('')
  })
})

describe('Breu — a ficha editável oficial (modelo Geral), pela posição', () => {
  const t = (nome: string, x: number, y: number, w: number, h: number, value: string, page = 1): PdfField => texto(`Text1.${nome}`, x, y, w, h, value, page)
  const sheet = ficha([
    t('nome', 60, 682, 266, 17, 'Odete Brasa'),
    t('classe', 356, 682, 131, 17, 'Combatente'),
    t('xp', 499, 682, 56, 17, '120'),
    t('eusou', 88, 664, 152, 17, 'mercenária'),
    t('bomem', 281, 664, 274, 17, 'intimidar'),
    t('busca', 88, 647, 468, 17, 'vingança'),
    t('heranca', 116, 629, 439, 17, 'Humana, cicatriz no rosto'),
    t('for', 45, 547, 40, 33, '16'), t('formod', 49, 507, 31, 24, '+3'), caixa('Check Box2.0.0', 61, 534, true),
    t('des', 105, 548, 40, 32, '12'), t('desmod', 110, 507, 31, 24, '+1'), caixa('Check Box2.1', 121, 534, false),
    t('con', 166, 548, 40, 32, '14'), t('conmod', 170, 507, 31, 24, '+2'), caixa('Check Box2.2', 181, 534, true),
    t('int', 226, 548, 40, 32, '8'), t('intmod', 230, 507, 31, 24, '-1'), caixa('Check Box2.3', 242, 534, false),
    t('sab', 286, 548, 40, 32, '10'), t('sabmod', 291, 507, 31, 24, '0'), caixa('Check Box2.4', 302, 534, false),
    t('car', 347, 548, 40, 32, '11'), t('carmod', 351, 507, 31, 24, '0'), caixa('Check Box2.5.0', 362, 534, false),
    t('prof', 100, 463, 28, 21, '2'),
    t('casem', 181, 467, 24, 17, '11'),
    t('cacom', 208, 467, 24, 17, '14'),
    t('desloc', 304, 467, 87, 17, '9m'),
    t('pvmax', 76, 429, 35, 17, '22'),
    t('pvatual', 112, 429, 35, 17, '15'),
    t('dv', 192, 429, 100, 17, '3d10'),
    t('dvusados', 300, 429, 89, 17, '1'),
    t('cargamax', 415, 430, 33, 17, '17'),
    t('cargaatual', 493, 430, 25, 17, '9'),
    t('prata', 339, 387, 50, 17, '35'),
    t('deb1', 414, 567, 73, 17, 'Perna manca'),
    caixa('Check Box2.5.1.1.0.0', 488, 572, true), caixa('Check Box2.5.1.1.1.0', 499, 572, true), caixa('Check Box2.5.1.1.2.0', 509, 572, false),
    t('ben1', 49, 369, 350, 17, 'Ataque extra'),
    t('arma1', 38, 154, 128, 16, 'Machado grande'), t('mod1', 168, 154, 30, 16, '+5'), t('dano1', 199, 154, 45, 16, '1d12+3'), t('obs1', 246, 154, 145, 16, 'duas mãos'),
    t('armad1', 38, 64, 128, 16, 'Arco curto'), t('modd1', 168, 64, 30, 16, '+3'), t('danod1', 199, 64, 45, 16, '1d6+1'), t('mun1', 244, 64, 45, 16, '20'),
    t('mochila', 408, 314, 113, 17, 'Mochila de couro'), t('mochilac1', 523, 314, 16, 17, '2'), t('mochilac2', 542, 314, 16, 17, '6'),
    t('item1', 408, 182, 113, 17, 'Corda'), t('item1c', 523, 182, 16, 17, '1'),
    t('magia1', 38, 529, 288, 17, 'Luz', 2), t('circ1', 328, 529, 30, 17, '1', 2), t('pag1', 361, 529, 31, 17, '88', 2),
    t('teste', 142, 642, 40, 33, '+4', 2),
    texto('Text3.7.0.1.16.1', 37, 16, 358, 262, 'Deve 10 pratas ao ferreiro.', 2)
  ])
  const lido = readSheet(sheet)

  it('reconhece pelos treze retângulos-âncora (nome, seis valores, seis modificadores)', () => {
    expect(breuReader.detect(sheet)).toBeGreaterThanOrEqual(0.9)
    expect(lido.readerId).toBe('breu')
    expect(lido.system).toBe('Breu')
    expect(lido.characterName).toBe('Odete Brasa')
  })

  it('atributos com valor e modificador, TR proficientes numa linha, proficiência e proteções', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Força', value: '16 (+3)', group: 'Atributos', roll: 'd20-valor' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Inteligência', value: '8 (-1)' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Testes de resistência', value: 'FOR, CON', group: 'Combate' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Bônus de proficiência', value: '+2' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'CA com armadura', value: '14' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Deslocamento', value: '9m' }))
  })

  it('PV vira barra; Dados de Vida, debilidade com a gravidade, benefício de classe', () => {
    // A carga em pontos também é par ("9/17"), e vira barra: é o que se enche ao pegar tralha.
    expect(barras(lido.fields)).toEqual(['PV 15/22', 'Carga 9/17'])
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Dados de Vida', value: '3d10', group: 'Recursos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Debilidade 1', value: 'Perna manca (pesada)', group: 'Debilidades' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Benefício de classe 1', value: 'Ataque extra', group: 'Habilidades' }))
  })

  it('ataques corpo a corpo e à distância viram linha e presets', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Machado grande', value: '+5 · 1d12+3 · duas mãos', group: 'Ataques' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Arco curto (à distância)', value: '+3 · 1d6+1 · munição 20' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Machado grande (ataque)', kind: 'test' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Machado grande (dano)', kind: 'damage' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Arco curto (dano)', kind: 'damage' }))
  })

  it('inventário com carga em pontos, prata, magia com círculo e página, notas', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Mochila: Mochila de couro', value: 'carga 2/6', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Corda', value: 'carga 1' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Carga', value: '9/17' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Prata', value: '35' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Luz', value: '1º círculo, p. 88', group: 'Magia' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Teste mágico', value: '+4', roll: 'd20' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Notas', value: 'Deve 10 pratas ao ferreiro.', group: 'História' }))
    expect(lido.fields.some((c) => /^Text1|Check Box/.test(c.label))).toBe(false)
    expect(lido.rawText ?? '').toBe('')
  })
})

describe('Shadowdark — a ficha oficial, pelo nome dos campos, traduzida pro idioma de quem joga', () => {
  const campo = (name: string, value: string): PdfField => ({ name, type: 'text', value, page: 1, rect: [0, 0, 10, 10] })
  const sheet = ficha(
    [
      campo('Name', 'Thorn'),
      campo('Race', 'Elf'),
      campo('Class', 'Thief'),
      campo('Level', '3'),
      campo('XP Current', '5'),
      campo('XP Target', '30'),
      campo('Title', 'Footpad'),
      campo('Alignment', 'Neutral'),
      campo('Background', 'Urchin'),
      campo('Deity', ''),
      campo('Strength Total', '12'), campo('Strength Modifier', '+1'),
      campo('Dexterity Total', '16'), campo('Dexterity Modifier', '+3'),
      campo('Constitution Total', '10'), campo('Constitution Modifier', '0'),
      campo('Intelligence Total', '13'), campo('Intelligence Modifier', '+1'),
      campo('Wisdom Total', '9'), campo('Wisdom Modifier', '-1'),
      campo('Charisma Total', '14'), campo('Charisma Modifier', '+2'),
      campo('Hit Points', '11'),
      campo('Armor Class', '13'),
      campo('Attacks', 'Dagger +3, 1d4\nShortbow +3 (1d4)'),
      campo('Talents / Spells', 'Backstab: +1d6 damage when attacking an unaware target'),
      campo('Gold Pieces', '12'),
      campo('Silver Pieces', '0'),
      campo('Copper Pieces', '5'),
      campo('Gear 1', 'Dagger'),
      campo('Gear 2', 'Shortbow'),
      campo('Gear 3', ''),
      campo('Free To Carry', '8')
    ],
    'thorn.pdf',
    1
  )
  const lido = readSheet(sheet)

  it('reconhece pelos nomes de campo da ficha oficial', () => {
    expect(shadowdarkReader.detect(sheet)).toBeGreaterThanOrEqual(0.9)
    expect(lido.readerId).toBe('shadowdark')
    expect(lido.system).toBe('Shadowdark')
    expect(lido.characterName).toBe('Thorn')
  })

  it('em português: identificação, atributos pelo valor (rolam o modificador), PV como barra', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Ancestralidade', value: 'Elf', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Título', value: 'Footpad' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'XP', value: '5/30' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Destreza', value: '16', group: 'Atributos', roll: 'd20-valor' }))
    // "XP 5/30" é par, e vira barra: a que enche até o próximo nível.
    expect(barras(lido.fields)).toEqual(['XP 5/30', 'PV 11/11'])
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'CA', value: '13', group: 'Combate' }))
  })

  it('os ataques em prosa viram uma linha por arma e os presets de teste e dano', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Dagger', value: '+3, 1d4', group: 'Ataques' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Dagger (ataque)', kind: 'test' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Dagger (dano)', kind: 'damage' }))
    expect(lido.presets).toContainEqual(expect.objectContaining({ name: 'Shortbow (dano)', kind: 'damage' }))
  })

  it('equipamento item a item, moedas sem as zeradas, espaços livres, talentos no bloco de habilidades', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Dagger', value: '', group: 'Equipamento' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Moedas', value: '12 ouro, 5 cobre' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Espaços livres', value: '8' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Talentos e magias', group: 'Talentos e magias' }))
  })

  it('em inglês os rótulos são os da ficha', () => {
    const ingles = readSheet(sheet, 'en-US')
    expect(ingles.fields).toContainEqual(expect.objectContaining({ label: 'Ancestry', value: 'Elf', group: 'Identity' }))
    expect(ingles.fields).toContainEqual(expect.objectContaining({ label: 'HP', value: '11', group: 'Resources' }))
    expect(ingles.fields).toContainEqual(expect.objectContaining({ label: 'Coins', value: '12 gp, 5 cp' }))
  })
})

describe('o que os quatro NÃO reivindicam', () => {
  it('uma ficha de formulário qualquer com campos em outros lugares fica no genérico', () => {
    const sheet = ficha([
      texto('Nome', 100, 760, 200, 20, 'Zilda'),
      texto('Força', 100, 700, 40, 20, '14'),
      texto('PV', 100, 640, 40, 20, '20')
    ])
    expect(breuReader.detect(sheet)).toBe(0)
    expect(tenebraReader.detect(sheet)).toBe(0)
    expect(infaernumReader.detect(sheet)).toBe(0)
    expect(shadowdarkReader.detect(sheet)).toBe(0)
    expect(readSheet(sheet).readerId).toBe('generico')
  })
})
