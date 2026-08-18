import type { Vector3Tuple } from '@shared/types/dice3d'
import type { Quaternion } from './readTopFace'

/**
 * Helpers usados só pelos testes (`*.test.ts`) — não é consumido por nenhum
 * código de produção. Constrói quaternions artificiais pra forçar uma face
 * específica apontando numa direção, sem depender de simulação física.
 */

function cross(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function normalize(v: Vector3Tuple): Vector3Tuple {
  const len = Math.sqrt(dot(v, v))
  return [v[0] / len, v[1] / len, v[2] / len]
}

/** Quaternion que rotaciona o vetor `from` até coincidir com `to` (rotação de menor arco). */
export function quaternionFromTo(from: Vector3Tuple, to: Vector3Tuple): Quaternion {
  const d = dot(from, to)

  if (d > 1 - 1e-9) {
    return { x: 0, y: 0, z: 0, w: 1 }
  }
  if (d < -1 + 1e-9) {
    const arbitrary: Vector3Tuple = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const axis = normalize(cross(from, arbitrary))
    return { x: axis[0], y: axis[1], z: axis[2], w: 0 }
  }

  const axis = cross(from, to)
  const s = Math.sqrt((1 + d) * 2)
  const invs = 1 / s
  return { x: axis[0] * invs, y: axis[1] * invs, z: axis[2] * invs, w: s * 0.5 }
}
