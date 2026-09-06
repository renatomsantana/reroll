import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTES } from '@shared/types/notes'
import { escolherDestino, personagemEmBranco } from './destinoDaImportacao'

/**
 * A importação sem janela (02/09/2026) decide sozinha o nome. O destino quase não é decisão: toda
 * ficha importada vira um personagem NOVO (pedido dele: "para não perder o que já está lá"). A
 * única exceção (06/09/2026) é o personagem aberto EM BRANCO, o que "Novo personagem" acabou de
 * criar: ele recebe a ficha, porque não há nada nele a perder, e criar outro deixava um sem nome
 * pra trás gastando um lugar do teto.
 */
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
