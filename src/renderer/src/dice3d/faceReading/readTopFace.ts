import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface FaceReading {
  value: number
  faceId: number
  /** Produto escalar da face vencedora com a direção decisiva (ver `FaceResultMode`). */
  bestDot: number
  /** Produto escalar da segunda colocada — quanto mais perto de `bestDot`, mais ambíguo. */
  secondBestDot: number
  /** ID da face vice-campeã — só usado pelo modo debug (Seção 25) pra desenhar sua normal. */
  secondFaceId: number
  /** true quando não há face claramente dominante (dado equilibrado numa aresta/vértice). */
  isAmbiguous: boolean
}

const WORLD_UP: Vector3Tuple = [0, 1, 0]
const WORLD_DOWN: Vector3Tuple = [0, -1, 0]

function dot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Rotaciona um vetor por um quaternion (fórmula otimizada, sem construir matriz). */
function rotateVector(v: Vector3Tuple, q: Quaternion): Vector3Tuple {
  const [vx, vy, vz] = v
  const tx = 2 * (q.y * vz - q.z * vy)
  const ty = 2 * (q.z * vx - q.x * vz)
  const tz = 2 * (q.x * vy - q.y * vx)
  return [
    vx + q.w * tx + (q.y * tz - q.z * ty),
    vy + q.w * ty + (q.z * tx - q.x * tz),
    vz + q.w * tz + (q.x * ty - q.y * tx)
  ]
}

/**
 * Determina qual face de um dado ficou "decisiva" a partir da orientação
 * final do corpo rígido — nunca a partir da câmera ou de qualquer estado de
 * UI. Transforma cada normal local pra espaço de mundo e compara com a
 * direção decisiva via produto escalar (ver `DiceDefinition.resultMode`):
 * `topFace` procura a face mais alinhada com "pra cima" (d6, d8, d10, d12,
 * d20); `bottomFace` procura a face mais alinhada com "pra baixo" — usado
 * pelo d4, cujo resultado tradicional é lido no vértice de cima, não numa
 * face de cima (ver comentário em `FaceResultMode`).
 *
 * `ambiguousMargin` viabiliza detectar equilíbrio instável: se a face
 * vencedora e a vice estão com produtos escalares quase iguais, não existe
 * dominância clara e o chamador não deve aceitar este resultado.
 */
export function readTopFace(
  definition: DiceDefinition,
  rotation: Quaternion,
  ambiguousMargin: number
): FaceReading {
  const targetDirection = definition.resultMode === 'topFace' ? WORLD_UP : WORLD_DOWN

  const scored = definition.faces
    .map((face) => ({
      face,
      dot: dot(rotateVector(face.normal, rotation), targetDirection)
    }))
    .sort((a, b) => b.dot - a.dot)

  const best = scored[0]
  const secondBest = scored[1]

  return {
    value: best.face.value,
    faceId: best.face.id,
    bestDot: best.dot,
    secondBestDot: secondBest.dot,
    secondFaceId: secondBest.face.id,
    isAmbiguous: best.dot - secondBest.dot < ambiguousMargin
  }
}
