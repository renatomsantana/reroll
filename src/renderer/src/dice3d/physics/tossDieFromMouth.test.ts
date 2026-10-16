import { describe, expect, it } from 'vitest'
import {
  EXPLOSION_FLIGHT_SPEED,
  STRONG_TOWER_FLIGHT_SPEED,
  multiplicadoresDaForca,
  velocidadeMaximaDoRicochete
} from './tossDieFromMouth'

describe('força do lançamento pela torre', () => {
  it('mantém a física aprovada no modo normal', () => {
    expect(multiplicadoresDaForca('normal')).toEqual({ speed: 1, torque: 1 })
  })

  it('ordena velocidade e giro de leve até o modo Explosão', () => {
    const leve = multiplicadoresDaForca('leve')
    const normal = multiplicadoresDaForca('normal')
    const forte = multiplicadoresDaForca('forte')
    const explosao = multiplicadoresDaForca('explosao')

    expect(leve.speed).toBeLessThan(normal.speed)
    expect(normal.speed).toBeLessThan(forte.speed)
    expect(forte.speed).toBeLessThan(explosao.speed)
    expect(leve.torque).toBeLessThan(normal.torque)
    expect(normal.torque).toBeLessThan(forte.torque)
    expect(forte.torque).toBeLessThan(explosao.torque)
    expect(velocidadeMaximaDoRicochete('forte')).toBe(STRONG_TOWER_FLIGHT_SPEED)
    expect(velocidadeMaximaDoRicochete('explosao')).toBe(EXPLOSION_FLIGHT_SPEED)
    expect(EXPLOSION_FLIGHT_SPEED).toBeGreaterThan(STRONG_TOWER_FLIGHT_SPEED * 1.8)
  })
})
