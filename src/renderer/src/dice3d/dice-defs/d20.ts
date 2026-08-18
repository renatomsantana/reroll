import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { DICE_DEFAULT_PHYSICS } from '../config/physicsConfig'
import { computePolyhedronFaces, normalizeToCircumradius, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * Icosaedro regular: 12 vértices = todas as permutações cíclicas de
 * (0, ±1, ±φ), onde φ é a razão áurea. Construção clássica e verificada
 * (script separado antes de escrever este arquivo): as 30 arestas de todas
 * as 20 faces dão o mesmo comprimento, confirmando que é regular.
 */
const PHI = (1 + Math.sqrt(5)) / 2

const RAW_VERTICES: Vector3Tuple[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1]
]

export const D20_VERTICES = normalizeToCircumradius(RAW_VERTICES, 1)

const RAW_FACE_VERTEX_INDICES: number[][] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1]
]

/**
 * Pares de faces antípodas (verificados no script): (0,13) (1,12) (2,11)
 * (3,10) (4,14) (5,17) (6,18) (7,19) (8,15) (9,16). Valores atribuídos pra
 * cada par somar 21, como em qualquer d20 padrão. Isso não garante a
 * convenção estética extra de "nenhum par de números sequenciais se toca
 * numa aresta" que dados de torneio seguem — só a soma-21, que é a
 * propriedade que importa pra correção.
 */
const FACE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 16, 12, 11, 15, 14, 13]

const FACE_INPUTS: PolyhedronFaceInput[] = RAW_FACE_VERTEX_INDICES.map((vertexIndices, i) => ({
  vertexIndices,
  value: FACE_VALUES[i]
}))

export const D20_FACE_INPUTS = FACE_INPUTS

export const D20_DEFINITION: DiceDefinition = {
  type: 20,
  resultMode: 'topFace',
  // Reduzida de 0.8 pra 0.56 (mesma proporção ×0.7 aplicada a todos os dados) — ver `d6.ts`.
  scale: 0.56,
  boundingRadius: 1,
  physics: { ...DICE_DEFAULT_PHYSICS },
  faces: computePolyhedronFaces(D20_VERTICES, FACE_INPUTS)
}
