import { describe, expect, it } from 'vitest'
import { contarSimbolos, resumoAssimilacao, resultadoSimples, selecionarDados, simbolosDaFace, type FaceAssimilacao } from './d12'

describe('dados simbólicos de Assimilação', () => {
  it.each([
    [6, { sucesso: 1, adaptacao: 1, pressao: 3 }],
    [10, { sucesso: 7, adaptacao: 3, pressao: 5 }],
    [12, { sucesso: 8, adaptacao: 5, pressao: 8 }]
  ] as const)('confere a distribuição completa do d%i com o Livro Básico', (sides, total) => {
    expect(contarSimbolos(Array.from({ length: sides }, (_, i) => ({ sides, value: i + 1 })))).toEqual(total)
    expect(simbolosDaFace(1, sides)).toEqual([])
    expect(simbolosDaFace(2, sides)).toEqual([])
    expect(simbolosDaFace(4, sides)).toEqual(['pressao'])
  })
  it('conta símbolos repetidos sem somar números das faces ou cancelar sucessos', () => {
    expect(contarSimbolos([1, 2, 7, 11, 12])).toEqual({ sucesso: 3, pressao: 3, adaptacao: 2 })
    expect(resumoAssimilacao([7, 12])).toBe('2 sucessos · 0 adaptações · 2 pressões')
    expect(contarSimbolos([])).toEqual({ sucesso: 0, pressao: 0, adaptacao: 0 })
  })
  it('só usa faces inteiras escolhidas, respeitando o limite de mantidos', () => {
    const faces: FaceAssimilacao[] = [{ sides: 6, value: 6 }, { sides: 10, value: 10 }, { sides: 12, value: 11 }]
    expect(contarSimbolos(selecionarDados(faces, [2], 1))).toEqual({ sucesso: 1, adaptacao: 2, pressao: 1 })
    expect(contarSimbolos(selecionarDados(faces, [0, 1], 2))).toEqual({ sucesso: 3, adaptacao: 0, pressao: 1 })
    for (const indices of [[0, 1], [1, 1], [-1], [3], [0.5]]) expect(() => selecionarDados(faces, indices, 1)).toThrow()
  })
  it('na Ação simples evita pressão 1:1 e mantém os sucessos', () => {
    expect(resultadoSimples({ sucesso: 1, adaptacao: 2, pressao: 1 })).toEqual({ sucesso: 1, adaptacao: 1, pressao: 0 })
    expect(resultadoSimples({ sucesso: 2, adaptacao: 1, pressao: 3 })).toEqual({ sucesso: 2, adaptacao: 0, pressao: 2 })
  })
  it('recusa faces que não existem no dado escolhido', () => {
    for (const value of [0, 13, -1, 1.5, NaN]) expect(() => simbolosDaFace(value)).toThrow()
    expect(() => simbolosDaFace(7, 6)).toThrow()
    expect(() => simbolosDaFace(11, 10)).toThrow()
  })
})
