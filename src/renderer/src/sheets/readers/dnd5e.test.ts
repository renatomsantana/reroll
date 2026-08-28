import { describe, expect, it } from 'vitest'
import type { PdfField, PdfSheet } from '@shared/types/sheetImport'
import { montarFicha } from '@shared/types/montarFicha'
import { readSheet } from './index'
import { dnd5eReader } from './dnd5e'
import { ordemParanormalReader } from './ordemParanormal'

/**
 * O leitor de D&D 5e, contra fichas montadas à mão.
 *
 * Os nomes de campo usados aqui são os do formulário oficial da Wizards, com os espaços tortos que
 * ele tem de verdade (`Race `, `Wpn2 AtkBonus `, `Wpn3 AtkBonus  ` com dois). Não são invenção do
 * teste: são a razão de o leitor normalizar todo nome antes de comparar, e um teste que usasse os
 * nomes "arrumados" passaria enquanto a ficha real do usuário falharia.
 *
 * Não há PDF de D&D no repositório — nem haveria, é material da editora —, e é exatamente por isso
 * que o desenho do importador manda o leitor ser função PURA de `PdfSheet` (ver `readers/types.ts`).
 */

function campo(name: string, value: string, type = 'text'): PdfField {
  return { name, type, value, page: 1, rect: [0, 0, 10, 10] }
}

function ficha(fields: PdfField[], fileName = 'ficha 5e.pdf'): PdfSheet {
  // Sem texto impresso NENHUM, que é como a ficha oficial se parece pro extrator: os nomes dos
  // campos ("FORÇA", "Percepção") são desenho da página, não texto. Ver o comentário de `dnd5e.ts`.
  return { fileName, pageCount: 3, fields, texts: [] }
}

const ATRIBUTOS = [
  campo('STR', '8'),
  campo('DEX', '16'),
  campo('CON', '14'),
  campo('INT', '12'),
  campo('WIS', '10'),
  campo('CHA', '18')
]

const MARCAS = [campo('ProfBonus', '+3'), campo('AC', '15'), campo('HPMax', '38')]

const PERSONAGEM = ficha([
  campo('CharacterName', 'Thalia Corvo'),
  campo('ClassLevel', 'Bruxa 5'),
  campo('Background', 'Forasteira'),
  campo('PlayerName', 'Renato'),
  campo('Race ', 'Meio-elfa'),
  campo('Alignment', 'Caótica e boa'),
  ...ATRIBUTOS,
  ...MARCAS,
  campo('ST Dexterity', '+3'),
  campo('ST Charisma', '+7'),
  campo('Perception ', '+2'),
  campo('Deception ', '+7'),
  campo('SleightofHand', '+6'),
  campo('Initiative', '+3'),
  campo('Speed', '9m'),
  campo('HPCurrent', '31'),
  campo('Wpn Name', 'Adaga'),
  campo('Wpn1 AtkBonus', '+6'),
  campo('Wpn1 Damage', '1d4+3 perfurante'),
  campo('Wpn Name 2', 'Rajada Sobrenatural'),
  campo('Wpn2 AtkBonus ', '+7'),
  campo('Wpn2 Damage ', '1d10 de energia'),
  campo('Equipment', 'Adaga, foco arcano, mochila'),
  campo('GP', '25'),
  campo('SP', '0'),
  campo('Features and Traits', 'Presença sobrenatural. Visão no escuro 18m.'),
  campo('Backstory', 'Cresceu na estrada, jurou a um patrono que nunca viu.'),
  campo('Flaws', 'Não confia em ninguém que sorria demais.')
])

