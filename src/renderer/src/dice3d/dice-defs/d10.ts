import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { DICE_DEFAULT_PHYSICS } from '../config/physicsConfig'
import { computePolyhedronFaces, normalizeToCircumradius, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * Trapezoedro pentagonal: 12 vértices (2 ápices + 10 na "cintura" em
 * ziguezague), 10 faces em formato de "pipa" (4 vértices cada). Índices
 * 0-9 = cintura (ângulo = k*36°, altura alterna +h/-h), 10 = ápice de cima,
 * 11 = ápice de baixo.
 *
 * `H` é derivado pra cada face-pipa ficar EXATAMENTE planar:
 * H = h·(1+cos36°)/(1-cos36°) ≈ 9,4721·h (ver Fase 7). Minha primeira
 * tentativa usava h=0.3, o que exige H≈2,84 — um formato espichado tipo
 * bola de rúgbi. Minha segunda tentativa reduziu só H (mantendo h=0.3) pra
 * deixar a proporção mais compacta, o que quebrou a planaridade de forma
 * severa (dobra bem visível/feia em cada face, não sutil). A correção certa
 * era reduzir `h` também: com uma cintura mais "rasa" (h menor), o H exigido
 * pra planaridade exata fica proporcionalmente menor TAMBÉM — mantendo tanto
 * a proporção realista quanto a planaridade perfeita (erro numérico ~0).
 */
const RING_RADIUS = 1
const RING_HALF_HEIGHT = 0.15
const PLANAR_APEX_ANGLE_RAD = (36 * Math.PI) / 180
const APEX_HEIGHT =
  (RING_HALF_HEIGHT * (1 + Math.cos(PLANAR_APEX_ANGLE_RAD))) / (1 - Math.cos(PLANAR_APEX_ANGLE_RAD))

const ring: Vector3Tuple[] = Array.from({ length: 10 }, (_, k) => {
  const angle = (k * 36 * Math.PI) / 180
  const z = k % 2 === 0 ? RING_HALF_HEIGHT : -RING_HALF_HEIGHT
  return [RING_RADIUS * Math.cos(angle), RING_RADIUS * Math.sin(angle), z]
})

const RAW_VERTICES: Vector3Tuple[] = [...ring, [0, 0, APEX_HEIGHT], [0, 0, -APEX_HEIGHT]]
export const D10_VERTICES = normalizeToCircumradius(RAW_VERTICES, 1)

const TOP_APEX = 10
const BOTTOM_APEX = 11

/**
 * Topologia pura (só índices de vértice, sem valor) — face de cima `i`
 * (toca o ápice de cima) é antípoda da face de baixo `(i+2) mod 5`.
 * Exportado separado dos valores porque o d100 (Fase 8) reaproveita esta
 * MESMA topologia/geometria pro dado de dezenas, só trocando os números
 * impressos (0,10,...,90 em vez de 0-9).
 */
export const D10_TOP_FACE_VERTEX_INDICES: number[][] = Array.from({ length: 5 }, (_, i) => [
  TOP_APEX,
  2 * i,
  (2 * i + 1) % 10,
  (2 * i + 2) % 10
])
export const D10_BOTTOM_FACE_VERTEX_INDICES: number[][] = Array.from({ length: 5 }, (_, i) => [
  BOTTOM_APEX,
  (2 * i + 1) % 10,
  (2 * i + 2) % 10,
  (2 * i + 3) % 10
])

/**
 * Valores impressos são os dígitos reais 0-9 (convenção padrão de d10
 * físico) — o que "0 sozinho = 10" ou "0 nas dezenas = 00" significam é
 * interpretação de exibição (Fase 9/10 pro d10 avulso, Fase 8 pro d100),
 * não algo que a definição física do dado deva decidir.
 *
 * Faces de cima valem 0-4; faces de baixo valem 9,8,7,6,5 na ordem
 * correspondente — cada par antípoda soma 9 (convenção comum em d10 reais,
 * análoga ao "soma 7" do d6).
 */
const TOP_VALUES = [0, 1, 2, 3, 4]
const BOTTOM_VALUES_BY_INDEX = [6, 5, 9, 8, 7] // ver derivação do pareamento antípoda no chat

const FACE_INPUTS: PolyhedronFaceInput[] = [
  ...D10_TOP_FACE_VERTEX_INDICES.map((vertexIndices, i) => ({
    vertexIndices,
    value: TOP_VALUES[i]
  })),
  ...D10_BOTTOM_FACE_VERTEX_INDICES.map((vertexIndices, i) => ({
    vertexIndices,
    value: BOTTOM_VALUES_BY_INDEX[i]
  }))
]

export const D10_FACE_INPUTS = FACE_INPUTS

export const D10_DEFINITION: DiceDefinition = {
  type: 10,
  resultMode: 'topFace',
  // Reduzida de 0.8 pra 0.56 (mesma proporção ×0.7 aplicada a todos os dados) — ver `d6.ts`.
  scale: 0.56,
  boundingRadius: 1,
  physics: { ...DICE_DEFAULT_PHYSICS },
  faces: computePolyhedronFaces(D10_VERTICES, FACE_INPUTS)
}
