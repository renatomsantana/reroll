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
 * Faces numeradas de 1 A 10 — nunca 0.
 *
 * Eram os dígitos 0-9, a numeração do d10 físico usado como dado de dezena, na ideia de que
 * "0 sozinho vale 10" seria interpretação de exibição, resolvida mais pra frente. Só que essa
 * conversão nunca existiu em lugar nenhum: nem no valor lido (`readTopFace` devolve o valor da face
 * como está), nem no número impresso (o atlas de textura desenha esse mesmo valor). O resultado era
 * um d10 que tirava ZERO, com um "0" desenhado na face — reportado pelo usuário: "quando for o 0 no
 * d10 é 10, não zero; nenhum dado tira 0, apenas 1 até o máximo".
 *
 * A correção é somar 1 em TODAS as faces, e não trocar só a do zero por 10. Os pares antípodas
 * somavam 9 (a convenção do d10 de dezena, análoga ao "soma 7" do d6); somando 1 nos dois lados de
 * cada par, eles passam a somar 11 — que é exatamente a convenção dos d10 reais numerados de 1 a 10.
 * Relabelar só o zero deixaria aquele par somando 19 e todos os outros 9: uniforme no sorteio, mas
 * errado como objeto.
 *
 * Faces de cima valem 1-5; faces de baixo, 10,9,8,7,6 na ordem correspondente.
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