describe('reconhecimento da ficha de D&D 5e', () => {
  it('reconhece pela combinação de nomes de campo, e não por um só', () => {
    expect(dnd5eReader.detect(PERSONAGEM)).toBeGreaterThan(0.9)
    expect(readSheet(PERSONAGEM).readerId).toBe('dnd5e')
    expect(readSheet(PERSONAGEM).system).toBe('D&D 5e')
  })

  it('NÃO reivindica a ficha de outro sistema d20 que só repete os seis atributos', () => {
    /**
     * Pathfinder, Tormenta, os OSR — todos chamam os atributos de STR/DEX/CON/INT/WIS/CHA. Se o
     * leitor pegasse a ficha por causa disso, o jogador veria a própria ficha traduzida pra
     * nomenclatura de D&D: "Antecedente", "Tendência", "CD das magias". Errado com cara de certo,
     * que é o pior desfecho do importador.
     */
    const outroSistema = ficha([...ATRIBUTOS, campo('Heranca', 'Anão'), campo('Pericias', 'Ofício')])
    expect(dnd5eReader.detect(outroSistema)).toBe(0)
    expect(readSheet(outroSistema).readerId).toBe('generico')
  })

  it('não briga com a ficha de Ordem Paranormal', () => {
    const ordem = ficha([
      campo('Personagem', 'Matias'),
      campo('AGI', '1'),
      campo('FOR', '3'),
      campo('INT', '2'),
      campo('PRE', '4'),
      campo('VIG', '2'),
      campo('Atq1.0.0.0.0', 'Faca'),
      campo('Atq1.0.0.0.1', '2d20'),
      campo('Atq1.0.0.0.2', '2d6')
    ])
    expect(dnd5eReader.detect(ordem)).toBe(0)
    expect(ordemParanormalReader.detect(ordem)).toBeGreaterThan(0.9)
  })

  it('ficha em BRANCO é reconhecida como 5e e avisa que está vazia, sem propor nome', () => {
    /**
     * O erro de importação mais comum que existe: baixar a ficha oficial e importar antes de
     * preencher. O leitor tem que dizer isso — e nunca propor o NOME DO ARQUIVO como nome do
     * personagem, senão o app oferece criar alguém chamado "DnD_5E_CharacterSheet".
     */
    const branca = ficha(
      [...ATRIBUTOS.map((c) => campo(c.name, '')), campo('ProfBonus', ''), campo('AC', ''), campo('HPMax', '')],
      'DnD_5E_CharacterSheet - Form Fillable.pdf'
    )
    const lido = readSheet(branca)
    expect(lido.readerId).toBe('dnd5e')
    expect(lido.characterName).toBe('')
    expect(lido.presets).toEqual([])
    expect(lido.warnings).toContain('dnd5e-modelo-em-branco')
  })
})

