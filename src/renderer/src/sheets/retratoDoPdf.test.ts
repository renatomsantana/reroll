import { describe, expect, it } from 'vitest'
import { CORES_MINIMAS, candidatasARetrato, escolherRetrato, pareceFoto } from './retratoDoPdf'

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

  it('as candidatas vêm da maior pra menor, pra tentar a próxima quando a maior não parece foto', () => {
    const lista = candidatasARetrato(
      [
        { nome: 'menor', largura: 100, altura: 120 },
        { nome: 'maior', largura: 300, altura: 400 },
        { nome: 'media', largura: 200, altura: 200 }
      ],
      PAGINA
    )
    expect(lista.map((i) => i.nome)).toEqual(['maior', 'media', 'menor'])
  })

  it('pareceFoto: o triângulo do Kieran (vermelho sobre preto, com serrilhado) não; uma foto sim', () => {
    // Vermelho e preto com TODOS os tons de vermelho intermediários — o pior caso de um logo com
    // borda serrilhada e JPEG: 16 níveis de R em 4 bits, mais o preto. Ainda longe de 120.
    const triangulo = new Uint8ClampedArray(64 * 64 * 4)
    for (let i = 0; i < 64 * 64; i++) triangulo.set([i % 4 === 0 ? 0 : (i * 5) % 256, 0, 0, 255], i * 4)
    expect(pareceFoto(triangulo)).toBe(false)

    // Uma "foto": três canais variando de forma independente — centenas de cores em 4 bits.
    const foto = new Uint8ClampedArray(64 * 64 * 4)
    for (let i = 0; i < 64 * 64; i++) foto.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i * 4)
    expect(pareceFoto(foto)).toBe(true)
    expect(CORES_MINIMAS).toBeGreaterThan(64)
  })

  it('sem imagem que sirva, null — e isso não é erro', () => {
    expect(escolherRetrato([], PAGINA)).toBeNull()
    expect(escolherRetrato([{ nome: 'icone', largura: 16, altura: 16 }], PAGINA)).toBeNull()
  })
})
