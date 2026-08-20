import type { DiceGroupResult, KeepRule } from '../types/dice'

/**
 * "Role N dados e use o MAIOR" — a regra que Ordem Paranormal usa em todo teste, e que o app não
 * sabia fazer.
 *
 * Um teste com Agilidade 3 é "role 3d20 e fique com o maior", não "some os três". A ficha do usuário
 * veio com a coluna TESTE escrita assim ("2d20"), o importador criava o preset somando, e a soma de
 * 2d20 dá em média 21 onde a regra dá 13,8 — um número que parece certo e não é. O aviso que existia
 * na tela de importação pedia pra pessoa "ler o maior dado da mesa" e fazer a conta de cabeça.
 *
 * A regra vale pro CONJUNTO da rolagem, e não por grupo, porque é assim que ela é escrita nos
 * sistemas: "role tudo isso e fique com os dois melhores". Com um grupo só — que é o caso de toda
 * ficha real vista até agora — as duas leituras dão no mesmo.
 *
 * Os dados descartados NÃO somem do resultado: eles caíram na bandeja e a pessoa está olhando pra
 * eles. Some-se o que foi mantido e marca-se o resto; esconder metade dos dados que estão na mesa
 * seria o app discordando do que a pessoa vê.
 */

/**
 * Os ÍNDICES mantidos, na lista achatada de todos os dados da rolagem.
 *
 * Empate fica com quem veio primeiro. Não muda o total (os valores são iguais) e mantém a marcação
 * estável entre um render e outro.
 */
export function indicesMantidos(valores: number[], keep?: KeepRule): Set<number> {
  if (!keep || keep.count <= 0 || keep.count >= valores.length) {
    return new Set(valores.map((_, i) => i))
  }
  const ordem = valores
    .map((valor, indice) => ({ valor, indice }))
    .sort((a, b) => (keep.mode === 'highest' ? b.valor - a.valor : a.valor - b.valor) || a.indice - b.indice)
  return new Set(ordem.slice(0, keep.count).map((d) => d.indice))
}

/** A soma dos dados mantidos. Sem regra de manter, é a soma de todos. */
export function totalMantido(valores: number[], keep?: KeepRule): number {
  const mantidos = indicesMantidos(valores, keep)
  return valores.reduce((soma, valor, i) => (mantidos.has(i) ? soma + valor : soma), 0)
}

/** Todos os valores de todos os grupos, na ordem em que aparecem — a lista que a regra enxerga. */
export function valoresDosGrupos(groups: DiceGroupResult[]): number[] {
  return groups.flatMap((grupo) => grupo.rolls)
}

/**
 * Quais dados de cada grupo foram mantidos, na mesma forma dos grupos.
 *
 * Existe pra tela poder marcar dado por dado sem refazer a conta — e sem refazer a conta é a única
 * garantia de que o que está marcado como "usado" é exatamente o que entrou no total.
 */
export function mantidosPorGrupo(groups: DiceGroupResult[], keep?: KeepRule): boolean[][] {
  const mantidos = indicesMantidos(valoresDosGrupos(groups), keep)
  let deslocamento = 0
  return groups.map((grupo) => {
    const marcas = grupo.rolls.map((_, i) => mantidos.has(deslocamento + i))
    deslocamento += grupo.rolls.length
    return marcas
  })
}

/** "maior"/"menor" pro rótulo da rolagem. `null` quando não há regra — aí não há o que dizer. */
export function rotuloDeManter(keep?: KeepRule): string | null {
  if (!keep || keep.count <= 0) return null
  const quantos = keep.count === 1 ? 'o' : `os ${keep.count}`
  return keep.mode === 'highest' ? `${quantos} maior${keep.count === 1 ? '' : 'es'}` : `${quantos} menor${keep.count === 1 ? '' : 'es'}`
}