describe('o que a ficha de D&D 5e entrega', () => {
  const lido = readSheet(PERSONAGEM)
  /**
   * Índice por GRUPO + rótulo, e não por rótulo só: em D&D "Destreza" e "Carisma" existem duas
   * vezes na mesma ficha, uma como atributo e outra como salvaguarda. Um índice por rótulo ficaria
   * com a última e o teste falaria da linha errada.
   */
  const porRotulo = new Map(lido.fields.map((c) => [`${c.group}/${c.label}`, c]))

  it('traz identificação, combate e inventário com os nomes do sistema', () => {
    expect(lido.characterName).toBe('Thalia Corvo')
    expect(porRotulo.get('Identificação/Classe e nível')?.value).toBe('Bruxa 5')
    // `Race ` tem espaço no fim no arquivo oficial — é o caso que o casamento cru perderia.
    expect(porRotulo.get('Identificação/Raça')?.value).toBe('Meio-elfa')
    expect(porRotulo.get('Identificação/Jogador')?.value).toBe('Renato')
    expect(porRotulo.get('Combate/CA')?.group).toBe('Combate')
    expect(porRotulo.get('Inventário/Equipamento')?.group).toBe('Inventário')
  })

  it('o dinheiro vira UMA linha, e a moeda zerada fica de fora', () => {
    // Cinco campos de uma letra ("GP", "SP") viram cinco linhas ilegíveis na conferência; e "0 PP"
    // não é informação sobre o personagem, é uma caixa que ninguém apagou.
    expect(porRotulo.get('Inventário/Dinheiro')?.value).toBe('25 PO')
  })

  it('cada atributo é o VALOR da ficha, e rola o modificador calculado dele', () => {
    /**
     * A ficha mostra 8 e 18 porque é o que está escrito no papel do jogador — trocar por "-1" e "+4"
     * faria ele não reconhecer a própria ficha. Quem sabe a conta é a rolagem (ver `d20-valor` em
     * `sheetRoll.ts`), e ela sai do valor ATUAL do campo, então subir de nível na ficha já muda o
     * dado sem reimportar nada.
     */
    expect(porRotulo.get('Atributos/Força')).toEqual({ label: 'Força', value: '8', group: 'Atributos', roll: 'd20-valor' })
    expect(porRotulo.get('Atributos/Carisma')?.value).toBe('18')
    expect(porRotulo.get('Atributos/Carisma')?.roll).toBe('d20-valor')
  })

  it('salvaguardas e perícias são bônus, e rolam somando ao d20', () => {
    expect(porRotulo.get('Perícias/Enganação')).toEqual({
      label: 'Enganação',
      value: '+7',
      group: 'Perícias',
      roll: 'd20'
    })
    // Salvaguarda e perícia têm o mesmo nome em D&D ("Destreza"), e por isso vivem em GRUPOS
    // diferentes: na ficha elas viram duas seções, cada uma com o nome do sistema.
    const salvaguardas = lido.fields.filter((c) => c.group === 'Salvaguardas' && c.value).map((c) => c.label)
    expect(salvaguardas).toEqual(['Destreza', 'Carisma'])
    // Três perícias PREENCHIDAS — as outras quinze vêm como lacuna, ver o teste do esqueleto.
    expect(lido.fields.filter((c) => c.group === 'Perícias' && c.value)).toHaveLength(3)
  })

  it('a ficha COM DONO traz o esqueleto inteiro como lacuna; o modelo em branco, não', () => {
    /**
     * Pedido do usuário: "coloca lacunas para TUDO que é preenchível, porque às vezes precisamos
     * preencher no app também mesmo que não tenha, porque é um item novo na sessão". A ficha de
     * D&D tem dezoito perícias e ninguém treina todas — mas a que não está treinada hoje pode estar
     * na próxima sessão, e sem a linha não há onde escrever. O leitor de Ordem Paranormal já fazia
     * isso; este descartava o que estivesse em branco.
     */
    const pericias = lido.fields.filter((c) => c.group === 'Perícias')
    expect(pericias).toHaveLength(18)
    expect(pericias.filter((c) => c.value === '')).toHaveLength(15)
    expect(lido.fields.filter((c) => c.group === 'Salvaguardas')).toHaveLength(6)
    // A lacuna continua rolando: quando a pessoa preencher, o botão de dado já está lá.
    expect(pericias.every((c) => c.roll === 'd20')).toBe(true)

    // O corte é o nome: o modelo em branco (sem `CharacterName`) não ganha quarenta linhas vazias.
    const emBranco = readSheet(ficha([...ATRIBUTOS, ...MARCAS]))
    expect(emBranco.fields.filter((c) => c.group === 'Perícias')).toEqual([])
  })

  it('a iniciativa rola, e a CA e o deslocamento NÃO', () => {
    // O botão de dado sai do campo, e não da seção: um dado ao lado da Classe de Armadura rolaria
    // uma coisa que não existe no sistema.
    expect(porRotulo.get('Combate/Iniciativa')?.roll).toBe('d20')
    expect(porRotulo.get('Combate/CA')?.roll).toBeUndefined()
    expect(porRotulo.get('Combate/Deslocamento')?.roll).toBeUndefined()
  })

  it('cada arma vira ataque e dano separados, com o nome dela na frente', () => {
    const presets = new Map(lido.presets.map((p) => [p.name, p]))
    expect(presets.get('Adaga (ataque)')?.expression).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: [{ type: 'flat', value: 6 }]
    })
    expect(presets.get('Adaga (dano)')?.expression).toEqual({
      groups: [{ sides: 4, count: 1 }],
      modifiers: [{ type: 'flat', value: 3 }]
    })
    // A segunda arma tem espaço a mais em DOIS nomes de campo (`Wpn2 AtkBonus `, `Wpn2 Damage `).
    expect(presets.get('Rajada Sobrenatural (ataque)')?.expression.modifiers).toEqual([
      { type: 'flat', value: 7 }
    ])
    expect(presets.get('Rajada Sobrenatural (dano)')?.expression.groups).toEqual([
      { sides: 10, count: 1 }
    ])
    // A linha 3 está vazia e não vira preset fantasma.
    expect(lido.presets).toHaveLength(4)
  })

  it('os textos longos vão pros blocos, e não viram linha de formulário', () => {
    expect(porRotulo.get('Habilidades/Características')?.group).toBe('Habilidades')
    expect(porRotulo.get('História/História')?.group).toBe('História')
    expect(porRotulo.get('História/Fraquezas')?.group).toBe('História')
  })

  it('não traz o lixo do formulário — caixa de seleção numerada e campo sem nome', () => {
    /**
     * A ficha oficial tem dezenas de `Check Box 11`, `Spells 1014`, `1_2`. O leitor genérico
     * produziria uma linha pra cada um, e o usuário já disse o que essa lista vira: "fica uma
     * bagunça, não dá para entender".
     */
    const comLixo = ficha([
      ...PERSONAGEM.fields,
      campo('Check Box 11', 'On', 'checkbox'),
      campo('Spells 1014', 'Mísseis Mágicos'),
      campo('1_2', '7')
    ])
    const lidoComLixo = readSheet(comLixo)
    expect(lidoComLixo.fields.some((c) => /^Check Box|^Spells |^1_2$/.test(c.label))).toBe(false)
    // A magia NÃO se perde: sem cabeçalho de nível acima dela, é truque (ver `magiasPorNivel`).
    expect(lidoComLixo.fields.find((c) => c.label === 'Truques')).toMatchObject({ value: 'Mísseis Mágicos', group: 'Magia' })
    expect(lidoComLixo.warnings).not.toContain('dnd5e-magias-sem-nome')
  })
})

