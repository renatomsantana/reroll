import * as THREE from 'three'
import type { Vector3Tuple } from '@shared/types/dice3d'
import {
  cross,
  dot,
  normalize,
  orientFaceOutward,
  subtract,
  type PolyhedronFaceInput
} from './polyhedronMath'

export interface BuiltPolyhedronFace {
  value: number
  normal: Vector3Tuple
}

export interface BuiltPolyhedron {
  geometry: THREE.BufferGeometry
  /** Uma entrada por face, na mesma ordem dos grupos de material da geometria (índice N ↔ material N). */
  faces: BuiltPolyhedronFace[]
}

/**
 * Altura do número (fração da altura do canvas) nas faces de poliedros
 * genéricos (d8/d10/d12/d20) — independente da fração usada pelo d6/d4, que
 * têm formas de face diferentes e não passam por este arquivo. Reduzido em
 * relação ao padrão porque uma face triangular/pentagonal tem bem menos
 * área "segura" que uma face quadrada do mesmo tamanho de caixa.
 */
export const POLYHEDRON_NUMBER_FONT_HEIGHT_FRACTION = 0.3

/**
 * Raio (em unidades de UV normalizado, onde o canvas tem "raio" 0,5) até
 * onde o glifo do número se estende a partir do centro — derivado da altura
 * da fonte acima, com uma folga pra números de 2 dígitos (mais largos que altos).
 */
const NUMBER_GLYPH_SAFE_RADIUS = POLYHEDRON_NUMBER_FONT_HEIGHT_FRACTION * 0.6

/**
 * Projeta os vértices de uma face (triângulo, "papagaio" ou pentágono) num
 * plano 2D local, centraliza no CENTRÓIDE da face (não na caixa
 * delimitadora — que fica descentralizada em formas assimétricas como
 * triângulo/pentágono) e escala pelo maior círculo que cabe dentro do
 * polígono sem furar nenhuma borda (distância mínima do centróide até cada
 * aresta). Isso garante o número sempre do mesmo tamanho relativo e
 * centralizado de verdade, em qualquer formato de face — ao contrário de
 * ajustar pela caixa delimitadora, que sub-representa a área útil real de
 * formas não retangulares.
 */
function computeFaceUVs(points: Vector3Tuple[], normal: Vector3Tuple): [number, number][] {
  const uAxis = normalize(subtract(points[1], points[0]))
  const vAxis = normalize(cross(normal, uAxis))
  const projected = points.map((p): [number, number] => [dot(p, uAxis), dot(p, vAxis)])

  const centroidU = projected.reduce((sum, p) => sum + p[0], 0) / projected.length
  const centroidV = projected.reduce((sum, p) => sum + p[1], 0) / projected.length

  let safeRadius = Infinity
  for (let i = 0; i < projected.length; i++) {
    const [ax, ay] = projected[i]
    const [bx, by] = projected[(i + 1) % projected.length]
    const edgeLength = Math.hypot(bx - ax, by - ay)
    const edgeDirX = (bx - ax) / edgeLength
    const edgeDirY = (by - ay) / edgeLength
    // distância perpendicular do centróide até a reta desta aresta
    const distance = Math.abs((centroidU - ax) * edgeDirY - (centroidV - ay) * edgeDirX)
    safeRadius = Math.min(safeRadius, distance)
  }

  const uvScale = NUMBER_GLYPH_SAFE_RADIUS / safeRadius

  return projected.map(([u, v]) => [
    0.5 + (u - centroidU) * uvScale,
    0.5 + (v - centroidV) * uvScale
  ])
}

/**
 * Constrói uma `BufferGeometry` a partir de vértices + faces explícitas
 * (triângulos, "papagaios" de 4 vértices ou pentágonos — qualquer polígono
 * convexo). Cada face vira um grupo de material próprio (fan-triangulado a
 * partir do primeiro vértice) com vértices duplicados por face — isso dá
 * shading "facetado" correto automaticamente via `computeVertexNormals`
 * (vértices não são compartilhados entre faces, então não há média de
 * normais entre faces vizinhas) e permite UV independente por face.
 */
export function buildPolyhedronGeometry(
  vertices: Vector3Tuple[],
  faceInputs: PolyhedronFaceInput[]
): BuiltPolyhedron {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const faces: BuiltPolyhedronFace[] = []

  const geometry = new THREE.BufferGeometry()

  for (const faceInput of faceInputs) {
    const { orderedVertexIndices, normal } = orientFaceOutward(vertices, faceInput.vertexIndices)
    const facePoints = orderedVertexIndices.map((i) => vertices[i])
    const faceUVs = computeFaceUVs(facePoints, normal)

    const localBase = positions.length / 3
    for (let i = 0; i < facePoints.length; i++) {
      positions.push(...facePoints[i])
      uvs.push(...faceUVs[i])
    }

    const groupStart = indices.length
    for (let i = 1; i < facePoints.length - 1; i++) {
      indices.push(localBase, localBase + i, localBase + i + 1)
    }
    geometry.addGroup(groupStart, indices.length - groupStart, faces.length)

    faces.push({ value: faceInput.value, normal })
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return { geometry, faces }
}
