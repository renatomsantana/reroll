import type { RollResult } from '../types/dice'
import { mantidosPorGrupo } from './manterDados'

/**
 * A LINHA PRA COLAR NO CHAT (spec §3.5) — é no Discord e no WhatsApp que a mesa online vive, e o
 * app rola dados pra uma mesa. Uma linha só, curta o bastante pra não quebrar feio no Discord do
 * celular, com tudo o que a mesa precisa conferir: o nome do golpe, a expressão, cada dado, o
 * modificador e o total.
 *
 *     🎲 Percepção: 1d20 + 5 → [12] +5 = **17**
 *
 * O `**17**` é NEGRITO em Markdown — Discord e WhatsApp renderizam os dois asteriscos. Por padrão vai
 * com negrito, porque é onde a linha vai parar; o `markdown: false` existe pra chat que mostra os
 * asteriscos como estão (ver a preferência "texto puro").
 *
 * Função PURA e compartilhada, pela mesma razão do `rollBreakdown`: a linha pode se contradizer
 * com o total (somar os dados e não dar o número), e uma linha que se contradiz no chat da mesa é
 * pior que na tela — todo mundo vê. Fora do componente, dá pra provar que não contradiz.
 */
export interface RotulosDoChat {
  /** "vant."/"desv." — o sufixo curto de vantagem e desvantagem. */
  advantage: string
  disadvantage: string
  /** O julgamento do alvo de uma fórmula (`>= 15`). */
  success: string
  failure: string
}

export function linhaParaChat(result: RollResult, markdown: boolean, rotulos: RotulosDoChat): string {
  const negrito = (texto: string): string => (markdown ? `**${texto}**` : texto)
  const nome = result.sourceName ? `${result.sourceName}: ${result.label}` : result.label

  /**
   * Cada dado, com as marcas: DESCARTADO (regra de manter, ou a tentativa perdida de vantagem)
   * entre parênteses; MANTIDO em negrito só quando houve descarte — sem descarte, todo dado conta e
   * o negrito não diria nada. Explosão vem por extenso ("14(6+6+2)"), senão um d6 valendo 14 faz a
   * mesa desconfiar da linha inteira. Fórmula é lista, não soma — ver `rollBreakdown`.
   */
  const marcas = result.mantidos ?? (result.keep ? mantidosPorGrupo(result.groups, result.keep) : null)
  const houveDescarte = marcas ? marcas.some((grupo) => grupo.some((conta) => !conta)) : false
  const dado = (gi: number, i: number): string => {
    const valor = result.groups[gi].rolls[i]
    const cadeia = result.groups[gi].chains?.[i]
    const texto = cadeia && cadeia.length > 1 ? `${valor}(${cadeia.join('+')})` : String(valor)
    if (marcas && !marcas[gi][i]) return `(${texto})`
    return houveDescarte ? negrito(texto) : texto
  }
  const dentro = result.formulaTexto ? ', ' : '+'
  const entre = result.formulaTexto ? ' · ' : ' + '
  let dados = result.groups.map((g, gi) => g.rolls.map((_, i) => dado(gi, i)).join(dentro)).join(entre)

  /**
   * VANTAGEM/DESVANTAGEM: a tentativa que perdeu vai junto, separada por "|" — a spec pede os dois
   * dados, com o mantido em negrito. Só existe quando a rolagem guardou a outra tentativa
   * (`descartados`); uma rolagem antiga sem ela mostra só o que ficou, e o sufixo diz o modo.
   */
  if (result.advantageMode && result.descartados) {
    const perdida = result.descartados.map((g) => g.rolls.map((v) => `(${v})`).join('+')).join(' + ')
    dados = `${result.groups.map((g) => g.rolls.map((v) => negrito(String(v))).join('+')).join(' + ')} | ${perdida}`
  }

  const modificador =
    !result.formulaTexto && result.modifierTotal !== 0
      ? ` ${result.modifierTotal > 0 ? '+' : '-'}${Math.abs(result.modifierTotal)}`
      : ''

  const sufixos: string[] = []
  if (result.advantageMode) sufixos.push(`(${result.advantageMode === 'advantage' ? rotulos.advantage : rotulos.disadvantage})`)
  if (result.sucesso !== undefined) sufixos.push(result.sucesso ? `✓ ${rotulos.success}` : `✗ ${rotulos.failure}`)

  return `🎲 ${nome} → [${dados}]${modificador} = ${negrito(String(result.total))}${sufixos.length ? ` ${sufixos.join(' ')}` : ''}`
}
