import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTES } from '@shared/types/notes'
import { escolherDestino, personagemEmBranco } from './destinoDaImportacao'

// Importar cria personagem novo; a exceção é o aberto em branco, que recebe a ficha.
describe('o personagem que nasce da ficha importada', () => {
  it('leva o nome que o PDF trouxe, sem os espaços das pontas', () => {
    expect(escolherDestino({ nomeLido: '  Aurora ', fileName: 'ficha.pdf' })).toEqual({ characterName: 'Aurora' })
  })

  it('PDF sem nome: o nome do arquivo entra (nunca um personagem sem nome)', () => {
    expect(escolherDestino({ nomeLido: '  ', fileName: 'Ficha_Oblivio - Colorida.pdf' })).toEqual({
      characterName: 'Ficha Oblivio - Colorida'
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
