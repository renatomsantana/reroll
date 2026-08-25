import { describe, expect, it } from 'vitest'
import { escolherRetrato } from './retratoDoPdf'

const PAGINA = { largura: 595, altura: 842 } // A4 em pontos

/**
 * A heurística do retrato (spec §3.6): a maior imagem que tem cara de foto — nem ícone, nem a
 * própria página digitalizada, nem faixa de rodapé.
 */
describe('escolherRetrato', () => {
  it('escolhe a maior entre as que têm tamanho e proporção de foto', () => {
    const escolhida = escolherRetrato(
      [
        { nome: 'logo', largura: 40, altura: 40 },
        { nome: 'foto', largura: 300, altura: 400 },
        { nome: 'selo', largura: 120, altura: 120 }
      ],
      PAGINA
    )
    expect(escolhida?.nome).toBe('foto')
  })

  it('a ficha digitalizada inteira (proporção da página, grande) NÃO é retrato', () => {
    const escolhida = escolherRetrato(
      [
        { nome: 'fundo', largura: 1240, altura: 1754 },
        { nome: 'foto', largura: 220, altura: 300 }
      ],
      PAGINA
    )
    expect(escolhida?.nome).toBe('foto')
    expect(escolherRetrato([{ nome: 'fundo', largura: 1240, altura: 1754 }], PAGINA)).toBeNull()
  })

  it('faixa de rodapé e tira vertical ficam de fora pela proporção', () => {
    expect(escolherRetrato([{ nome: 'faixa', largura: 900, altura: 80 }], PAGINA)).toBeNull()
    expect(escolherRetrato([{ nome: 'tira', largura: 70, altura: 600 }], PAGINA)).toBeNull()
  })

  it('sem imagem que sirva, null — e isso não é erro', () => {
    expect(escolherRetrato([], PAGINA)).toBeNull()
    expect(escolherRetrato([{ nome: 'icone', largura: 16, altura: 16 }], PAGINA)).toBeNull()
  })
})
