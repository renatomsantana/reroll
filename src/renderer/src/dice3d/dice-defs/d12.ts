import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { DICE_DEFAULT_PHYSICS } from '../config/physicsConfig'
import { computePolyhedronFaces, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * Dodecaedro regular (12 pentágonos). Os vértices e as faces foram
 * derivados como o DUAL do icosaedro (`d20.ts`): cada vértice do d12 é o
 * centróide normalizado de uma face do d20, e cada face do d12 é o
 * conjunto das 5 faces do d20 que se encontram num vértice do d20,
 * ordenadas angularmente ao redor dele. Verificado num script separado
 * antes de transcrever aqui: fórmula de Euler V-E+F=2 (20-30+12=2) e erro
 * de planaridade dos pentágonos ~1e-16 (praticamente zero) — não foram
 * "chutados" ou copiados de memória sem checar.
 */
export const D12_VERTICES: Vector3Tuple[] = [
  [-0.57735, 0.57735, 0.57735],
  [0, 0.934172, 0.356822],
  [0, 0.934172, -0.356822],
  [-0.57735, 0.57735, -0.57735],
  [-0.934172, 0.356822, 0],
  [0.57735, 0.57735, 0.57735],
  [-0.356822, 0, 0.934172],
  [-0.934172, -0.356822, 0],
  [-0.356822, 0, -0.934172],
  [0.57735, 0.57735, -0.57735],
  [0.57735, -0.57735, 0.57735],
  [0, -0.934172, 0.356822],
  [0, -0.934172, -0.356822],
  [0.57735, -0.57735, -0.57735],
  [0.934172, -0.356822, 0],
  [0.356822, 0, 0.934172],
  [-0.57735, -0.57735, 0.57735],
  [-0.57735, -0.57735, -0.57735],
  [0.356822, 0, -0.934172],
  [0.934172, 0.356822, 0]
]

const RAW_FACE_VERTEX_INDICES: number[][] = [
  [1, 2, 3, 4, 0],
  [5, 19, 9, 2, 1],
  [12, 11, 16, 7, 17],
  [13, 14, 10, 11, 12],
  [10, 15, 6, 16, 11],
  [15, 5, 1, 0, 6],
  [18, 13, 12, 17, 8],
  [9, 18, 8, 3, 2],
  [19, 14, 13, 18, 9],
  [14, 19, 5, 15, 10],
  [3, 8, 17, 7, 4],
  [16, 6, 0, 4, 7]
]

/**
 * Pares de faces antípodas (verificados no mesmo script): (0,3) (1,2) (4,7)
 * (5,6) (8,11) (9,10). Valores atribuídos pra cada par somar 13, como em
 * qualquer d12 padrão.
 */
const FACE_VALUES = [1, 2, 11, 12, 3, 4, 9, 10, 5, 6, 7, 8]

const FACE_INPUTS: PolyhedronFaceInput[] = RAW_FACE_VERTEX_INDICES.map((vertexIndices, i) => ({
  vertexIndices,
  value: FACE_VALUES[i]
}))

export const D12_FACE_INPUTS = FACE_INPUTS

export const D12_DEFINITION: DiceDefinition = {
  type: 12,
  resultMode: 'topFace',
  // Antes 0.8, igual aos outros poliedros genéricos — na prática o d12 parecia maior que os
  // vizinhos mesmo com o mesmo raio nominal (a geometria de pentágonos ocupa mais área visual
  // que triângulos/losangos no mesmo raio). Reduzido a pedido do usuário.
  // Reduzida de 0.7 pra 0.49 (mesma proporção ×0.7 aplicada a todos os dados) — ver `d6.ts`.
  // E de 0.49 pra 0.43 depois, junto com o d6: o usuário voltou a apontar os dois como maiores que
  // os vizinhos. É a mesma razão registrada acima — o pentágono ocupa mais área visual que o
  // triângulo no mesmo raio —, e ela não se resolve de uma vez: enquanto a comparação for feita a
  // olho contra o d20, o d12 vai precisar de um raio nominal menor pra PARECER do mesmo tamanho.
  // 0.43 ficou APROVADO pelo usuário; o d6 é que seguiu descendo depois (ver `d6.ts`).
  scale: 0.43,
  boundingRadius: 1,
  physics: { ...DICE_DEFAULT_PHYSICS },
  faces: computePolyhedronFaces(D12_VERTICES, FACE_INPUTS)
}
