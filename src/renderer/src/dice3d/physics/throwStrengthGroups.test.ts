import { beforeAll, describe, expect, it } from 'vitest'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { AVAILABLE_DICE_TYPES, DICE_REGISTRY } from '../dice-defs/registry'
import { MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { TRAY_SHAPES, TRAY_SHAPE_SIDES, trayApothem, trayRotation, traySafeHalfExtent } from '../geometry/trayShape'
import { readTopFace } from '../faceReading/readTopFace'
import { advanceDieRoll, hasFloorContact, resetDieRoll, type RollingDie } from './advanceDieRoll'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createPhysicsStepper } from './createPhysicsStepper'
import { createSettleTracker } from './createSettleTracker'
import { parkedCollisionGroups } from './collisionGroups'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon } from './regularPolygon'
import { ensureRapierReady } from './rapierContext'
import { tossDie } from './tossDie'
import { MOUTH_RELEASE_INTERVAL_MS, tossDieFromMouth, type ThrowStrength } from './tossDieFromMouth'

const STRENGTHS: ThrowStrength[] = ['leve', 'normal', 'forte', 'explosao']
type Origin = 'tray' | 'tower' | 'tower-decoration'
const ORIGINS: Origin[] = ['tray', 'tower', 'tower-decoration']
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
const EXHAUSTIVE = env?.REROLL_PHYSICS_EXHAUSTIVE === '1'
const STATISTICS = env?.REROLL_PHYSICS_STATISTICS === '1'

interface TestDie extends RollingDie {
  slot: { x: number; z: number }
  releaseMs: number
}

/** Usa o controlador e o acumulador REAIS, com quadros lentos e vários dados no mesmo mundo. */
function simulateGroup(types: PhysicalDiceSides[], strength: ThrowStrength, origin: Origin, traySides: number, repeats = 2): number[] {
  const world = createPhysicsWorld()
  const values: number[] = []
  try {
    const boundary = createBoundaryColliders(world, traySides)
    const slots = computeSpawnSlots(types.length, traySafeHalfExtent(traySides, SPAWN_CONFIG.slotSafeHalfExtent))
    const dice: TestDie[] = types.map((sides, i) => ({
      sides, body: DICE_REGISTRY[sides].createBody(world), tracker: createSettleTracker(),
      phase: 'queued', lastValue: null, enteringElapsedMs: 0, slot: slots[i], releaseMs: 0
    }))
    const context = { world, dice, floorHandles: boundary.floorHandles, traySides }
    let elapsedMs = 0
    const step = createPhysicsStepper(world, undefined, seconds => {
      elapsedMs += seconds * 1000
      for (const die of dice) {
        if (die.phase === 'queued' && elapsedMs >= die.releaseMs) {
          const definition = DICE_REGISTRY[die.sides].definition
          const options = { target: die.slot, sides: traySides, strength, basePhysics: definition.physics }
          die.strongLaunchDirection = (origin === 'tower'
            ? tossDieFromMouth(die.body, { ...options, radius: definition.scale * definition.boundingRadius })
            : tossDie(die.body, options)) ?? undefined
          resetDieRoll(die)
        }
        const result = advanceDieRoll(die, context, seconds * 1000)
        if (result === 'failed') throw new Error(`${origin}/${strength}/${traySides}: ${diagnostic(die)}`)
      }
    })
    for (let roll = 0; roll < repeats; roll++) {
      elapsedMs = 0
      for (const [i, die] of dice.entries()) {
        die.phase = 'queued'
        die.lastValue = null
        die.body.collider(0).setCollisionGroups(parkedCollisionGroups())
        die.body.setTranslation({ x: i * 2, y: -40, z: 0 }, true)
        die.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        die.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        die.releaseMs = origin === 'tower' ? i * MOUTH_RELEASE_INTERVAL_MS : 0
      }
      // 30 e 12 FPS: a lógica tem de observar todos os subpassos, não só o último quadro.
      for (let frame = 0; frame < 900 && !dice.every(d => d.phase === 'done'); frame++) {
        step(frame % 2 === 0 ? 1 / 30 : WORLD_CONFIG.maxStepsPerFrame / WORLD_CONFIG.physicsStepsPerSecond)
      }
      expect(dice.filter(d => d.phase !== 'done').map(diagnostic), `${origin}/${strength}/${traySides}, roll ${roll}`).toEqual([])
      for (const die of dice) {
        const p = die.body.translation()
        expect(isInsideRegularPolygon(p.x, p.z, trayApothem(traySides), traySides, 0, trayRotation(traySides)), diagnostic(die)).toBe(true)
        expect(hasFloorContact(die.body, context), diagnostic(die)).toBe(true)
        const definition = DICE_REGISTRY[die.sides].definition
        const reading = readTopFace(definition, die.body.rotation(), resolveAmbiguousMargin(definition))
        expect(reading.isAmbiguous, diagnostic(die)).toBe(false)
        expect(die.lastValue).toBe(reading.value)
        expect(die.lastValue).toBeGreaterThanOrEqual(1)
        expect(die.lastValue).toBeLessThanOrEqual(die.sides)
        expect(die.body.isCcdEnabled()).toBe(true)
        values.push(die.lastValue!)
      }
    }
    return values
  } finally {
    world.free()
  }
}

