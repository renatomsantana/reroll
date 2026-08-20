import type { RollResult } from '../types/dice'
import { mantidosPorGrupo } from './manterDados'

/**
 * A LINHA DE DETALHE de uma rolagem: os dados que caíram, e o modificador.
 *
 * Mora aqui, e não dentro do painel compacto onde nasceu, porque ela pode se CONTRADIZER com o
 * total — e uma linha que se contradiz é o tipo de defeito que faz a pessoa parar de confiar em
 * todo resultado do app. Fora do componente, dá pra provar que ela não contradiz.
 */
export function rollBreakdown(result: RollResult): string {
  /**
   * Com regra de manter, o dado DESCARTADO vai entre parênteses.
   *
   * Sem isso a linha se contradiz na cara da pessoa: "4+17+9" ao lado de um total 17. Ela some os
   * três, dá 30, e passa a desconfiar de todo resultado do app. O parêntese é a forma mais curta de
   * dizer "este rolou, mas não conta" numa linha que já é apertada — e o rótulo logo ao lado já diz
   * qual é a regra ("3d20 (usa o maior)").
   */
  const marcas = result.keep ? mantidosPorGrupo(result.groups, result.keep) : null
  const groups = result.groups
    .map((g, gi) =>
      g.rolls.map((valor, i) => (marcas && !marcas[gi][i] ? `(${valor})` : String(valor))).join('+')
    )
    .join(' + ')
  if (result.modifierTotal === 0) return groups
  const sinal = result.modifierTotal > 0 ? '+' : '−'
  return `${groups} ${sinal} ${Math.abs(result.modifierTotal)}`
}
