import { describe, expect, it } from 'vitest'
import { escolherDestino, nomeDoArquivo } from './destinoDaImportacao'

/**
 * A importação sem janela (02/09/2026) decide sozinha o nome. O destino não é mais decisão: toda
 * ficha importada vira um personagem NOVO (pedido dele: "para não perder o que já está lá"), então
 * o que resta a estas regras é o nome, e a garantia de que ele nunca fica vazio.
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

  it('nunca aponta pra um personagem existente: mesmo nome repetido é personagem novo', () => {
    const destino = escolherDestino({ nomeLido: 'Kieran Vance', fileName: 'x.pdf' })
    expect('targetProfileId' in destino).toBe(false)
  })
})

describe('o nome do arquivo como nome', () => {
  it('tira a extensão e os sublinhados; espaços repetidos viram um', () => {
    expect(nomeDoArquivo('Ordem_Paranormal__Matais.PDF')).toBe('Ordem Paranormal Matais')
    expect(nomeDoArquivo('  ficha   Go.pdf ')).toBe('ficha Go')
  })
})
