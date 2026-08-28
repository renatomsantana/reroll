import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: () => {} },
  nativeImage: { createFromPath: () => null },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) }
}))

const { tamanhoCheioQueCabe } = await import('./registerWindowHandlers')
const { FULL_SIZE } = await import('@shared/windowSizes')

/**
 * O tamanho cheio tem que CABER no monitor (reporte de tester: "o full screen buga dependendo do
 * tamanho do monitor" — a janela saía maior que a tela em notebook com escala 125–150%).
 */
describe('tamanhoCheioQueCabe', () => {
  it('num monitor folgado, é o FULL_SIZE de sempre', () => {
    expect(tamanhoCheioQueCabe({ width: 1920, height: 1040 })).toEqual(FULL_SIZE)
  })

  it('num notebook 1366×768 (área útil ~728 de altura), a altura aperta pra caber', () => {
    const tamanho = tamanhoCheioQueCabe({ width: 1366, height: 728 })
    expect(tamanho.width).toBe(FULL_SIZE.width)
    expect(tamanho.height).toBe(728)
  })

  it('com escala 150% (1280×672 úteis), largura, altura E mínimos apertam', () => {
    // O mínimo tem que apertar junto: `setMinimumSize` roda DEPOIS da animação, e um mínimo
    // maior que a tela esticaria a janela de volta pra fora dela.
    expect(tamanhoCheioQueCabe({ width: 1280, height: 672 })).toEqual({
      width: 1200,
      height: 672,
      minWidth: 900,
      minHeight: 600
    })
  })

  it('num monitor menor que o mínimo, o mínimo vira a própria área útil', () => {
    const tamanho = tamanhoCheioQueCabe({ width: 800, height: 560 })
    expect(tamanho).toEqual({ width: 800, height: 560, minWidth: 800, minHeight: 560 })
  })
})
