import { randomInRange } from '../utils/random'

/**
 * Fração do espaçamento entre slots que cada dado pode ser deslocado aleatoriamente do centro
 * do seu slot.
 *
 * Existe por um motivo visual concreto, reportado pelo usuário como "a rolagem não parece
 * natural" e confirmado numa captura da janela com 13 dados na bandeja: com os slots numa
 * grade regular e cada dado sendo arremessado exatamente pro centro do SEU slot (ver
 * `tossDie`), os dados assentavam num RETICULADO visível — linhas e colunas alinhadas, coisa
 * que dados jogados de verdade nunca fazem. A grade continua existindo (é ela que impede dois
 * dados de nascerem sobrepostos e o solver de resolver isso com um impulso violento), só que
 * agora cada alvo é sorteado dentro da célula em vez de ser sempre o centro dela.
 *
 * 0.42 (e não, digamos, 0.5) deixa uma faixa morta entre células vizinhas — dois alvos
 * sorteados um em direção ao outro ainda não coincidem.
 */
const SLOT_JITTER_FRACTION = 0.42

/**
 * Raio (fração de `safeHalfExtent`) dentro do qual cai o alvo quando existe UM dado só. Sem
 * isso o dado sozinho — o caso mais comum do app — era sempre arremessado pro centro exato da
 * bandeja e assentava lá, rolagem após rolagem, o que lê como alvo fixo e não como um dado
 * jogado numa bandeja.
 */
const SINGLE_DIE_SPREAD = 0.55

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value))
}

/**
 * Distribui N dados em slots numa grade centrada na bandeja, pra não
 * nascerem todos empilhados no mesmo ponto (o que causaria uma explosão de
 * colisão inicial quando a física tenta separar corpos totalmente
 * sobrepostos), com um deslocamento aleatório dentro de cada célula (ver
 * `SLOT_JITTER_FRACTION`) pra o resultado não ficar quadriculado.
 */
export function computeSpawnSlots(count: number, safeHalfExtent: number): { x: number; z: number }[] {
  if (count <= 1) {
    const radius = safeHalfExtent * SINGLE_DIE_SPREAD
    const angle = randomInRange([0, Math.PI * 2])
    // `sqrt` da fração sorteada = distribuição uniforme por ÁREA do disco; sem ele os alvos se
    // concentrariam perto do centro, que é justamente o vício que este espalhamento evita.
    const distance = radius * Math.sqrt(Math.random())
    return [{ x: Math.cos(angle) * distance, z: Math.sin(angle) * distance }]
  }

  const columns = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / columns)
  const spacingX = columns > 1 ? (2 * safeHalfExtent) / (columns - 1) : 0
  const spacingZ = rows > 1 ? (2 * safeHalfExtent) / (rows - 1) : 0
  // Numa grade de uma linha/coluna só, o espaçamento daquele eixo é 0 — usa o do outro eixo
  // pra esse dado também poder variar, em vez de ficar preso na linha exata do centro.
  const jitterX = (spacingX || spacingZ) * SLOT_JITTER_FRACTION
  const jitterZ = (spacingZ || spacingX) * SLOT_JITTER_FRACTION

  return Array.from({ length: count }, (_, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    const baseX = columns > 1 ? -safeHalfExtent + col * spacingX : 0
    const baseZ = rows > 1 ? -safeHalfExtent + row * spacingZ : 0
    return {
      x: clamp(baseX + randomInRange([-jitterX, jitterX]), safeHalfExtent),
      z: clamp(baseZ + randomInRange([-jitterZ, jitterZ]), safeHalfExtent)
    }
  })
}
