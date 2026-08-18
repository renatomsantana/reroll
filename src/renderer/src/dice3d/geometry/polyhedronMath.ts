import type { Vector3Tuple } from '@shared/types/dice3d'

/**
 * Álgebra vetorial mínima e a lógica de orientação de face, sem NENHUMA
 * dependência de Three.js ou Rapier. Usado tanto pra montar a `DiceDefinition`
 * (que precisa ficar pura e testável, ver Fase 6) quanto pra construir a
 * malha visual (`buildPolyhedronGeometry.ts`) — os dois consomem a MESMA
 * função `orientFaceOutward`, então a normal usada na leitura de resultado e
 * a normal usada pra desenhar a face nunca podem divergir.
 */

export function subtract(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function add(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function scale(a: Vector3Tuple, s: number): Vector3Tuple {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function dot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function length(a: Vector3Tuple): number {
  return Math.sqrt(dot(a, a))
}

export function normalize(a: Vector3Tuple): Vector3Tuple {
  const len = length(a)
  return [a[0] / len, a[1] / len, a[2] / len]
}

export function centroid(points: Vector3Tuple[]): Vector3Tuple {
  let sum: Vector3Tuple = [0, 0, 0]
  for (const p of points) sum = add(sum, p)
  return scale(sum, 1 / points.length)
}

/** Normal de um polígono planar convexo via método de Newell — funciona pra qualquer número de vértices (3, 4 ou 5). */
export function newellNormal(polygon: Vector3Tuple[]): Vector3Tuple {
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1, z1] = polygon[i]
    const [x2, y2, z2] = polygon[(i + 1) % polygon.length]
    nx += (y1 - y2) * (z1 + z2)
    ny += (z1 - z2) * (x1 + x2)
    nz += (x1 - x2) * (y1 + y2)
  }
  return normalize([nx, ny, nz])
}

export interface OrientedFace {
  /** Índices de vértice reordenados (se preciso) pra que a normal aponte pra fora. */
  orderedVertexIndices: number[]
  normal: Vector3Tuple
}

/**
 * Recebe os índices de vértice de uma face NA ORDEM QUE FOR (não precisa
 * estar em sentido horário nem anti-horário específico) e devolve a normal
 * correta e a ordem de vértices que garante essa normal apontando pra fora
 * do sólido — assume que o sólido está centrado na origem (verdade pra
 * todos os poliedros regulares que usamos aqui), comparando a normal com a
 * direção do centróide da própria face.
 */
export function orientFaceOutward(vertices: Vector3Tuple[], vertexIndices: number[]): OrientedFace {
  const polygon = vertexIndices.map((i) => vertices[i])
  const faceCentroid = centroid(polygon)
  const normal = newellNormal(polygon)

  if (dot(normal, faceCentroid) < 0) {
    return {
      orderedVertexIndices: [...vertexIndices].reverse(),
      normal: scale(normal, -1)
    }
  }
  return { orderedVertexIndices: vertexIndices, normal }
}

/** Reescala um conjunto de vértices pra que a maior distância à origem vire exatamente `targetRadius`. */
export function normalizeToCircumradius(vertices: Vector3Tuple[], targetRadius: number): Vector3Tuple[] {
  const maxLength = Math.max(...vertices.map(length))
  return vertices.map((v) => scale(v, targetRadius / maxLength))
}

export interface PolyhedronFaceInput {
  /** Índices de vértice da face, em ordem ao redor do polígono (ver `orientFaceOutward`). */
  vertexIndices: number[]
  value: number
}

/**
 * Constrói o array `faces` de uma `DiceDefinition` a partir dos vértices e
 * das faces de um poliedro — a mesma orientação (`orientFaceOutward`) usada
 * aqui é reaproveitada por `buildPolyhedronGeometry.ts` pra desenhar a
 * malha, garantindo que a normal usada na leitura de resultado seja
 * idêntica à normal geométrica real da face renderizada.
 */
export function computePolyhedronFaces(
  vertices: Vector3Tuple[],
  faceInputs: PolyhedronFaceInput[]
): { id: number; value: number; normal: Vector3Tuple }[] {
  return faceInputs.map((input, id) => ({
    id,
    value: input.value,
    normal: orientFaceOutward(vertices, input.vertexIndices).normal
  }))
}