function diagnostic(die: RollingDie): string {
  return JSON.stringify({ sides: die.sides, phase: die.phase, p: die.body.translation(), v: die.body.linvel(), w: die.body.angvel(), recovery: die.recovery })
}

// Testa cada tipo sozinho, em dupla, em grupos de seis e no teto de vinte.
const groups: [string, PhysicalDiceSides[]][] = AVAILABLE_DICE_TYPES.flatMap(sides =>
  (EXHAUSTIVE ? [1, 2, 6, 20] : [20]).map(count => [`${count}d${sides}`, Array<PhysicalDiceSides>(count).fill(sides)] as [string, PhysicalDiceSides[]])
)
groups.push(['20 mistos', Array.from({ length: MAX_SIMULTANEOUS_DICE }, (_, i) => AVAILABLE_DICE_TYPES[i % AVAILABLE_DICE_TYPES.length])])
if (EXHAUSTIVE) {
  // Todas as 127 seleções de tipos, incluindo cada par, trio, ... até os sete juntos.
  for (let mask = 1; mask < 1 << AVAILABLE_DICE_TYPES.length; mask++) {
    const selection = AVAILABLE_DICE_TYPES.filter((_, index) => mask & (1 << index))
    groups.push([selection.map(s => `d${s}`).join('+'), selection])
  }
  // Todos os pares também com a bandeja cheia, para a colisão entre tamanhos diferentes.
  for (const [i, first] of AVAILABLE_DICE_TYPES.entries()) {
    for (const second of AVAILABLE_DICE_TYPES.slice(i + 1)) {
      groups.push([`10d${first}+10d${second}`, [...Array<PhysicalDiceSides>(10).fill(first), ...Array<PhysicalDiceSides>(10).fill(second)]])
    }
  }
}

describe('grupos em todas as velocidades, bandejas e origens — física de produção', () => {
  beforeAll(ensureRapierReady)
  for (const shape of TRAY_SHAPES) {
    for (const origin of ORIGINS) {
      for (const strength of STRENGTHS) {
        it(`${shape}/${origin}/${strength}: ${groups.length} grupos, duas rolagens seguidas`, () => {
          for (const [, types] of groups) simulateGroup(types, strength, origin, TRAY_SHAPE_SIDES[shape])
        }, 180000)
      }
    }
  }
})

describe.skipIf(!STATISTICS)('distribuição real por dado, força e origem — com a recuperação ativa', () => {
  beforeAll(ensureRapierReady)
  for (const origin of ['tray', 'tower'] as const) {
    for (const strength of STRENGTHS) {
      for (const sides of AVAILABLE_DICE_TYPES) {
        it(`${origin}/${strength}/d${sides}: 600 faces`, () => {
          const values = simulateGroup(Array<PhysicalDiceSides>(20).fill(sides), strength, origin, 6, 30)
          const counts = Array<number>(sides).fill(0)
          for (const value of values) counts[value - 1]++
          const expected = values.length / sides
          const chiSquared = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0)
          const degrees = sides - 1
          const cutoff = degrees + 6 * Math.sqrt(2 * degrees)
          console.log(JSON.stringify({ origin, strength, sides, samples: values.length, chiSquared, cutoff, counts }))
          expect(chiSquared).toBeLessThan(cutoff)
        }, 180000)
      }
    }
  }
})
