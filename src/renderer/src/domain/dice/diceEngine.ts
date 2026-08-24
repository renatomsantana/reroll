import type {
  AdvantageMode,
  DiceExpression,
  DiceGroup,
  DiceGroupResult,
  ExplodeRule,
  RollResult
} from '@shared/types/dice'
import { rotuloDeManter, totalMantido, valoresDosGrupos } from '@shared/dice/manterDados'
import { avaliarFormula, type Formula } from '@shared/dice/formula'
import { resultadoParaRollResult } from '@shared/dice/rolagemPorEtapas'

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

/**
 * A cadeia de um dado só: a face que caiu e, se a regra explosiva valer e ela for a máxima, as faces
 * seguintes.
 *
 * O teto é do `maxChain` e é obrigatório: sem ele, um d4 com 25% de chance de continuar a cada
 * lançamento é um laço que TERMINA quase sempre e trava o app na vez em que não terminar. "Quase
 * sempre" não é um contrato aceitável dentro de um laço.
 */
function rolarCadeia(sides: number, explode?: ExplodeRule): number[] {
  const cadeia = [rollDie(sides)]
  if (!explode || explode.maxChain <= 0) return cadeia

  // `sides === 1` não existe entre os dados do app, mas se um dia existir a face máxima é a única
  // face — a cadeia nunca pararia sozinha, e o teto seria a ÚNICA coisa segurando.
  while (cadeia[cadeia.length - 1] === sides && cadeia.length <= explode.maxChain) {
    cadeia.push(rollDie(sides))
  }
  return cadeia
}

function rollGroup(group: DiceGroup, explode?: ExplodeRule): DiceGroupResult {
  const cadeias = Array.from({ length: group.count }, () => rolarCadeia(group.sides, explode))
  // Um valor por DADO: a soma da cadeia dele. Ver o comentário de `DiceGroupResult.rolls`.
  const rolls = cadeias.map((cadeia) => cadeia.reduce((soma, face) => soma + face, 0))
  const subtotal = rolls.reduce((sum, roll) => sum + roll, 0)

  // `chains` só quando houve explosão de verdade — o caso normal não carrega estrutura à toa, e a
  // presença dela é o que diz à tela que há detalhe pra mostrar.
  const explodiu = cadeias.some((cadeia) => cadeia.length > 1)
  return explodiu
    ? { sides: group.sides, rolls, subtotal, chains: cadeias }
    : { sides: group.sides, rolls, subtotal }
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
  /**
   * "explode" entra no rótulo pelo mesmo motivo que a regra de manter: é o rótulo que aparece no
   * histórico e no cartão do preset, e um "1d6" com total 17 sem explicação parece defeito.
   */
  const partes = [rotuloDeManter(expression.keep) && `usa ${rotuloDeManter(expression.keep)}`, expression.explode && 'explode']
    .filter(Boolean)
    .join(', ')
  return partes ? `${base} (${partes})` : base
}

export function rollExpression(expression: DiceExpression): RollResult {
  const groups = expression.groups.map((group) => rollGroup(group, expression.explode))
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
    keep: expression.keep,
    explode: expression.explode
  }
}

/**
 * A FÓRMULA rolada sem física — o mesmo RNG de `rollExpression`, guiando a gramática inteira.
 *
 * É o caminho do modo rápido e do modo compacto pros presets de fórmula: a avaliação pede as faces
 * e o `rollDie` responde na hora, sem ondas. `null` quando a avaliação falha (referência à ficha
 * num preset que passou por fora da validação) — quem chama decide o que mostrar; rolar outra
 * coisa no lugar é que não dá.
 */
export function rolarFormula(formula: Formula, sourceName?: string): RollResult | null {
  const resultado = avaliarFormula(formula, {
    dados: (lados, quantidade) => Array.from({ length: quantidade }, () => rollDie(lados))
  })
  if (!resultado.ok) return null
  return resultadoParaRollResult(formula, resultado, sourceName)
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
