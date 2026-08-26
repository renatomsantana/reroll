import { describe, expect, it } from 'vitest'
import { LADO_DO_QUADRO, ZOOM_MAXIMO, escalaMinima, janelaNaImagem, limitar, recorteInicial } from './recorteDeFoto'

/** A geometria do recorte (zoom no rosto): o que se vê no quadro é o que o arquivo grava. */
describe('recorte de foto', () => {
  const retrato = { largura: 600, altura: 800 }
  const paisagem = { largura: 1200, altura: 500 }

  it('a escala mínima cobre o quadro pelo lado menor', () => {
    expect(escalaMinima(retrato)).toBeCloseTo(LADO_DO_QUADRO / 600)
    expect(escalaMinima(paisagem)).toBeCloseTo(LADO_DO_QUADRO / 500)
  })

  it('o recorte inicial dá um zoom leve e olha pra parte de CIMA de um retrato', () => {
    const inicial = recorteInicial(retrato)
    expect(inicial.escala).toBeCloseTo(escalaMinima(retrato) * 1.15)
    expect(inicial.y).toBeGreaterThan(0)
    const janela = janelaNaImagem(inicial, retrato)
    // A janela começa acima do meio da imagem (rosto), não no meio.
    expect(janela.sy + janela.sh / 2).toBeLessThan(retrato.altura / 2)
    expect(janela.sx).toBeGreaterThanOrEqual(0)
    expect(janela.sy).toBeGreaterThanOrEqual(0)
  })

  it('limitar: nunca menor que cobrir, nunca acima do zoom máximo, e a imagem nunca descola do quadro', () => {
    const minima = escalaMinima(retrato)
    expect(limitar({ escala: 0.01, x: 0, y: 0 }, retrato).escala).toBeCloseTo(minima)
    expect(limitar({ escala: 99, x: 0, y: 0 }, retrato).escala).toBeCloseTo(minima * ZOOM_MAXIMO)
    const preso = limitar({ escala: minima, x: 999, y: -999 }, retrato)
    // Na escala mínima a largura casa com o quadro: não há pra onde deslocar em x.
    expect(preso.x).toBe(0)
    const sobraY = (retrato.altura * minima - LADO_DO_QUADRO) / 2
    expect(preso.y).toBeCloseTo(-sobraY)
  })

  it('a janela na imagem é sempre um quadrado dentro dela', () => {
    for (const recorte of [{ escala: 1, x: 40, y: -30 }, { escala: 2, x: -100, y: 100 }, { escala: 0.5, x: 0, y: 0 }]) {
      const limitado = limitar(recorte, paisagem)
      const j = janelaNaImagem(limitado, paisagem)
      expect(j.sw).toBeCloseTo(j.sh)
      expect(j.sx).toBeGreaterThanOrEqual(-0.001)
      expect(j.sy).toBeGreaterThanOrEqual(-0.001)
      expect(j.sx + j.sw).toBeLessThanOrEqual(paisagem.largura + 0.001)
      expect(j.sy + j.sh).toBeLessThanOrEqual(paisagem.altura + 0.001)
    }
  })
})
