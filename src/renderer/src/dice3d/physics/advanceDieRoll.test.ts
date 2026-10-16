import { beforeAll, describe, expect, it } from 'vitest'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { DICE_REGISTRY } from '../dice-defs/registry'
import { WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { readTopFace } from '../faceReading/readTopFace'
import { advanceDieRoll, hasFloorContact, MAX_DIE_RELAUNCHES, resetDieRoll, type RollingDie } from './advanceDieRoll'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createSettleTracker } from './createSettleTracker'
import { ensureRapierReady } from './rapierContext'

const DT_MS = 1000 / WORLD_CONFIG.physicsStepsPerSecond

function setup(types: PhysicalDiceSides[]) {
  const world = createPhysicsWorld()
  const { floorHandles } = createBoundaryColliders(world)
  const dice: RollingDie[] = types.map(sides => ({
    sides, body: DICE_REGISTRY[sides].createBody(world), tracker: createSettleTracker(),
    phase: 'rolling', lastValue: null, enteringElapsedMs: 0
  }))
  return { world, floorHandles, dice, traySides: 6 }
}

describe('recuperação de dados sem alterar o resultado', () => {
  beforeAll(ensureRapierReady)

  it('desfaz uma pilha de seis d6 e só conta faces apoiadas no piso', () => {
    const context = setup([6, 6, 6, 6, 6, 6])
    try {
      context.dice.forEach((die, i) => {
        die.body.setTranslation({ x: 0, y: 0.35 + i * 0.7, z: 0 }, true)
        die.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
        resetDieRoll(die)
      })
      for (let i = 0; i < 1800; i++) {
        context.world.step()
        for (const die of context.dice) expect(advanceDieRoll(die, context, DT_MS)).not.toBe('failed')
        if (context.dice.every(d => d.phase === 'done')) break
      }
      expect(context.dice.every(d => d.phase === 'done')).toBe(true)
      for (const die of context.dice) {
        expect(hasFloorContact(die.body, context)).toBe(true)
        const definition = DICE_REGISTRY[die.sides].definition
        expect(die.lastValue).toBe(readTopFace(definition, die.body.rotation(), resolveAmbiguousMargin(definition)).value)
      }
    } finally { context.world.free() }
  })

  it('resgata um dado que atravessou o piso sem inventar uma face', () => {
    const context = setup([4])
    try {
      const die = context.dice[0]
      die.body.setTranslation({ x: 0, y: -400, z: 0 }, true)
      expect(advanceDieRoll(die, context, DT_MS)).toBe('moving')
      expect(die.body.translation().y).toBeGreaterThan(0)
      expect(die.lastValue).toBeNull()
      expect(die.body.isCcdEnabled()).toBe(true)
      for (let i = 0; i < 1200 && die.phase !== 'done'; i++) {
        context.world.step()
        expect(advanceDieRoll(die, context, DT_MS)).not.toBe('failed')
      }
      expect(die.phase).toBe('done')
      expect(hasFloorContact(die.body, context)).toBe(true)
    } finally { context.world.free() }
  })

  it('reabre a leitura de um dado já contado que recebe outra pancada', () => {
    const context = setup([6])
    try {
      const die = context.dice[0]
      die.body.setTranslation({ x: 0, y: 0.35, z: 0 }, true)
      for (let i = 0; i < 600 && die.phase !== 'done'; i++) {
        context.world.step()
        advanceDieRoll(die, context, DT_MS)
      }
      expect(die.phase).toBe('done')
      die.body.applyImpulse({ x: 1, y: 2, z: 0 }, true)
      context.world.step()
      expect(advanceDieRoll(die, context, DT_MS)).toBe('moving')
      expect(die.phase).toBe('rolling')
      expect(die.lastValue).toBeNull()
    } finally { context.world.free() }
  })

  it('tem saída explícita para um solver que não se recupera, em vez de um spinner infinito', () => {
    const context = setup([20])
    try {
      const die = context.dice[0]
      resetDieRoll(die)
      for (let i = 0; i < MAX_DIE_RELAUNCHES; i++) {
        die.body.setTranslation({ x: 0, y: -40, z: 0 }, true)
        expect(advanceDieRoll(die, context, DT_MS)).toBe('moving')
        expect(die.lastValue).toBeNull()
      }
      die.body.setTranslation({ x: 0, y: -40, z: 0 }, true)
      expect(advanceDieRoll(die, context, DT_MS)).toBe('failed')
      expect(die.lastValue).toBeNull()
    } finally { context.world.free() }
  })
})
