import type { Vector3Tuple } from '@shared/types/dice3d'

/**
 * Distribui `count` pontos quase uniformemente pela superfície de uma esfera
 * unitária, usando a variante "deslocada" da espiral de Fibonacci
 * (`y = 1 - (2i+1)/n` em vez de `y = 1 - 2i/(n-1)`) — a variante clássica
 * cravaria os pontos i=0 e i=n-1 EXATAMENTE nos polos, o que gera vértices
 * quase coincidentes ali e facetas degeneradas (quase-fio-de-navalha) no
 * casco convexo. A variante deslocada nunca toca os polos, o que já reduz
 * bastante esse problema (mas não o elimina — ver `jitterPointsOnSphere`).
 */
export function fibonacciSpherePoints(count: number): Vector3Tuple[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * i + 1) / count
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i
    return [Math.cos(theta) * radiusAtY, y, Math.sin(theta) * radiusAtY] as Vector3Tuple
  })
}

/** PRNG determinístico (mulberry32) — mesma semente sempre produz a mesma sequência. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Perturba cada ponto por um deslocamento aleatório pequeno (determinístico,
 * mesma seed sempre gera o mesmo resultado) e reprojeta na esfera unitária.
 * Usado pelo d100 esférico pra quebrar a quase-simetria da espiral de
 * Fibonacci que, mesmo na variante deslocada, ainda deixa alguns vértices
 * quase coplanares entre si — o que produz facetas do casco convexo com
 * normais quase idênticas às da vizinha (impossível de distinguir de forma
 * confiável em `readTopFace`). Ver `d100Sphere.ts` pra como a seed/magnitude
 * usadas foram escolhidas (busca por maior separação mínima entre normais).
 */
export function jitterPointsOnSphere(
  points: Vector3Tuple[],
  magnitude: number,
  seed: number
): Vector3Tuple[] {
  const random = mulberry32(seed)
  return points.map(([x, y, z]) => {
    const jx = x + (random() - 0.5) * magnitude
    const jy = y + (random() - 0.5) * magnitude
    const jz = z + (random() - 0.5) * magnitude
    const len = Math.sqrt(jx * jx + jy * jy + jz * jz)
    return [jx / len, jy / len, jz / len] as Vector3Tuple
  })
}
