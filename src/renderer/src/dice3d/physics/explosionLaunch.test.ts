import { beforeAll, describe, expect, it } from 'vitest'
import { DICE_REGISTRY } from '../dice-defs/registry'
import { TRAY_CONFIG, WORLD_CONFIG } from '../config/physicsConfig'
import { isInsideRegularPolygon } from './regularPolygon'
import { clampLinearVelocity } from './clampVelocity'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createPhysicsWorld } from './createPhysicsWorld'
import { diceEnteringCollisionGroups, restoreWallCollisionIfInside } from './collisionGroups'
import { ensureRapierReady } from './rapierContext'
import { tossDie } from './tossDie'
import { amortecerDepoisDaExplosao, tossDieFromMouth, type LaunchDirection } from './tossDieFromMouth'

describe('lançamento Explosão', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it.each(['bandeja', 'torre'] as const)('é absurdo, ricocheteia e continua contido: %s', (origem) => {
    const world = createPhysicsWorld()
    createBoundaryColliders(world)
    const entry = DICE_REGISTRY[20]
    const body = entry.createBody(world)
    const radius = entry.definition.scale * entry.definition.boundingRadius
    const options = {
      target: { x: 0, z: 0 },
      strength: 'explosao' as const,
      basePhysics: entry.definition.physics
    }
    const direction: LaunchDirection | null =
      origem === 'torre'
        ? tossDieFromMouth(body, { ...options, radius })
        : tossDie(body, options)

    expect(direction).not.toBeNull()
    expect(direction?.speedCap).toBeGreaterThan(40)
    expect(Math.hypot(body.linvel().x, body.linvel().z)).toBeGreaterThan(40)
    expect(body.isCcdEnabled()).toBe(true)

    const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
    let entrandoMs = 0
    let entrou = false
    let ricocheteou = false

    for (let step = 0; step < 1200; step++) {
      clampLinearVelocity(body, direction?.speedCap ?? WORLD_CONFIG.maxLinearSpeed)
      world.step()

      const entrando = body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
      if (entrando) entrandoMs += dtMs
      restoreWallCollisionIfInside(body, entrandoMs)

      const position = body.translation()
      if (isInsideRegularPolygon(position.x, position.z, TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments, -radius)) {
        entrou = true
      }

      if (entrou && direction) {
        const velocity = body.linvel()
        const returning = velocity.x * direction.x + velocity.z * direction.z
        if (returning < -0.8 && !ricocheteou) {
          ricocheteou = true
          amortecerDepoisDaExplosao(body, entry.definition.physics)
        }
      }
    }

    const final = body.translation()
    expect(entrou).toBe(true)
    expect(ricocheteou).toBe(true)
    expect(isInsideRegularPolygon(final.x, final.z, TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments, 0.5)).toBe(true)
    expect(final.y).toBeGreaterThan(-1)
    expect(body.isCcdEnabled()).toBe(false)
    world.free()
  })
})
