import { describe, expect, it } from 'vitest'
import { normalizeNotes, DEFAULT_NOTES } from './notes'
import { normalizeProfiles, DEFAULT_PROFILE_ID } from './profile'
import { blockForGroup } from './sheetBlocks'

/**
 * Os NORMALIZADORES são a fronteira entre o disco e o app: tudo que é lido de `notes.json` e
 * `profiles.json` passa por aqui. É a camada que decide o que acontece quando o arquivo é de uma
 * versão antiga, foi editado à mão, ou está corrompido pela metade.
 *
 * Não tinham teste nenhum, e são justamente onde um defeito significa PERDER A FICHA de alguém — o
 * contrário do que o usuário pediu ("preciso que tudo se mantenha salvo"). Um `.filter` a mais aqui
 * apaga em silêncio o que a pessoa escreveu.
 */

describe('normalizeNotes — ler o arquivo de anotações', () => {
  it('completa o que falta sem inventar conteúdo', () => {
    const notes = normalizeNotes({})
    expect(notes.characterName).toBe('')
    expect(notes.sections).toEqual([])
    // Sempre existe UMA página: o diário sem página nenhuma não teria o que mostrar nem como criar.
    expect(notes.pages).toHaveLength(1)
    expect(notes.currentPage).toBe(0)
  })

  it('migra o formato ANTIGO (um bloco `notes` só) pra primeira página do diário', () => {
    // Quem usava o app antes do diário tem isto gravado. Perder esse texto seria perder sessões.
    const notes = normalizeNotes({ notes: 'A caverna estava alagada.' })
    expect(notes.pages[0].text).toBe('A caverna estava alagada.')
  })

  it('adota o nome que morava dentro de um objeto `sheet`', () => {
    expect(normalizeNotes({ sheet: { name: 'Riebeck' } }).characterName).toBe('Riebeck')
  })

  it('conserta `currentPage` fora do intervalo em vez de quebrar a tela', () => {
    const paginas = [
      { id: 'a', title: '', text: '1' },
      { id: 'b', title: '', text: '2' }
    ]
    expect(normalizeNotes({ pages: paginas, currentPage: 9 }).currentPage).toBe(1)
    expect(normalizeNotes({ pages: paginas, currentPage: -3 }).currentPage).toBe(0)
    expect(normalizeNotes({ pages: paginas, currentPage: NaN }).currentPage).toBe(0)
  })

  it('descarta seção estragada sem levar as boas junto', () => {
    /**
     * O risco de um `filter` mal calibrado: um item torto no arquivo derrubar a ficha inteira. O
     * comportamento certo é perder só o item defeituoso.
     */
    const lido = normalizeNotes({
      sections: [
        { id: 's1', title: 'Atributos', fields: [{ id: 'f1', label: 'Força', value: '3' }] },
        { title: 'Sem campos' },
        null,
        { id: 's2', title: 'Recursos', fields: [{ label: 'PV', value: '45' }] }
      ]
    })
    expect(lido.sections.map((s) => s.title)).toEqual(['Atributos', 'Recursos'])
    // Campo sem id ganha um: sem id, editar um valor mexeria no vizinho (a tela casa por id).
    expect(lido.sections[1].fields[0].id).toBeTruthy()
    expect(lido.sections[1].fields[0].value).toBe('45')
  })

  it('não perde o valor de um campo cujo `value` veio de tipo errado', () => {
    const lido = normalizeNotes({
      sections: [{ id: 's', title: 'X', fields: [{ id: 'f', label: 'Vigor', value: 3 }] }]
    })
    // Vira string vazia em vez de manter um número onde a tela espera texto — e a tela não quebra.
    expect(lido.sections[0].fields[0].value).toBe('')
  })

  it('aguenta lixo completo sem lançar', () => {
    for (const entrada of [null, undefined, 42, 'texto', [], { pages: 'não é lista' }]) {
      expect(() => normalizeNotes(entrada)).not.toThrow()
      expect(normalizeNotes(entrada).pages.length).toBeGreaterThan(0)
    }
    expect(normalizeNotes(null).inventory).toBe(DEFAULT_NOTES.inventory)
  })
})

