import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { DICE_DEFAULT_PHYSICS } from '../config/physicsConfig'
import { computePolyhedronFaces, normalizeToCircumradius, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * Trapezoedro pentagonal: 12 vértices (2 ápices e 10 na cintura em ziguezague) e 10 faces em formato de
 * pipa. Índices 0-9 = cintura (ângulo `k·36°`, altura alternando ±h), 10 e 11 = ápices.
 *
 * `H` é DERIVADO pra cada face-pipa ficar exatamente planar: `H = h·(1+cos36°)/(1-cos36°)`. Com h=0.3
 * isso exige H≈2,84, um formato espichado de bola de rúgbi; reduzir só o H (mantendo h) quebrou a
 * planaridade com uma dobra bem visível em cada face. A correção certa era reduzir `h` também — com a
 * cintura mais rasa, o H exigido cai proporcionalmente, e a proporção realista e a planaridade exata
 * convivem.
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
 * impressos (0,10,...,90 em vez de 1-10).
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
 * Faces numeradas de 1 A 10, nunca 0.
 *
 * Eram os dígitos 0-9, a numeração do d10 físico usado como dado de dezena, na ideia de que "0 sozinho
 * vale 10" seria interpretação de exibição. Só que essa conversão nunca existiu em lugar nenhum, nem no
 * valor lido nem no número impresso: o resultado era um d10 que tirava ZERO, com um "0" desenhado na
 * face — "quando for o 0 no d10 é 10, não zero; nenhum dado tira 0, apenas 1 até o máximo".
 *
 * A correção é somar 1 em TODAS as faces, e não trocar só a do zero por 10: os pares antípodas somavam
 * 9 (a convenção do dado de dezena) e passam a somar 11, que é a convenção dos d10 reais de 1 a 10.
 * Relabelar só o zero deixaria aquele par somando 19 e todos os outros 9 — uniforme no sorteio, errado
 * como objeto.
 */
const TOP_VALUES = [1, 2, 3, 4, 5]
const BOTTOM_VALUES_BY_INDEX = [7, 6, 10, 9, 8] // ver derivação do pareamento antípoda no chat

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
