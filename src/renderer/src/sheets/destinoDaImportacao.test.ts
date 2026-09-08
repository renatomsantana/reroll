import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTES } from '@shared/types/notes'
import { escolherDestino, personagemEmBranco } from './destinoDaImportacao'

// Importar cria personagem novo; a exceção é o aberto em branco, que recebe a ficha.
describe('o personagem que nasce da ficha importada', () => {
  it('leva o nome que o PDF trouxe, sem os espaços das pontas', () => {
    expect(escolherDestino({ nomeLido: '  Aurora ', fileName: 'ficha.pdf' })).toEqual({ characterName: 'Aurora' })
  })

  /**
   * O leitor DECIDE o nome, e o vazio dele é uma decisão: no modelo em branco baixado do site, o
   * nome do arquivo é o título da ficha. Isto aqui punha o nome do arquivo de volta, e nasciam
   * personagens chamados "Ficha Oblivio - Colorida" e "RemasterPlayerCoreCharacterSheet".
   */
  it('PDF sem nome nasce SEM nome — o arquivo não vira personagem', () => {
    expect(escolherDestino({ nomeLido: '  ', fileName: 'Ficha_Oblivio - Colorida.pdf' })).toEqual({
      characterName: ''
    })
    expect(
      escolherDestino({ nomeLido: '', fileName: 'Ordem Paranormal - Ficha de Personagem Editável.pdf' })
    ).toEqual({ characterName: '' })
  })

  /** O palpite pelo nome do arquivo continua existindo — no leitor, que sabe quando ele vale. */
  it('o palpite que o leitor fez pelo nome do arquivo atravessa inteiro', () => {
    expect(escolherDestino({ nomeLido: 'Elias - ficha', fileName: 'Elias - ficha.pdf' })).toEqual({
      characterName: 'Elias - ficha'
    })
  })

  it('nunca aponta pra um personagem com nome ou ficha: mesmo nome repetido é personagem novo', () => {
    const destino = escolherDestino({
      nomeLido: 'Kieran Vance',
      fileName: 'x.pdf',
      aberto: { id: 'p1', emBranco: false }
    })
    expect('targetProfileId' in destino).toBe(false)
  })

  it('o personagem aberto em branco recebe a ficha em vez de nascer outro', () => {
    expect(
      escolherDestino({ nomeLido: 'Aurora', fileName: 'x.pdf', aberto: { id: 'p1', emBranco: true } })
    ).toEqual({ characterName: 'Aurora', targetProfileId: 'p1' })
  })
})

describe('personagem em branco', () => {
  const vazias = DEFAULT_NOTES

  it('é o recém-criado: sem nome e sem uma letra na ficha', () => {
    expect(personagemEmBranco({ name: '' }, vazias)).toBe(true)
    expect(personagemEmBranco({ name: '   ' }, vazias)).toBe(true)
  })

  it('com nome, já é alguém: a ficha importada não entra nele', () => {
    expect(personagemEmBranco({ name: 'Matias' }, vazias)).toBe(false)
  })

  it('com uma palavra na ficha, também não', () => {
    expect(personagemEmBranco({ name: '' }, { ...vazias, backstory: 'Nasceu em Vila Rica.' })).toBe(false)
    expect(
      personagemEmBranco({ name: '' }, { ...vazias, sections: [{ id: 's', title: 'Atributos', fields: [] }] })
    ).toBe(false)
  })

  it('sem personagem aberto, não há em branco', () => {
    expect(personagemEmBranco(undefined, vazias)).toBe(false)
  })
})
