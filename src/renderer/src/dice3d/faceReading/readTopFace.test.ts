import { describe, expect, it } from 'vitest'
import type { Vector3Tuple } from '@shared/types/dice3d'
import { D6_DEFINITION } from '../dice-defs/d6'
import { SETTLE_CONFIG } from '../config/physicsConfig'
import { readTopFace, type Quaternion } from './readTopFace'
import { normalize, quaternionFromTo } from './quaternionTestHelpers'

const WORLD_UP: Vector3Tuple = [0, 1, 0]

describe('readTopFace — d6', () => {
  for (const face of D6_DEFINITION.faces) {
    it(`lê ${face.value} quando a face de valor ${face.value} está forçada pra cima`, () => {
      const rotation = quaternionFromTo(face.normal, WORLD_UP)

      const reading = readTopFace(D6_DEFINITION, rotation, SETTLE_CONFIG.ambiguousFaceDotMargin)

      expect(reading.value).toBe(face.value)
      expect(reading.isAmbiguous).toBe(false)
      expect(reading.bestDot).toBeCloseTo(1, 5)
    })
  }

  it('marca como ambíguo um dado equilibrado exatamente entre duas faces (aresta)', () => {
    // face value=2 (normal +x) e value=3 (normal +y): a bissetriz delas é (1,1,0)/√2.
    // Alinhar essa bissetriz com "pra cima" deixa as duas faces igualmente inclinadas.
    const edgeBisector = normalize([1, 1, 0])
    const rotation = quaternionFromTo(edgeBisector, WORLD_UP)

    const reading = readTopFace(D6_DEFINITION, rotation, SETTLE_CONFIG.ambiguousFaceDotMargin)

    expect(reading.isAmbiguous).toBe(true)
    expect(reading.bestDot - reading.secondBestDot).toBeLessThan(SETTLE_CONFIG.ambiguousFaceDotMargin)
  })

  it('não é ambíguo quando uma face está claramente dominante (dado quase reto)', () => {
    // Pequena inclinação de 5° a partir da face value=1 (normal +z) — bem menos
    // que o suficiente pra se aproximar da segunda face mais próxima (a 90°).
    const tiltedAxis: Vector3Tuple = [1, 0, 0]
    const angle = (5 * Math.PI) / 180
    const rotation: Quaternion = {
      x: tiltedAxis[0] * Math.sin(angle / 2),
      y: 0,
      z: 0,
      w: Math.cos(angle / 2)
    }
    // Combina com a rotação que já alinha a face value=1 (+z) com "pra cima".
    const faceOne = D6_DEFINITION.faces.find((f) => f.value === 1)
    if (!faceOne) throw new Error('face value=1 não encontrada na definição do d6')
    const base = quaternionFromTo(faceOne.normal, WORLD_UP)

    // Composição de quaternions: rotation aplicada depois de base.
    const composed: Quaternion = {
      x: rotation.w * base.x + rotation.x * base.w + rotation.y * base.z - rotation.z * base.y,
      y: rotation.w * base.y - rotation.x * base.z + rotation.y * base.w + rotation.z * base.x,
      z: rotation.w * base.z + rotation.x * base.y - rotation.y * base.x + rotation.z * base.w,
      w: rotation.w * base.w - rotation.x * base.x - rotation.y * base.y - rotation.z * base.z
    }

    const reading = readTopFace(D6_DEFINITION, composed, SETTLE_CONFIG.ambiguousFaceDotMargin)

    expect(reading.value).toBe(1)
    expect(reading.isAmbiguous).toBe(false)
  })
})
