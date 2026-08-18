import { Vector3 } from 'three'
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js'
import type { Vector3Tuple } from '@shared/types/dice3d'

/**
 * Descobre QUAIS vértices formam cada face triangular do casco convexo de um
 * conjunto de pontos, usando o QuickHull do three.js — só a topologia
 * (índices de vértice), nunca a normal: a normal de cada face continua
 * vindo exclusivamente de `orientFaceOutward` (Newell), a mesma função usada
 * por todo poliedro no app, pra nunca existir uma segunda fonte de verdade
 * pra normal (ver `polyhedronMath.ts`). Usado pelo d100 esférico
 * (`d100Sphere.ts`), cujas facetas não seguem uma topologia regular
 * conhecida de antemão como os demais poliedros.
 */
export function buildConvexHullFaceTopology(vertices: Vector3Tuple[]): number[][] {
  const points = vertices.map(([x, y, z]) => new Vector3(x, y, z))
  const indexByPoint = new Map<Vector3, number>()
  points.forEach((p, i) => indexByPoint.set(p, i))

  const hull = new ConvexHull().setFromPoints(points)

  return hull.faces.map((face) => {
    const indices: number[] = []
    let edge = face.edge
    do {
      const index = indexByPoint.get(edge.head().point)
      if (index === undefined) {
        throw new Error(
          'Vértice do casco convexo não corresponde a nenhum ponto original — verifique se todos os pontos de entrada são extremos (ex.: todos na superfície da esfera)'
        )
      }
      indices.push(index)
      edge = edge.next
    } while (edge !== face.edge)
    return indices
  })
}
