import type { Vector3Tuple } from '@shared/types/dice3d'
import { normalize, scale } from './polyhedronMath'

/**
 * Direções para as FACES de um dado: `pares` direções bem espalhadas mais as antípodas delas, ou seja,
 * faces opostas sempre paralelas, como em qualquer dado de verdade.
 *
 * POR QUE A SIMETRIA É O QUE TORNA O DADO HONESTO, e não a área das faces: um dado em repouso está
 * apoiado numa face, a direção "pra cima" é exatamente `-n` da face de baixo, e `readTopFace` lê a face
 * cuja normal mais se aproxima disso. Existe então um MAPA "face de baixo → face lida", e ele só é
 * justo se for uma BIJEÇÃO — sem simetria central duas faces de baixo podem levar à mesma face lida, e
 * a vizinha delas não sai NUNCA.
 *
 * Medido no d100 com 100 direções de Fibonacci sobre a esfera inteira (áreas de 0,94x a 1,06x da
 * média): só 92 das 100 faces eram alcançáveis, e a física real confirmou com 12 faces zeradas em 3000
 * rolagens. Com pares antípodas, a face lida é a oposta exata da de apoio, o mapa vira permutação, e
 * cada face sai com a probabilidade da SUA área.
 *
 * A RELAXAÇÃO existe porque a espiral de Fibonacci restrita a um hemisfério, espelhada, deixa direções
 * amontoadas perto do equador (vizinhas a 11,5°, áreas de 0,75x a 1,21x). Uma repulsão de Coulomb
 * movendo só metade delas e espelhando a cada passo conserta as duas coisas: 19,5° e 0,93x–1,07x. Os
 * números pararam de melhorar por volta de 200 iterações.
 */
export function antipodalDirections(pares: number, iteracoes = 200, passo = 0.002): Vector3Tuple[] {
  let metade = espiralNoHemisferio(pares)

  for (let it = 0; it < iteracoes; it++) {
    const todas = espelhar(metade)
    metade = metade.map((direcao, i) => {
      let fx = 0
      let fy = 0
      let fz = 0
      todas.forEach((outra, j) => {
        if (j === i) return
        const dx = direcao[0] - outra[0]
        const dy = direcao[1] - outra[1]
        const dz = direcao[2] - outra[2]
        const distanciaAoQuadrado = dx * dx + dy * dy + dz * dz
        // A própria antípoda entra na conta como qualquer outra; o guarda é só contra divisão por
        // zero se duas direções coincidirem numericamente.
        if (distanciaAoQuadrado < 1e-9) return
        // Coulomb: força ∝ 1/d², na direção que afasta.
        const forca = 1 / (distanciaAoQuadrado * Math.sqrt(distanciaAoQuadrado))
        fx += dx * forca
        fy += dy * forca
        fz += dz * forca
      })
      return normalize([direcao[0] + fx * passo, direcao[1] + fy * passo, direcao[2] + fz * passo])
    })
  }

  return espelhar(metade)
}

/**
 * A metade norte: espiral de Fibonacci comprimida num hemisfério (`y` de 0 a 1), e não a espiral
 * sobre a esfera inteira. Espelhar a esfera inteira não daria um conjunto simétrico — daria as
 * mesmas direções duas vezes, com pares quase coincidentes.
 */
function espiralNoHemisferio(pares: number): Vector3Tuple[] {
  const anguloDourado = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: pares }, (_, i) => {
    const y = (i + 0.5) / pares
    const raio = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = anguloDourado * i
    return [Math.cos(theta) * raio, y, Math.sin(theta) * raio] as Vector3Tuple
  })
}

/** As `pares` direções seguidas das antípodas: a face `i + pares` é sempre a oposta da face `i`. */
function espelhar(metade: Vector3Tuple[]): Vector3Tuple[] {
  return [...metade, ...metade.map((direcao) => scale(direcao, -1))]
}
