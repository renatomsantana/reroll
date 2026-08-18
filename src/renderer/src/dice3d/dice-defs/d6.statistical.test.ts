import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import { ensureRapierReady } from '../physics/rapierContext'
import { createPhysicsWorld } from '../physics/createPhysicsWorld'
import { createBoundaryColliders } from '../physics/createBoundaryColliders'
import { createSettleTracker } from '../physics/createSettleTracker'
import { applyNudge } from '../physics/applyNudge'
import { restoreWallCollisionIfInside } from '../physics/collisionGroups'
import { readTopFace } from '../faceReading/readTopFace'
import { SETTLE_CONFIG, WORLD_CONFIG } from '../config/physicsConfig'
import { createD6Body, tossD6 } from './buildD6Body'
import { D6_DEFINITION } from './d6'

/**
 * Roda a simulação de física de verdade (mesmo `world.step()`, mesmo
 * `readTopFace`, mesma lógica de ambiguidade/nudge usada em produção) até o
 * dado assentar com uma face não ambígua. Sem Three.js, sem canvas, sem
 * `requestAnimationFrame` — só o loop de passos fixos rodando o mais rápido
 * possível.
 */
function simulateOneRoll(world: RAPIER.World, body: RAPIER.RigidBody, maxSteps: number): number {
  tossD6(body)
  const tracker = createSettleTracker()
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000

  for (let i = 0; i < maxSteps; i++) {
    world.step()
    restoreWallCollisionIfInside(body)
    const state = tracker.update(body, dtMs)

    if (state === 'settled') {
      const reading = readTopFace(D6_DEFINITION, body.rotation(), SETTLE_CONFIG.ambiguousFaceDotMargin)
      if (!reading.isAmbiguous) return reading.value
      applyNudge(body)
      tracker.reset()
    } else if (state === 'stuck') {
      applyNudge(body)
      tracker.reset()
    }
  }

  throw new Error('Dado não assentou dentro do limite de passos do teste — possível bug no settle tracker')
}

const ROLL_COUNT = 1500
const MAX_STEPS_PER_ROLL = 8000

/**
 * Qui-quadrado, 5 graus de liberdade (6 faces − 1), alpha = 0,001. De
 * propósito bem permissivo: isto é um teste de "viés grosseiro" (geometria
 * ou física quebrada), não uma verificação estatística formal de dado
 * honesto. Rolagens físicas têm mais variância do que amostragem
 * puramente aleatória, e o objetivo é nunca falhar por flutuação normal —
 * só pegar um viés real (por exemplo, centro de massa deslocado ou
 * assimetria na numeração).
 */
const CHI_SQUARE_CRITICAL_VALUE_DF5_ALPHA_0_001 = 20.515

describe('distribuição estatística de rolagens do d6 (física real, headless)', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it(
    `não mostra viés grosseiro em ${ROLL_COUNT} rolagens simuladas`,
    () => {
      const world = createPhysicsWorld()
      createBoundaryColliders(world)
      const body = createD6Body(world)

      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      for (let i = 0; i < ROLL_COUNT; i++) {
        const value = simulateOneRoll(world, body, MAX_STEPS_PER_ROLL)
        counts[value] += 1
      }

      world.free()

      const expected = ROLL_COUNT / 6
      const chiSquare = Object.values(counts).reduce(
        (sum, observed) => sum + (observed - expected) ** 2 / expected,
        0
      )

      // eslint-disable-next-line no-console
      console.log('Distribuição observada:', counts, '— qui-quadrado:', chiSquare.toFixed(2))

      for (const value of [1, 2, 3, 4, 5, 6]) {
        expect(counts[value]).toBeGreaterThan(0)
      }
      expect(chiSquare).toBeLessThan(CHI_SQUARE_CRITICAL_VALUE_DF5_ALPHA_0_001)
    },
    60000
  )
})