describe('a mesma ficha com a interface em INGLÊS', () => {
  /**
   * D&D é publicado em inglês, e os nomes de campo que este leitor reconhece são do arquivo oficial
   * — então o rótulo que vai pra tela é escolha nossa, e não do arquivo. Com rótulo fixo em
   * português, ou o jogador brasileiro lia "Deception" ou o americano lia "Enganação"; um dos dois
   * estava sempre lendo a ficha na língua errada.
   *
   * Os leitores de Ordem Paranormal e de Oblivio NÃO fazem isso, e o motivo está em
   * `readers/types.ts`: lá o rótulo é o que está impresso na ficha, e traduzir faria a tela deixar
   * de bater com o papel na mão da pessoa.
   */
  const lido = readSheet(PERSONAGEM, 'en-US')
  const porChave = new Map(lido.fields.map((c) => [`${c.group}/${c.label}`, c]))

  it('rotula campos e seções em inglês, sem mexer no que foi lido', () => {
    expect(porChave.get('Attributes/Charisma')?.value).toBe('18')
    expect(porChave.get('Skills/Deception')?.value).toBe('+7')
    expect(porChave.get('Skills/Sleight of Hand')?.value).toBe('+6')
    expect(porChave.get('Saving Throws/Dexterity')?.value).toBe('+3')
    expect(porChave.get('Identity/Class & Level')?.value).toBe('Bruxa 5')
    expect(porChave.get('Combat/Max HP')?.value).toBe('38')
    expect(porChave.get('Equipment/Money')?.value).toBe('25 gp')
  })

  it('a regra de rolagem é a mesma — o idioma muda o rótulo, não o dado', () => {
    expect(porChave.get('Attributes/Charisma')?.roll).toBe('d20-valor')
    expect(porChave.get('Skills/Deception')?.roll).toBe('d20')
    expect(porChave.get('Combat/AC')?.roll).toBeUndefined()
  })

  it('os presets de arma também', () => {
    const nomes = lido.presets.map((p) => p.name)
    expect(nomes).toContain('Adaga (attack)')
    expect(nomes).toContain('Adaga (damage)')
    // O nome da ARMA é o que a pessoa escreveu na ficha, e continua como está: traduzir o conteúdo
    // dela seria outra coisa, e errada.
    expect(nomes.every((n) => !n.includes('(ataque)'))).toBe(true)
  })

  it('os grupos em inglês caem nos mesmos blocos da ficha', () => {
    // A prova de ponta a ponta do que `sheetBlocks.ts` promete: "Equipment" e "Features" são bloco
    // de texto, "Attributes" e "Skills" são quadro de valores.
    const ficha = montarFicha(lido.fields)
    expect(ficha.blocks.inventory).toContain('Adaga, foco arcano')
    expect(ficha.blocks.abilities).toContain('Presença sobrenatural')
    expect(ficha.sections.map((s) => s.title)).toEqual(
      expect.arrayContaining(['Identity', 'Attributes', 'Skills', 'Combat'])
    )
  })
})

