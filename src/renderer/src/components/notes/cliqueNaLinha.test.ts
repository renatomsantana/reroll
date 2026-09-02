import { describe, expect, it } from 'vitest'
import { quebrasAteALinhaClicada } from './cliqueNaLinha'

/** Pauta de 24px, como no `.notes-textarea`. */
const PAUTA = 24

describe('clicar numa linha do caderno de anotações', () => {
  it('clique em cima de texto que existe: nada a acrescentar, o navegador já pôs o cursor', () => {
    // Três linhas escritas; clique no meio da segunda.
    expect(quebrasAteALinhaClicada(24 + 10, PAUTA, 3)).toBe(0)
    expect(quebrasAteALinhaClicada(0, PAUTA, 3)).toBe(0)
    // No último pixel da terceira pauta ainda é texto.
    expect(quebrasAteALinhaClicada(3 * 24 - 1, PAUTA, 3)).toBe(0)
  })

  it('clique na pauta logo abaixo do texto: uma quebra', () => {
    expect(quebrasAteALinhaClicada(3 * 24 + 5, PAUTA, 3)).toBe(1)
  })

  it('clique cinco pautas abaixo: cinco quebras, e o cursor cai na pauta apontada', () => {
    expect(quebrasAteALinhaClicada(7 * 24 + 12, PAUTA, 3)).toBe(5)
  })

  it('caderno vazio conta como uma linha ocupada: clicar na primeira pauta não acrescenta nada', () => {
    expect(quebrasAteALinhaClicada(10, PAUTA, 0)).toBe(0)
    expect(quebrasAteALinhaClicada(24 + 2, PAUTA, 0)).toBe(1)
  })

  it('sem pauta medida ou clique acima do texto (na borda): nada', () => {
    expect(quebrasAteALinhaClicada(100, 0, 1)).toBe(0)
    expect(quebrasAteALinhaClicada(-3, PAUTA, 1)).toBe(0)
  })
})
