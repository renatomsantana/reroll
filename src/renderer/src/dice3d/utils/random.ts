export function randomInRange([min, max]: readonly [number, number]): number {
  return min + Math.random() * (max - min)
}

/**
 * Quaternion uniformemente distribuído em SO(3) (método de Shoemake). Sortear
 * três ângulos de Euler independentes NÃO dá uma orientação inicial
 * uniforme — teria mais probabilidade em certas regiões da esfera de
 * orientações. Isso importa pra não introduzir viés nas condições iniciais
 * do lançamento.
 */
export function randomQuaternion(): [x: number, y: number, z: number, w: number] {
  const u1 = Math.random()
  const u2 = Math.random()
  const u3 = Math.random()
  const sqrt1MinusU1 = Math.sqrt(1 - u1)
  const sqrtU1 = Math.sqrt(u1)

  return [
    sqrt1MinusU1 * Math.sin(2 * Math.PI * u2),
    sqrt1MinusU1 * Math.cos(2 * Math.PI * u2),
    sqrtU1 * Math.sin(2 * Math.PI * u3),
    sqrtU1 * Math.cos(2 * Math.PI * u3)
  ]
}
