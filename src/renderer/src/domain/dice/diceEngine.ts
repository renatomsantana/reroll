import type {
  AdvantageMode,
  DiceExpression,
  DiceGroup,
  DiceGroupResult,
  RollResult
} from '@shared/types/dice'
import { rotuloDeManter, totalMantido, valoresDosGrupos } from '@shared/dice/manterDados'

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

  const base = [groupsLabel, modifiersLabel].filter(Boolean).join(' ')
  /**
   * A regra de manter entra NO RÓTULO, e não só na conta. É o rótulo que aparece no histórico e no
   * cartão do preset, e "2d20" com total 14 sem nenhuma explicação parece defeito — a pessoa somou
   * os dois dados que está vendo e deu outro número.
   */
  const manter = rotuloDeManter(expression.keep)
  return manter ? `${base} (usa ${manter})` : base
}

export function rollExpression(expression: DiceExpression): RollResult {
  const groups = expression.groups.map(rollGroup)
  /**
   * O total sai dos dados MANTIDOS, mas `groups` continua com todos: os descartados caíram na
   * bandeja e a pessoa está olhando pra eles. Ver `manterDados.ts`.
   */
  const groupsTotal = totalMantido(valoresDosGrupos(groups), expression.keep)
  const modifierTotal = expression.modifiers.reduce((sum, m) => sum + m.value, 0)

  return {
    id: crypto.randomUUID(),
    label: expressionLabel(expression),
    groups,
    modifierTotal,
    total: groupsTotal + modifierTotal,
    timestamp: Date.now(),
    keep: expression.keep
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
