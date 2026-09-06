import { afterEach, describe, expect, it } from 'vitest'
import { VOLUME_PADRAO, definirVolume, ganhoDoVolume, volumeValido } from './volume'

describe('volume geral', () => {
  afterEach(() => definirVolume(VOLUME_PADRAO))

  it('nasce em 100, que é o volume que o app sempre teve', () => {
    expect(ganhoDoVolume()).toBe(1)
  })

  it('a barrinha manda: 30 vira ganho 0,3', () => {
    definirVolume(30)
    expect(ganhoDoVolume()).toBeCloseTo(0.3)
  })

  it('zero é mudo, sem desligar o interruptor de som', () => {
    definirVolume(0)
    expect(ganhoDoVolume()).toBe(0)
  })

  it('valor que não serve é ignorado e o anterior fica', () => {
    definirVolume(40)
    for (const torto of [150, -1, Number.NaN, Number.POSITIVE_INFINITY]) definirVolume(torto)
    expect(ganhoDoVolume()).toBeCloseTo(0.4)
  })

  it('volumeValido é a régua das preferências: número de 0 a 100, arredondado; o resto é null', () => {
    expect(volumeValido(55.4)).toBe(55)
    expect(volumeValido(0)).toBe(0)
    expect(volumeValido(100)).toBe(100)
    expect(volumeValido('80')).toBeNull()
    expect(volumeValido(101)).toBeNull()
    expect(volumeValido(null)).toBeNull()
    expect(volumeValido(undefined)).toBeNull()
  })
})
