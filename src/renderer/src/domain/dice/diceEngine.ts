import type {
  AdvantageMode,
  DiceExpression,
  DiceGroup,
  DiceGroupResult,
  RollResult
} from '@shared/types/dice'

/**
 * Sorteia um inteiro uniforme em [1, sides] usando crypto.getRandomValues,
 * evitando o viés de Math.random() e o efeito modulo-bias de uma divisão ingênua.
 */
function rollDie(sides: number): number {
  const range = sides
  const maxUint32 = 0xffffffff
  const limit = maxUint32 - (maxUint32 % range)
  const buffer = new Uint32Array(1)

  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)

  return (value % range) + 1
}

function rollGroup(group: DiceGroup): DiceGroupResult {
  const rolls = Array.from({ length: group.count }, () => rollDie(group.sides))
  const subtotal = rolls.reduce((sum, roll) => sum + roll, 0)
  return { sides: group.sides, rolls, subtotal }
}

export function expressionLabel(expression: DiceExpression): string {
  const groupsLabel = expression.groups.map((g) => `${g.count}d${g.sides}`).join(' + ')
  const modifiersLabel = expression.modifiers
    .map((m) => (m.value >= 0 ? `+ ${m.value}` : `- ${Math.abs(m.value)}`))
    .join(' ')

  return [groupsLabel, modifiersLabel].filter(Boolean).join(' ')
}

export function rollExpression(expression: DiceExpression): RollResult {
  const groups = expression.groups.map(rollGroup)
  const groupsTotal = groups.reduce((sum, g) => sum + g.subtotal, 0)
  const modifierTotal = expression.modifiers.reduce((sum, m) => sum + m.value, 0)

  return {
    id: crypto.randomUUID(),
    label: expressionLabel(expression),
    groups,
    modifierTotal,
    total: groupsTotal + modifierTotal,
    timestamp: Date.now()
  }
}

export function singleGroupExpression(count: number, sides: number, modifier = 0): DiceExpression {
  return { groups: [{ count, sides }], modifiers: modifier !== 0 ? [{ type: 'flat', value: modifier }] : [] }
}

export type RollMode = AdvantageMode | 'normal'

/**
 * Rola `count`d`sides` (+ modificador). Em modo normal é uma rolagem só;
 * em vantagem/desvantagem rola o grupo inteiro duas vezes e mantém o total
 * maior (vantagem) ou menor (desvantagem) — funciona pra qualquer
 * quantidade de dados, não só duplas.
 */
export function rollWithMode(
  count: number,
  sides: number,
  mode: RollMode,
  modifier = 0
): RollResult {
  const expression = singleGroupExpression(count, sides, modifier)

  if (mode === 'normal') {
    return rollExpression(expression)
  }

  const optionA = rollExpression(expression)
  const optionB = rollExpression(expression)
  const kept =
    mode === 'advantage'
      ? optionA.total >= optionB.total
        ? optionA
        : optionB
      : optionA.total <= optionB.total
        ? optionA
        : optionB

  return { ...kept, advantageMode: mode }
}