describe('atributo de D&D preenchido de todo jeito', () => {
  /**
   * A ficha oficial não calcula nada: quem preenche digita o valor numa caixa e o modificador na
   * outra, e na prática se vê de tudo. Estes três casos foram vistos em fichas de mesa.
   */
  function atributo(campos: PdfField[]) {
    const lido = readSheet(ficha([...campos, ...MARCAS, campo('CharacterName', 'Alguém')]))
    return lido.fields.find((c) => c.label === 'Força')
  }

  it('só o VALOR preenchido: mostra o valor e rola o modificador calculado', () => {
    const seis = [campo('STR', '16'), campo('DEX', ''), campo('CON', ''), campo('INT', ''), campo('WIS', ''), campo('CHA', '')]
    expect(atributo(seis)).toEqual({ label: 'Força', value: '16', group: 'Atributos', roll: 'd20-valor' })
  })

  it('só o MODIFICADOR preenchido: mostra ele e soma direto', () => {
    const seis = [campo('STR', ''), campo('STRmod', '+3'), campo('DEX', ''), campo('CON', ''), campo('INT', ''), campo('WIS', ''), campo('CHA', '')]
    expect(atributo(seis)).toEqual({ label: 'Força', value: '+3', group: 'Atributos', roll: 'd20' })
  })

  it('modificador digitado na caixa do valor: tratado como modificador', () => {
    // "+3" na caixa grande está fora da faixa de 3 a 30 que o sistema permite pra um atributo —
    // e é o que acontece quando a pessoa preenche a ficha pensando na hora de rolar.
    const seis = [campo('STR', '+3'), campo('DEX', ''), campo('CON', ''), campo('INT', ''), campo('WIS', ''), campo('CHA', '')]
    expect(atributo(seis)?.roll).toBe('d20')
  })
})

/**
 * O JEITO ESPECÍFICO da ficha oficial de D&D: as magias moram em campos sem nome (`Spells 1014`),
 * e o que diz o nível delas é a POSIÇÃO na página de conjuração — pedido do usuário: cada sistema
 * raspado "igual o de Oblívio, cada um com seu jeito específico dependendo do PDF".
 */
describe('as magias da página de conjuração, lidas pela posição', () => {
  function campoEm(name: string, value: string, rect: [number, number, number, number], page = 3): PdfField {
    return { name, type: 'text', value, page, rect }
  }
  // Retângulos MEDIDOS na ficha do Go: três colunas (x 40, 230, 417), cabeçalho `SlotsTotal N` por nível.
  const PAGINA_DE_MAGIA = [
    campoEm('SlotsTotal 19', '3', [52, 457, 91, 478]),
    campoEm('SlotsTotal 20', '', [52, 229, 91, 250]),
    campoEm('SlotsTotal 21', '', [241, 625, 280, 646]),
    campoEm('Spells 1014', 'mãos mágicas', [40, 607, 199, 620]),
    campoEm('Spells 1016', 'raio de fogo', [40, 594, 199, 606]),
    campoEm('Spells 1015', 'flash', [41, 422, 199, 432]),
    campoEm('Spells 1023', 'mísseis mágicos', [41, 408, 199, 418]),
    campoEm('Spells 1034', 'invisibilidade', [41, 200, 199, 210]),
    campoEm('Spells 1048', 'bola de fogo', [230, 606, 388, 616])
  ]
  const lido = readSheet(ficha([...PERSONAGEM.fields, ...PAGINA_DE_MAGIA]))
  const porRotulo = new Map(lido.fields.filter((c) => c.group === 'Magia').map((c) => [c.label, c.value]))

  it('acima do primeiro cabeçalho da coluna é truque; abaixo de cada cabeçalho é o nível dele', () => {
    expect(porRotulo.get('Truques')).toBe('mãos mágicas, raio de fogo')
    expect(porRotulo.get('Magias de nível 1 (3 espaços)')).toBe('flash, mísseis mágicos')
    expect(porRotulo.get('Magias de nível 2')).toBe('invisibilidade')
    expect(porRotulo.get('Magias de nível 3')).toBe('bola de fogo')
  })

  it('uma linha por nível, e nenhuma "Spells 1014" crua', () => {
    expect(lido.fields.some((c) => /^Spells/.test(c.label))).toBe(false)
    expect(lido.fields.filter((c) => /^Magias de nível|^Truques/.test(c.label))).toHaveLength(4)
  })

  it('o dado de vida ("1d8") vira campo E preset', () => {
    const comDado = readSheet(ficha([...PERSONAGEM.fields, campo('HD', '1d8')]))
    expect(comDado.fields).toContainEqual(expect.objectContaining({ label: 'Dado de vida', value: '1d8', group: 'Combate' }))
    expect(comDado.presets).toContainEqual(expect.objectContaining({ name: 'Dado de vida', kind: 'other', source: '1d8' }))
  })
})
