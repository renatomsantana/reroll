import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { DICE_DEFAULT_PHYSICS } from '../config/physicsConfig'
import { computePolyhedronFaces, normalizeToCircumradius, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * Tetraedro regular via a construção clássica "vértices alternados de um
 * cubo": (1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1) formam um tetraedro
 * regular (todas as arestas com o mesmo comprimento — dá pra conferir
 * calculando a distância entre qualquer par).
 */
const RAW_VERTICES: Vector3Tuple[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1]
]

export const D4_VERTICES = normalizeToCircumradius(RAW_VERTICES, 1)

/**
 * Cada face é o triângulo formado pelos 3 vértices QUE NÃO SÃO o vértice de
 * mesmo índice — ou seja, a face oposta ao vértice N. `value` aqui já é o
 * resultado mostrado quando ESSA face fica encostada na mesa (ver
 * `FaceResultMode.bottomFace` em `shared/types/dice3d.ts`): como a face
 * oposta ao vértice N é justamente a que fica embaixo quando o vértice N
 * aponta pra cima, `value` da face N = o número atribuído ao vértice N.
 * Usei a atribuição mais simples (vértice N → valor N+1); qualquer
 * permutação de 1-4 seria uma numeração de d4 igualmente válida.
 */
const FACE_INPUTS: PolyhedronFaceInput[] = [
  { vertexIndices: [1, 2, 3], value: 1 }, // oposta ao vértice 0
  { vertexIndices: [0, 2, 3], value: 2 }, // oposta ao vértice 1
  { vertexIndices: [0, 1, 3], value: 3 }, // oposta ao vértice 2
  { vertexIndices: [0, 1, 2], value: 4 } // oposta ao vértice 3
]

export const D4_FACE_INPUTS = FACE_INPUTS

export const D4_DEFINITION: DiceDefinition = {
  type: 4,
  resultMode: 'bottomFace',
  // Reduzida de 0.8 pra 0.56 (mesma proporção ×0.7 aplicada a todos os dados) — pedido do
  // usuário: dados menores pra caber melhor na torre/tobogã (ver `d6.ts` pro mesmo comentário).
  scale: 0.56,
  boundingRadius: 1,
  physics: { ...DICE_DEFAULT_PHYSICS },
  faces: computePolyhedronFaces(D4_VERTICES, FACE_INPUTS)
}
