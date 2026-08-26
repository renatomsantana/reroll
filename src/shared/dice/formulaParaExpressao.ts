import type { DiceExpression, DiceGroup } from '../types/dice'
import { DEFAULT_DICE_SIDES, MAX_EXPLOSOES_POR_DADO, MAX_SIMULTANEOUS_DICE } from '../diceRegistry'
import { analisarFormula, type Formula, type NoDaFormula, type TermoDeDado } from './formula'

/**
 * A PONTE entre a gramática e o que a bandeja sabe rolar hoje.
 *
 * `DiceExpression` é o que os presets guardam e o que a bandeja 3D recebe: grupos de dados,
 * modificador fixo, uma regra de manter pra rolagem inteira e uma regra de explosão pra rolagem
 * inteira. A gramática diz mais do que isso — rerolar, contar sucessos, alvo, referências à ficha,
 * multiplicação, manter por grupo. O caminho do spec é a bandeja passar a falar a gramática;
 * enquanto ela não fala, esta ponte traduz o que dá e diz, com o motivo escrito, o que ainda não
 * dá. É o motivo que aparece no editor de preset — "o rolador desta versão ainda não faz X" — em
 * vez de um preset que rola diferente do que está escrito.
 *
 * A tradução de volta (`expressaoParaFormula`) existe pro editor mostrar em texto o preset que a
 * pessoa montou nos botões, e pra ida-e-volta ser testável: o que sai de um lado entra no outro.
 */

export type Reducao = { ok: true; expression: DiceExpression } | { ok: false; motivo: string }

const TIPOS_DA_BANDEJA = DEFAULT_DICE_SIDES.map((lados) => `d${lados}`).join(', ')

export function textoParaExpressao(texto: string): Reducao {
  const lido = analisarFormula(texto)
  if (!lido.ok) return { ok: false, motivo: lido.mensagem }
  return formulaParaExpressao(lido.formula)
}

export function formulaParaExpressao(formula: Formula): Reducao {
  if (formula.alvo) {
    return { ok: false, motivo: 'O alvo no fim (>= 15) ainda não entra no preset: o rolador desta versão não julga sucesso.' }
  }

  const termos: TermoDeDado[] = []
  let modificador = 0
  try {
    achatar(formula.expressao, 1, termos, (valor) => (modificador += valor))
  } catch (causa) {
    if (causa instanceof ForaDaBandeja) return { ok: false, motivo: causa.message }
    throw causa
  }

  if (termos.length === 0) return { ok: false, motivo: 'Um preset precisa de pelo menos um dado.' }

  for (const termo of termos) {
    if (!DEFAULT_DICE_SIDES.includes(termo.lados)) {
      return { ok: false, motivo: `A bandeja não tem d${termo.lados}: tem ${TIPOS_DA_BANDEJA}.` }
    }
    if (termo.rerolar) return { ok: false, motivo: 'Rerolar (r<2) ainda não entra no preset.' }
    if (termo.contar) return { ok: false, motivo: 'Contar sucessos (#>=5) ainda não entra no preset.' }
  }

  const comRegra = termos.filter((t) => t.manter || t.descartar)
  if (comRegra.length > 0 && termos.length > 1) {
    return {
      ok: false,
      motivo: 'Manter ou descartar por grupo ainda não entra no preset: a regra do rolador vale pra rolagem inteira, então use um tipo de dado só.'
    }
  }

  const explodem = termos.filter((t) => t.explodir).length
  if (explodem > 0 && explodem < termos.length) {
    return { ok: false, motivo: 'Explosão em parte dos dados ainda não entra no preset: ou todos explodem, ou nenhum.' }
  }

  const groups: DiceGroup[] = []
  for (const termo of termos) {
    const existente = groups.find((g) => g.sides === termo.lados)
    if (existente) existente.count += termo.quantidade
    else groups.push({ sides: termo.lados, count: termo.quantidade })
  }
  const total = groups.reduce((soma, g) => soma + g.count, 0)
  if (total > MAX_SIMULTANEOUS_DICE) {
    return { ok: false, motivo: `São ${total} dados, e a bandeja rola no máximo ${MAX_SIMULTANEOUS_DICE} de uma vez.` }
  }

  const expression: DiceExpression = {
    groups,
    modifiers: modificador === 0 ? [] : [{ type: 'flat', value: modificador }]
  }
  const regra = comRegra[0]
  if (regra?.manter && regra.manter.quantos < regra.quantidade) {
    expression.keep = { mode: regra.manter.modo === 'maior' ? 'highest' : 'lowest', count: regra.manter.quantos }
  } else if (regra?.descartar) {
    // Descartar os N menores é manter os (total − N) maiores, e vice-versa.
    expression.keep = {
      mode: regra.descartar.modo === 'menor' ? 'highest' : 'lowest',
      count: regra.quantidade - regra.descartar.quantos
    }
  }
  if (explodem > 0) expression.explode = { maxChain: MAX_EXPLOSOES_POR_DADO }
  return { ok: true, expression }
}

class ForaDaBandeja extends Error {}

/**
 * Desmonta a árvore numa lista de dados somados e um modificador. Só `+` e `-` sobrevivem; o resto
 * (multiplicação, dado subtraído, referência) para aqui com o motivo.
 */
function achatar(no: NoDaFormula, sinal: 1 | -1, termos: TermoDeDado[], somar: (valor: number) => void): void {
  switch (no.tipo) {
    case 'numero':
      somar(sinal * no.valor)
      return
    case 'negativo':
      achatar(no.de, sinal === 1 ? -1 : 1, termos, somar)
      return
    case 'operacao':
      if (no.operador === '*') throw new ForaDaBandeja('Multiplicação ainda não entra no preset.')
      achatar(no.esquerda, sinal, termos, somar)
      achatar(no.direita, no.operador === '-' ? (sinal === 1 ? -1 : 1) : sinal, termos, somar)
      return
    case 'referencia':
      throw new ForaDaBandeja(`@${no.caminho.join('.')} precisa de um valor da ficha, e o preset ainda não lê a ficha na hora de rolar.`)
    case 'dado':
      if (sinal === -1) throw new ForaDaBandeja('Dado subtraído (1d6 - 1d4) ainda não entra no preset.')
      termos.push(no)
      return
  }
}

/**
 * O preset escrito na gramática — ou `null` quando ele diz algo que a gramática não escreve (uma
 * regra de manter sobre vários tipos de dado ao mesmo tempo, que a bandeja faz e a notação não tem
 * como dizer).
 */
export function expressaoParaFormula(expression: DiceExpression): string | null {
  const groups = expression.groups.filter((g) => g.count > 0)
  if (groups.length === 0) return null

  const total = groups.reduce((soma, g) => soma + g.count, 0)
  const keep = expression.keep
  const manterTemEfeito = !!keep && keep.count >= 1 && keep.count < total
  if (manterTemEfeito && groups.length > 1) return null

  const explodir = !!expression.explode && expression.explode.maxChain > 0
  const termos = groups.map((g) => {
    let texto = `${g.count}d${g.sides}`
    if (manterTemEfeito && keep) texto += `k${keep.mode === 'highest' ? 'h' : 'l'}${keep.count}`
    if (explodir) texto += '!'
    return texto
  })

  const modificador = expression.modifiers.reduce((soma, m) => soma + m.value, 0)
  let texto = termos.join(' + ')
  if (modificador > 0) texto += ` + ${modificador}`
  if (modificador < 0) texto += ` - ${-modificador}`
  return texto
}
