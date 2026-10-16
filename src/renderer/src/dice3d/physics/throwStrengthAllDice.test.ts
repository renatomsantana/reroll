import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { AVAILABLE_DICE_TYPES, DICE_REGISTRY } from '../dice-defs/registry'
import { TRAY_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { readTopFace } from '../faceReading/readTopFace'
import { applyNudge } from './applyNudge'
import { clampLinearVelocity } from './clampVelocity'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createSettleTracker } from './createSettleTracker'
import { diceEnteringCollisionGroups, restoreWallCollisionIfInside } from './collisionGroups'
import { ensureRapierReady } from './rapierContext'
import { isInsideRegularPolygon } from './regularPolygon'
import { tossDie } from './tossDie'
import {
  amortecerDepoisDaExplosao,
  EXPLOSION_FLIGHT_SPEED,
  restaurarFisicaDoDado,
  tossDieFromMouth,
  type LaunchDirection,
  type ThrowStrength
} from './tossDieFromMouth'

const FORCAS: ThrowStrength[] = ['leve', 'normal', 'forte', 'explosao']
const ORIGENS = ['bandeja', 'torre'] as const
const ROLAGENS_POR_COMBINACAO = 3
const MAX_STEPS = 12000

type Origem = (typeof ORIGENS)[number]

/** Uma rolagem pelo mesmo caminho da produção, inclusive a cauda amortecida do modo Explosão. */
function rolarAteAssentar(
  world: RAPIER.World,
  sides: PhysicalDiceSides,
  origem: Origem,
  forca: ThrowStrength,
  body: RAPIER.RigidBody
): number {
  const entry = DICE_REGISTRY[sides]
  const radius = entry.definition.scale * entry.definition.boundingRadius
  const options = {
    target: { x: 0, z: 0 },
    strength: forca,
    basePhysics: entry.definition.physics
  }
  let direction: LaunchDirection | null =
    origem === 'torre'
      ? tossDieFromMouth(body, { ...options, radius })
      : tossDie(body, options)
  let ricochetElapsedMs = 0
  let enteringElapsedMs = 0
  const tracker = createSettleTracker()
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000

  for (let step = 0; step < MAX_STEPS; step++) {
    clampLinearVelocity(body, direction?.speedCap ?? WORLD_CONFIG.maxLinearSpeed)
    world.step()

    const entering = body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
    if (entering) enteringElapsedMs += dtMs
    restoreWallCollisionIfInside(body, enteringElapsedMs)
    if (!entering) enteringElapsedMs = 0

    if (direction) {
      ricochetElapsedMs += dtMs
      const velocity = body.linvel()
      const returning = velocity.x * direction.x + velocity.z * direction.z
      if (returning < -0.8 || ricochetElapsedMs > 2200) {
        if (direction.speedCap === EXPLOSION_FLIGHT_SPEED) {
          amortecerDepoisDaExplosao(body, entry.definition.physics)
        } else {
          restaurarFisicaDoDado(body, entry.definition.physics)
        }
        direction = null
      }
    }

    const state = tracker.update(body, dtMs)
    if (state === 'settled') {
      const reading = readTopFace(entry.definition, body.rotation(), resolveAmbiguousMargin(entry.definition))
      if (reading.isAmbiguous) {
        applyNudge(body)
        tracker.reset()
      } else {
        return reading.value
      }
    } else if (state === 'stuck') {
      applyNudge(body)
      tracker.reset()
    }
  }

  const p = body.translation()
  const v = body.linvel()
  const w = body.angvel()
  throw new Error(
    `${origem}/${forca}/d${sides} não assentou: ` +
      `pos=(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}) ` +
      `vel=(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}) ` +
      `giro=(${w.x.toFixed(2)},${w.y.toFixed(2)},${w.z.toFixed(2)})`
  )
}

describe('todos os dados em todas as forças, com torre e sem torre', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  const combinacoes = ORIGENS.flatMap((origem) =>
    FORCAS.flatMap((forca) => AVAILABLE_DICE_TYPES.map((sides) => [origem, forca, sides] as const))
  )

  it.each(combinacoes)(
    '%s / %s / d%i — assenta dentro e lê uma face válida em três rolagens',
    (origem, forca, sides) => {
      const world = createPhysicsWorld()
      createBoundaryColliders(world)
      const body = DICE_REGISTRY[sides].createBody(world)

      for (let roll = 0; roll < ROLAGENS_POR_COMBINACAO; roll++) {
        const value = rolarAteAssentar(world, sides, origem, forca, body)
        const p = body.translation()
        expect(
          isInsideRegularPolygon(p.x, p.z, TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments, 0.5),
          `${origem}/${forca}/d${sides} saiu da bandeja na rolagem ${roll + 1}`
        ).toBe(true)
        expect(p.y).toBeGreaterThan(-1)
        expect(p.y).toBeLessThan(TRAY_CONFIG.wallHeight + 1)
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(sides)
      }

      world.free()
    },
    30000
  )
})
