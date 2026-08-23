import type { Vector3Tuple } from '@shared/types/dice3d'
import { buildConvexHullFaceTopology } from './buildConvexHullFaceTopology'
import { cross, dot, normalize, orientFaceOutward, scale, subtract } from './polyhedronMath'

export interface DualPolyhedron {
  vertices: Vector3Tuple[]
  /** Uma entrada por NORMAL de entrada, com os índices de vértice em volta daquela face. */
  faces: number[][]
}

/**
 * Constrói o poliedro cujas FACES olham exatamente pras direções dadas — o dual polar do casco
 * convexo dessas direções.
 *
 * Por que isto existe, e por que é diferente de "casco convexo de pontos": as duas construções
 * partem de uma nuvem de direções, mas escolhem coisas opostas. No casco, as direções viram
 * VÉRTICES e as faces saem de brinde — quantas, com que forma e olhando pra onde é consequência, e
 * não escolha. Aqui as direções viram as NORMAIS das faces: o sólido é a interseção dos semi-espaços
 * `n·x ≤ 1`, ou seja, um plano por direção, encostado na esfera no ponto `n`.
 *
 * A diferença importa quando o sólido é um DADO, e ela foi medida no d100 antigo (casco de 52
 * pontos com jitter): facetas irregulares deixam bacias de equilíbrio desiguais e algumas VAZIAS —
 * treze das cem faces nunca saíram em 3000 rolagens de física real, e uma saía quatro vezes mais
 * que a média. Com as normais escolhidas de propósito, cada face é a célula de Voronoi da sua
 * direção: o pé da perpendicular do centro cai SEMPRE dentro da própria face, então toda face
 * apoia, e as áreas ficam parecidas porque as direções estão bem espalhadas.
 *
 * O que sai daqui, com direções de Fibonacci, é um sólido da família Goldberg: quase todas as faces
 * hexagonais, com doze pentágonos — o mesmo motivo pelo qual uma bola de futebol tem pentágonos, e
 * não uma escolha de estilo (topologia não permite cobrir a esfera só de hexágonos).
 */
export function buildDualFromNormals(normals: Vector3Tuple[]): DualPolyhedron {
  const facesDoCasco = buildConvexHullFaceTopology(normals)

  /**
   * Cada FACE do casco das direções vira um VÉRTICE do dual: é o ponto onde os planos das direções
   * daquela face se cruzam.
   *
   * A conta é `m / d`, com `m` a normal unitária da face do casco e `d` a distância dela à origem —
   * e não a solução de um sistema 3×3 com três direções escolhidas a dedo. As duas dão o mesmo
   * ponto quando a face é um triângulo, mas o QuickHull funde faces coplanares: quando ele devolve
   * um quadrilátero, o sistema 3×3 ignoraria a quarta direção e `m / d` continua certo pras quatro
   * (todo ponto da face está no plano `m·x = d`, então `n·(m/d) = 1` pra todas).
   */
  const vertices = facesDoCasco.map((indices) => {
    const { normal } = orientFaceOutward(normals, indices)
    const distancia = dot(normal, normals[indices[0]])
    return scale(normal, 1 / distancia)
  })

  /** Quais faces do casco tocam cada direção — são elas que dão os cantos da face dual. */
  const incidentes: number[][] = normals.map(() => [])
  facesDoCasco.forEach((indices, idDaFace) => {
    for (const indice of indices) incidentes[indice].push(idDaFace)
  })

  return {
    vertices,
    faces: normals.map((n, i) => ordenarEmVolta(vertices, incidentes[i], n))
  }
}

/**
 * Põe os cantos de uma face em ordem ao redor da normal dela.
 *
 * `orientFaceOutward` conserta o SENTIDO (horário/anti-horário), mas não a ORDEM: ele lê os
 * vértices como um polígono na ordem em que chegam, e a lista de faces incidentes do casco vem em
 * ordem de descoberta, não em ordem geométrica. Uma face montada com os cantos embaralhados vira
 * uma estrela auto-intersectada — normal errada pela regra de Newell, triangulação em leque
 * furada, e o número da face desenhado em cima de um polígono que não fecha.
 */
function ordenarEmVolta(vertices: Vector3Tuple[], indices: number[], normal: Vector3Tuple): number[] {
  const eixoU = normalize(subtract(vertices[indices[0]], scale(normal, dot(vertices[indices[0]], normal))))
  const eixoV = cross(normal, eixoU)
  return [...indices].sort((a, b) => {
    const anguloA = Math.atan2(dot(vertices[a], eixoV), dot(vertices[a], eixoU))
    const anguloB = Math.atan2(dot(vertices[b], eixoV), dot(vertices[b], eixoU))
    return anguloA - anguloB
  })
}
