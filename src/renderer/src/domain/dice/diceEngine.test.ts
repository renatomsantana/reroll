import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiceExpression } from '@shared/types/dice'
import { expressionLabel, rollExpression, rollWithMode, singleGroupExpression } from './diceEngine'

describe('expressionLabel', () => {
  it('formata um único grupo sem modificador', () => {
    expect(expressionLabel({ groups: [{ count: 1, sides: 20 }], modifiers: [] })).toBe('1d20')
  })

  it('formata múltiplos grupos separados por " + "', () => {
    expect(
      expressionLabel({
        groups: [
          { count: 2, sides: 6 },
          { count: 1, sides: 20 }
        ],
        modifiers: []
      })
    ).toBe('2d6 + 1d20')
  })

  it('anexa modificador positivo com sinal', () => {
    expect(
      expressionLabel({ groups: [{ count: 1, sides: 20 }], modifiers: [{ type: 'flat', value: 5 }] })
    ).toBe('1d20 + 5')
  })

  it('anexa modificador negativo com sinal, sem duplo sinal', () => {
    expect(
      expressionLabel({ groups: [{ count: 1, sides: 20 }], modifiers: [{ type: 'flat', value: -3 }] })
    ).toBe('1d20 - 3')
  })
})

describe('rollExpression — múltiplos dados e total', () => {
  it('cada rolagem individual cai dentro do intervalo válido do seu dado', () => {
    const expression: DiceExpression = {
      groups: [
        { count: 20, sides: 6 },
        { count: 10, sides: 20 }
      ],
      modifiers: []
    }

    // Repete a rolagem várias vezes — isto é um teste de limites (nunca 0, nunca > sides),
    // não uma verificação estatística de distribuição (isso já é feito em
    // `d6.statistical.test.ts` contra a física real).
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = rollExpression(expression)
      const [d6Group, d20Group] = result.groups

      expect(d6Group.rolls).toHaveLength(20)
      for (const roll of d6Group.rolls) expect(roll).toBeGreaterThanOrEqual(1)
      for (const roll of d6Group.rolls) expect(roll).toBeLessThanOrEqual(6)

      expect(d20Group.rolls).toHaveLength(10)
      for (const roll of d20Group.rolls) expect(roll).toBeGreaterThanOrEqual(1)
      for (const roll of d20Group.rolls) expect(roll).toBeLessThanOrEqual(20)
    }
  })

  it('subtotal de cada grupo é a soma das rolagens individuais daquele grupo', () => {
    const expression: DiceExpression = { groups: [{ count: 8, sides: 12 }], modifiers: [] }
    const result = rollExpression(expression)
    const [group] = result.groups
    expect(group.subtotal).toBe(group.rolls.reduce((sum, r) => sum + r, 0))
  })

  it('total = soma dos subtotais de todos os grupos + soma dos modificadores', () => {
    const expression: DiceExpression = {
      groups: [
        { count: 2, sides: 6 },
        { count: 1, sides: 4 }
      ],
      modifiers: [
        { type: 'flat', value: 5 },
        { type: 'flat', value: -2 }
      ]
    }
    const result = rollExpression(expression)
    const groupsTotal = result.groups.reduce((sum, g) => sum + g.subtotal, 0)
    expect(result.modifierTotal).toBe(3)
    expect(result.total).toBe(groupsTotal + 3)
  })

  it('label da rolagem bate com expressionLabel da mesma expressão', () => {
    const expression: DiceExpression = {
      groups: [{ count: 3, sides: 8 }],
      modifiers: [{ type: 'flat', value: 1 }]
    }
    expect(rollExpression(expression).label).toBe(expressionLabel(expression))
  })

  it('cada rolagem recebe um id único', () => {
    const expression = singleGroupExpression(1, 20)
    const a = rollExpression(expression)
    const b = rollExpression(expression)
    expect(a.id).not.toBe(b.id)
  })
})

describe('singleGroupExpression', () => {
  it('sem modificador não inclui nenhum modifier na expressão', () => {
    expect(singleGroupExpression(2, 6)).toEqual({ groups: [{ count: 2, sides: 6 }], modifiers: [] })
  })

  it('com modificador diferente de zero inclui um modifier flat', () => {
    expect(singleGroupExpression(1, 20, 5)).toEqual({
      groups: [{ count: 1, sides: 20 }],
      modifiers: [{ type: 'flat', value: 5 }]
    })
  })
})

/**
 * Controla `crypto.getRandomValues` pra forçar resultados determinísticos —
 * necessário pra testar a lógica de "mantém a tentativa melhor/pior" de
 * vantagem/desvantagem sem depender de sorte. Cada rolagem de 1 dado consome
 * exatamente 1 chamada (o valor injetado fica bem abaixo do limite de
 * rejeição de `rollDie`, então nunca dispara o loop de novo sorteio).
 */
function mockRollSequence(values: number[]): void {
  let callIndex = 0
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(((buffer: Uint32Array) => {
    buffer[0] = values[callIndex++]
    return buffer
  }) as typeof crypto.getRandomValues)
}

describe('rollWithMode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('modo normal: uma rolagem só, sem advantageMode', () => {
    mockRollSequence([3]) // (3 % 6) + 1 = 4
    const result = rollWithMode(1, 6, 'normal')
    expect(result.total).toBe(4)
    expect(result.advantageMode).toBeUndefined()
  })

  it('vantagem: mantém a tentativa de total MAIOR entre as duas', () => {
    mockRollSequence([1, 4]) // tentativa A = (1%6)+1 = 2 ; tentativa B = (4%6)+1 = 5
    const result = rollWithMode(1, 6, 'advantage')
    expect(result.total).toBe(5)
    expect(result.advantageMode).toBe('advantage')
  })

  it('desvantagem: mantém a tentativa de total MENOR entre as duas', () => {
    mockRollSequence([1, 4]) // tentativa A = 2 ; tentativa B = 5
    const result = rollWithMode(1, 6, 'disadvantage')
    expect(result.total).toBe(2)
    expect(result.advantageMode).toBe('disadvantage')
  })

  it('vantagem aplica o modificador só depois de escolher a tentativa mantida', () => {
    mockRollSequence([1, 4]) // tentativa A = 2 ; tentativa B = 5
    const result = rollWithMode(1, 6, 'advantage', 10)
    expect(result.total).toBe(15) // mantém a tentativa B (5) + modificador 10
  })
})
