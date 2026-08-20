import { describe, expect, it } from 'vitest'
import type { RollResult } from '../types/dice'
import { rollBreakdown } from './rollBreakdown'

/**
 * A linha de detalhe NÃO PODE contradizer o total.
 *
 * É o defeito que a regra de manter introduziria se ninguém olhasse: "4+17+9" ao lado de "Total 17".
 * Quem lê soma os três, dá 30, e a partir daí não confia em mais nenhum número do app — inclusive
 * nos que estão certos.
 */

function resultado(parcial: Partial<RollResult>): RollResult {
  return {
    id: 'x',
    label: '',
    groups: [],
    modifierTotal: 0,
    total: 0,
    timestamp: 0,
    ...parcial
  }
}

describe('rollBreakdown', () => {
  it('sem regra de manter, lista os dados somados — como sempre foi', () => {
    const texto = rollBreakdown(
      resultado({ groups: [{ sides: 6, rolls: [3, 5], subtotal: 8 }], modifierTotal: 0 })
    )
    expect(texto).toBe('3+5')
  })

  it('mostra o modificador com o sinal certo', () => {
    const grupos = [{ sides: 20, rolls: [11], subtotal: 11 }]
    expect(rollBreakdown(resultado({ groups: grupos, modifierTotal: 4 }))).toBe('11 + 4')
    expect(rollBreakdown(resultado({ groups: grupos, modifierTotal: -2 }))).toBe('11 − 2')
  })

  it('com regra de manter, o dado DESCARTADO vai entre parênteses', () => {
    const texto = rollBreakdown(
      resultado({
        groups: [{ sides: 20, rolls: [4, 17, 9], subtotal: 30 }],
        keep: { mode: 'highest', count: 1 },
        total: 17
      })
    )
    expect(texto).toBe('(4)+17+(9)')
  })

  it('mantendo o MENOR, o parêntese vai nos outros — e não nos de menor valor', () => {
    // O erro fácil: marcar por MAGNITUDE em vez de por quem contou. Aqui o mantido é o 4.
    const texto = rollBreakdown(
      resultado({
        groups: [{ sides: 20, rolls: [4, 17, 9], subtotal: 30 }],
        keep: { mode: 'lowest', count: 1 },
        total: 4
      })
    )
    expect(texto).toBe('4+(17)+(9)')
  })

  it('o que fica SEM parêntese soma exatamente o total, com e sem modificador', () => {
    /**
     * O contrato inteiro em uma asserção: a linha é lida por gente que vai somar os números
     * visíveis. Se essa soma não bater com o total mostrado ao lado, a linha está mentindo.
     */
    for (const modificador of [0, 5, -3]) {
      const groups = [
        { sides: 20, rolls: [4, 17], subtotal: 21 },
        { sides: 20, rolls: [9], subtotal: 9 }
      ]
      const keep = { mode: 'highest' as const, count: 2 }
      const texto = rollBreakdown(resultado({ groups, keep, modifierTotal: modificador }))

      /**
       * A leitura é a de quem OLHA a linha: tira o que está entre parênteses e soma o resto,
       * respeitando o sinal. O menos é o "−" tipográfico (U+2212), e não o hífen — foi o que este
       * teste descobriu na primeira execução.
       */
      const visivel = texto.replace(/\([^)]*\)/g, '')
      const somaVisivel = [...visivel.matchAll(/([+−-]?)\s*(\d+)/g)].reduce(
        (soma, [, sinal, numero]) => soma + (sinal === '−' || sinal === '-' ? -1 : 1) * Number(numero),
        0
      )
      // 17 + 9 mantidos, mais o modificador que aparece no fim da linha.
      expect(somaVisivel).toBe(26 + modificador)
    }
  })
})
