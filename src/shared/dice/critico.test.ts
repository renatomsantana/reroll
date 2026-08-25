import { describe, expect, it } from 'vitest'
import type { RollResult } from '../types/dice'
import {
  REGRA_DE_CRITICO_PADRAO,
  codigoDaRegra,
  comMarcasDeCritico,
  regraDoCodigo,
  marcasDeCritico,
  normalizarRegraDeCritico,
  regraDeCriticoDoSistema
} from './critico'

function rolagem(parcial: Partial<RollResult>): RollResult {
  return { id: 'r', label: '1d20', groups: [{ sides: 20, rolls: [20], subtotal: 20 }], modifierTotal: 0, total: 20, timestamp: 0, ...parcial }
}

const D20 = REGRA_DE_CRITICO_PADRAO
const CTHULHU = { lados: 100, modo: 'baixo' as const }

/**
 * Crítico e falha (spec §3.7) — o que decide é o dado NATURAL que CONTA. Cada caso aqui é um jeito
 * de a marca errar na mesa: o total com modificador, o dado descartado, o dado errado, a explosão.
 */
describe('marcasDeCritico', () => {
  it('20 natural é crítico e 1 natural é falha, no d20 de D&D', () => {
    expect(marcasDeCritico(rolagem({}), D20)).toEqual({ critico: true, falha: false })
    expect(marcasDeCritico(rolagem({ groups: [{ sides: 20, rolls: [1], subtotal: 1 }] }), D20)).toEqual({ critico: false, falha: true })
    expect(marcasDeCritico(rolagem({ groups: [{ sides: 20, rolls: [12], subtotal: 12 }] }), D20)).toEqual({ critico: false, falha: false })
  })

  it('o total com modificador NÃO decide: 19+1 = 20 não é crítico', () => {
    expect(marcasDeCritico(rolagem({ groups: [{ sides: 20, rolls: [19], subtotal: 19 }], modifierTotal: 1, total: 20 }), D20)).toEqual({ critico: false, falha: false })
  })

  it('dado de OUTRO tipo não conta: um 6 no d6 não é crítico de d20', () => {
    expect(marcasDeCritico(rolagem({ groups: [{ sides: 6, rolls: [6, 1], subtotal: 7 }] }), D20)).toEqual({ critico: false, falha: false })
  })

  it('só o dado MANTIDO decide: "3d20 usa o maior" com um 1 descartado não é falha', () => {
    const r = rolagem({ groups: [{ sides: 20, rolls: [1, 17, 9], subtotal: 27 }], keep: { mode: 'highest', count: 1 }, total: 17 })
    expect(marcasDeCritico(r, D20)).toEqual({ critico: false, falha: false })
    const r2 = rolagem({ groups: [{ sides: 20, rolls: [1, 17, 20], subtotal: 38 }], keep: { mode: 'highest', count: 1 }, total: 20 })
    expect(marcasDeCritico(r2, D20)).toEqual({ critico: true, falha: false })
  })

  it('fórmula traz a marca pronta (`mantidos`) e ela é a que vale', () => {
    const r = rolagem({ formulaTexto: '2d20kh1', groups: [{ sides: 20, rolls: [20, 3], subtotal: 20 }], mantidos: [[true, false]] })
    expect(marcasDeCritico(r, D20)).toEqual({ critico: true, falha: false })
    const r2 = rolagem({ formulaTexto: '2d20kl1', groups: [{ sides: 20, rolls: [20, 3], subtotal: 3 }], mantidos: [[false, true]] })
    expect(marcasDeCritico(r2, D20)).toEqual({ critico: false, falha: false })
  })

  it('dado explosivo: a PRIMEIRA face da cadeia é a natural — o 20 que explodiu, não o 27', () => {
    const r = rolagem({ groups: [{ sides: 20, rolls: [27], subtotal: 27, chains: [[20, 7]] }], total: 27 })
    expect(marcasDeCritico(r, D20)).toEqual({ critico: true, falha: false })
  })

  it('Cthulhu: d100 rola abaixo — 1 é crítico e 100 é falha; o d20 não interessa', () => {
    expect(marcasDeCritico(rolagem({ groups: [{ sides: 100, rolls: [1], subtotal: 1 }] }), CTHULHU)).toEqual({ critico: true, falha: false })
    expect(marcasDeCritico(rolagem({ groups: [{ sides: 100, rolls: [100], subtotal: 100 }] }), CTHULHU)).toEqual({ critico: false, falha: true })
    expect(marcasDeCritico(rolagem({}), CTHULHU)).toEqual({ critico: false, falha: false })
  })

  it('"nenhum" nunca marca', () => {
    expect(marcasDeCritico(rolagem({}), { lados: 20, modo: 'nenhum' })).toEqual({ critico: false, falha: false })
  })

  it('dois dados sem manter podem dar as duas marcas de uma vez', () => {
    expect(marcasDeCritico(rolagem({ groups: [{ sides: 20, rolls: [20, 1], subtotal: 21 }] }), D20)).toEqual({ critico: true, falha: true })
  })
})

describe('comMarcasDeCritico', () => {
  it('só grava o campo quando há marca — rolagem comum fica como estava', () => {
    const comum = rolagem({ groups: [{ sides: 20, rolls: [12], subtotal: 12 }] })
    expect(comMarcasDeCritico(comum, D20)).toBe(comum)
    expect(comMarcasDeCritico(rolagem({}), D20)).toMatchObject({ critico: true })
    expect(comMarcasDeCritico(rolagem({}), D20)).not.toHaveProperty('falha')
  })
})

describe('a regra por personagem', () => {
  it('normaliza o que vem do disco: ausente é o d20 padrão, lados desconhecidos voltam pra 20, modo torto vira alto', () => {
    expect(normalizarRegraDeCritico(undefined)).toEqual({ lados: 20, modo: 'alto' })
    expect(normalizarRegraDeCritico({ lados: 7, modo: 'baixo' })).toEqual({ lados: 20, modo: 'baixo' })
    expect(normalizarRegraDeCritico({ lados: 100, modo: 'sei lá' })).toEqual({ lados: 100, modo: 'alto' })
    expect(normalizarRegraDeCritico({ lados: 12, modo: 'nenhum' })).toEqual({ lados: 12, modo: 'nenhum' })
  })

  it('o código do <select> vai e volta; "nenhum" religado volta pro d20', () => {
    expect(codigoDaRegra({ lados: 100, modo: 'baixo' })).toBe('100:baixo')
    expect(codigoDaRegra({ lados: 12, modo: 'nenhum' })).toBe('nenhum')
    expect(regraDoCodigo('100:baixo')).toEqual({ lados: 100, modo: 'baixo' })
    expect(regraDoCodigo('nenhum')).toEqual({ lados: 20, modo: 'nenhum' })
    expect(regraDoCodigo('lixo')).toEqual({ lados: 20, modo: 'alto' })
  })

  it('a ficha importada de Cthulhu nasce com d100 rola-abaixo; o resto com o d20', () => {
    expect(regraDeCriticoDoSistema('Call of Cthulhu 7e')).toEqual(CTHULHU)
    expect(regraDeCriticoDoSistema('Ordem Paranormal')).toEqual(D20)
    expect(regraDeCriticoDoSistema('')).toEqual(D20)
  })
})
