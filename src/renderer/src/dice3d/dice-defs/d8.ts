import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { DICE_DEFAULT_PHYSICS } from '../config/physicsConfig'
import { computePolyhedronFaces, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/** Octaedro regular: os 6 pontos a ±1 em cada eixo. */
export const D8_VERTICES: Vector3Tuple[] = [
  [1, 0, 0], // 0 (+x)
  [-1, 0, 0], // 1 (-x)
  [0, 1, 0], // 2 (+y)
  [0, -1, 0], // 3 (-y)
  [0, 0, 1], // 4 (+z)
  [0, 0, -1] // 5 (-z)
]

/**
 * As 8 faces são os 8 octantes: um vértice de cada par de eixo. Faces
 * opostas (todos os sinais invertidos) somam 9, como em qualquer d8 padrão.
 */
const FACE_INPUTS: PolyhedronFaceInput[] = [
  { vertexIndices: [0, 2, 4], value: 1 }, // +x+y+z
  { vertexIndices: [0, 2, 5], value: 2 }, // +x+y-z
  { vertexIndices: [0, 3, 4], value: 3 }, // +x-y+z
  { vertexIndices: [0, 3, 5], value: 4 }, // +x-y-z
  { vertexIndices: [1, 2, 4], value: 5 }, // -x+y+z
  { vertexIndices: [1, 2, 5], value: 6 }, // -x+y-z
  { vertexIndices: [1, 3, 4], value: 7 }, // -x-y+z
  { vertexIndices: [1, 3, 5], value: 8 } // -x-y-z
]

export const D8_FACE_INPUTS = FACE_INPUTS

export const D8_DEFINITION: DiceDefinition = {
  type: 8,
  resultMode: 'topFace',
  // Reduzida de 0.8 pra 0.56 (mesma proporção ×0.7 aplicada a todos os dados) — ver `d6.ts`.
  scale: 0.56,
  boundingRadius: 1,
  physics: { ...DICE_DEFAULT_PHYSICS },
  faces: computePolyhedronFaces(D8_VERTICES, FACE_INPUTS)
}