describe('normalizeProfiles — ler a lista de personagens', () => {
  it('cria o personagem padrão quando não há nenhum', () => {
    const estado = normalizeProfiles(null)
    expect(estado.profiles).toHaveLength(1)
    expect(estado.profiles[0].id).toBe(DEFAULT_PROFILE_ID)
    expect(estado.activeId).toBe(DEFAULT_PROFILE_ID)
  })

  it('descarta entrada sem id e mantém as boas', () => {
    const estado = normalizeProfiles({
      profiles: [
        { id: 'a', name: 'Matias', system: '', photo: null, createdAt: 1 },
        { name: 'sem id' },
        { id: 'b', name: 'Rodrigo', system: '', photo: null, createdAt: 2 }
      ],
      activeId: 'b'
    })
    expect(estado.profiles.map((p) => p.id)).toEqual(['a', 'b'])
    expect(estado.activeId).toBe('b')
  })

  /**
   * O id do perfil VIRA NOME DE PASTA (`ProfilesRepository.activeDirectory`). Estes três testes
   * cobrem o que acontece quando ele não serve pra isso — e o estrago, quando acontece, é o pior
   * tipo: silencioso e em cima dos dados de outro personagem.
   */
  it('dois personagens com o MESMO id não podem dividir a mesma pasta', () => {
    const estado = normalizeProfiles({
      profiles: [
        { id: 'mesmo', name: 'Matias', system: '', photo: null, createdAt: 1 },
        { id: 'mesmo', name: 'Rodrigo', system: '', photo: null, createdAt: 2 }
      ],
      activeId: 'mesmo'
    })
    // Os dois continuam na lista — ninguém some por defeito de arquivo.
    expect(estado.profiles.map((p) => p.name)).toEqual(['Matias', 'Rodrigo'])
    expect(estado.profiles[0].id).not.toBe(estado.profiles[1].id)
    // O primeiro fica com o id original, então quem já tinha dados continua com eles.
    expect(estado.profiles[0].id).toBe('mesmo')
  })

  it('id que escaparia da pasta do app é trocado, e o personagem fica', () => {
    for (const idRuim of ['', '   ', '.', '..', '../../Windows', 'a/b', 'a\\b', 'C:algo']) {
      const estado = normalizeProfiles({
        profiles: [{ id: idRuim, name: 'Alguém', system: 'Oblivio', photo: null, createdAt: 1 }],
        activeId: idRuim
      })
      expect(estado.profiles).toHaveLength(1)
      expect(estado.profiles[0].name).toBe('Alguém')
      expect(estado.profiles[0].id).not.toBe(idRuim)
      // E o perfil aberto acompanha o id novo, senão a lista tem um e o disco procura outro.
      expect(estado.activeId).toBe(estado.profiles[0].id)
    }
  })

  it('campo com tipo errado vira o padrão em vez de estourar longe daqui', () => {
    const estado = normalizeProfiles({
      profiles: [
        { id: 'a', name: 42, system: null, photo: 7, createdAt: 'ontem' },
        { id: 'b', name: 'Rodrigo', system: 'Ordem', photo: null, createdAt: Number.NaN }
      ],
      activeId: 'a'
    })
    // `name` vai pra tela e pro `trim()` de quem grava a ficha — número ali estoura sem pilha útil.
    expect(estado.profiles[0].name).toBe('')
    expect(estado.profiles[0].system).toBe('')
    expect(estado.profiles[0].photo).toBeNull()
    expect(estado.profiles[0].createdAt).toBe(0)
    expect(estado.profiles[1].createdAt).toBe(0)
    expect(estado.profiles[1].name).toBe('Rodrigo')
  })

  it('cai no primeiro quando o personagem aberto não existe mais', () => {
    /**
     * Acontece de verdade: apagar o personagem aberto, ou abrir um `profiles.json` editado à mão.
     * Sem isto, o app abriria apontando pra um id fantasma e a ficha viria vazia sem explicação.
     */
    const estado = normalizeProfiles({
      profiles: [{ id: 'a', name: '', system: '', photo: null, createdAt: 1 }],
      activeId: 'apagado'
    })
    expect(estado.activeId).toBe('a')
  })
})

describe('blockForGroup — pra onde vai cada grupo da ficha importada', () => {
  it('reconhece os grupos que têm bloco, nos dois idiomas', () => {
    expect(blockForGroup('Inventário')).toBe('inventory')
    expect(blockForGroup('Equipamento')).toBe('inventory')
    expect(blockForGroup('Habilidades')).toBe('abilities')
    expect(blockForGroup('Aparência')).toBe('appearance')
    expect(blockForGroup('Motivação')).toBe('backstory')
    expect(blockForGroup('Background')).toBe('backstory')
  })

  it('os nomes que o leitor de D&D 5e usa em inglês também caem no bloco certo', () => {
    /**
     * Não é generalidade de graça: são exatamente os nomes de grupo que `readers/dnd5e.ts` produz
     * com a interface em inglês. Sem eles, "Equipment" e "Features" viravam SEÇÃO, e o parágrafo de
     * equipamento de uma ficha de D&D aparecia espremido numa caixa de uma linha.
     */
    expect(blockForGroup('Equipment')).toBe('inventory')
    expect(blockForGroup('Features')).toBe('abilities')
    expect(blockForGroup('Appearance')).toBe('appearance')
    expect(blockForGroup('Backstory')).toBe('backstory')
    // E os que continuam sendo seção, porque são NÚMERO em caixa.
    expect(blockForGroup('Attributes')).toBeNull()
    expect(blockForGroup('Saving Throws')).toBeNull()
    expect(blockForGroup('Combat')).toBeNull()
    expect(blockForGroup('Spellcasting')).toBeNull()
    expect(blockForGroup('Identity')).toBeNull()
  })

  it('ATRIBUTOS não vai pra bloco — vira seção, pra sair em caixas', () => {
    // Ver o comentário em `sheetBlocks.ts`: em texto, atributo deixa de parecer ficha de RPG.
    expect(blockForGroup('Atributos')).toBeNull()
  })

  it('PERÍCIA também não — "Luta 10" é número em caixa, não frase', () => {
    // Habilidade é o contrário, e por isso as duas se separaram quando as perícias passaram a ser
    // importadas: uma é texto escrito, a outra é valor.
    expect(blockForGroup('Perícias')).toBeNull()
    expect(blockForGroup('Skills')).toBeNull()
    expect(blockForGroup('Habilidades')).toBe('abilities')
  })

  it('grupo desconhecido vira seção', () => {
    expect(blockForGroup('Identificação')).toBeNull()
    expect(blockForGroup('Recursos')).toBeNull()
    expect(blockForGroup('Corpo')).toBeNull()
    expect(blockForGroup('')).toBeNull()
  })
})
