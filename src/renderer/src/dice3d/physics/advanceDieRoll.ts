import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { DICE_REGISTRY } from '../dice-defs/registry'
import { SETTLE_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { trayApothem, trayRotation } from '../geometry/trayShape'
import { readTopFace } from '../faceReading/readTopFace'
import { randomInRange, randomQuaternion } from '../utils/random'
import { applyNudge } from './applyNudge'
import { clampLinearVelocity } from './clampVelocity'
import { diceEnteringCollisionGroups, diceNormalCollisionGroups, restoreWallCollisionIfInside } from './collisionGroups'
import type { SettleTracker } from './createSettleTracker'
import { isInsideRegularPolygon } from './regularPolygon'
import { amortecerDepoisDaExplosao, EXPLOSION_FLIGHT_SPEED, restaurarFisicaDoDado, type LaunchDirection } from './tossDieFromMouth'

export interface RollingDie {
  sides: PhysicalDiceSides
  body: RAPIER.RigidBody
  tracker: SettleTracker
  phase: 'queued' | 'rolling' | 'done'
  lastValue: number | null
  enteringElapsedMs: number
  strongLaunchDirection?: LaunchDirection
  strongLaunchElapsedMs?: number
  recovery?: { elapsedMs: number; nudges: number; relaunches: number }
}

export interface RollPhysicsContext {
  world: RAPIER.World
  dice: readonly RollingDie[]
  floorHandles: ReadonlySet<number>
  traySides: number
}

/** O limite é por tentativa, sem ser reiniciado por cada cutucada de uma pilha. */
export const ROLL_RECOVERY_MS = 6000
export const MAX_DIE_RELAUNCHES = 3

export function resetDieRoll(die: RollingDie): void {
  die.tracker.reset()
  die.recovery = { elapsedMs: 0, nudges: 0, relaunches: 0 }
  die.phase = 'rolling'
  die.lastValue = null
  die.enteringElapsedMs = 0
  die.strongLaunchElapsedMs = 0
}

/** Só o contato com o piso vale: dormir em cima de outro dado não conclui a leitura. */
export function hasFloorContact(body: RAPIER.RigidBody, context: RollPhysicsContext): boolean {
  if (body.numColliders() === 0) return false
  let contact = false
  for (const handle of context.floorHandles) {
    context.world.contactPair(body.collider(0), context.world.getCollider(handle), manifold => {
      for (let i = 0; i < manifold.numContacts(); i++) {
        if (manifold.contactDist(i) <= 0.015) contact = true
      }
    })
  }
  return contact
}

/**
 * Desfaz um enrosco soltando APENAS o dado preso sobre um lugar livre da bandeja. Não consulta
 * valor/face para escolher o lugar nem a orientação; ambos vêm do mesmo RNG criptográfico do
 * lançamento. É outra queda simulada, nunca um número imposto ou um giro até a face desejada.
 */
function relaunchStuckDie(die: RollingDie, context: RollPhysicsContext): boolean {
  const recovery = die.recovery!
  if (recovery.relaunches >= MAX_DIE_RELAUNCHES) return false
  const definition = DICE_REGISTRY[die.sides].definition
  const radius = definition.scale * definition.boundingRadius
  const safeRadius = trayApothem(context.traySides) - radius - 0.35
  let candidate = { x: 0, z: 0 }
  let bestClearance = -Infinity
  for (let i = 0; i < 128; i++) {
    const angle = randomInRange([0, Math.PI * 2])
    const distance = safeRadius * Math.sqrt(randomInRange([0, 1]))
    const point = { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance }
    let clearance = Infinity
    for (const other of context.dice) {
      if (other === die || other.phase === 'queued') continue
      const p = other.body.translation()
      const otherDefinition = DICE_REGISTRY[other.sides].definition
      clearance = Math.min(clearance, Math.hypot(p.x - point.x, p.z - point.z) - radius - otherDefinition.scale * otherDefinition.boundingRadius)
    }
    if (clearance > bestClearance) {
      bestClearance = clearance
      candidate = point
    }
    if (clearance > 0.2) break
  }
  restaurarFisicaDoDado(die.body, definition.physics)
  die.body.collider(0).setCollisionGroups(diceNormalCollisionGroups())
  die.body.setTranslation({ ...candidate, y: radius + 1.4 }, true)
  const [x, y, z, w] = randomQuaternion()
  die.body.setRotation({ x, y, z, w }, true)
  die.body.setLinvel({ x: 0, y: -0.3, z: 0 }, true)
  die.body.setAngvel({ x: randomInRange([-5, 5]), y: randomInRange([-5, 5]), z: randomInRange([-5, 5]) }, true)
  die.strongLaunchDirection = undefined
  die.strongLaunchElapsedMs = 0
  die.enteringElapsedMs = 0
  die.phase = 'rolling'
  die.lastValue = null
  die.tracker.reset()
  recovery.elapsedMs = 0
  recovery.nudges = 0
  recovery.relaunches++
  return true
}

/** Compartilhado entre a cena e os testes; chamado após CADA passo fixo da física. */
export function advanceDieRoll(die: RollingDie, context: RollPhysicsContext, dtMs: number): 'moving' | 'settled' | 'failed' {
  if (die.phase === 'queued' || dtMs <= 0) return 'moving'
  // Rapier acorda um corpo quando outro o atinge. Enquanto dorme, sua leitura e apoio continuam
  // iguais; dispensar nova ordenação das 100 faces a cada passo torna a bandeja cheia mais leve.
  if (die.phase === 'done' && die.body.isSleeping()) return 'settled'
  const definition = DICE_REGISTRY[die.sides].definition
  clampLinearVelocity(die.body, die.strongLaunchDirection?.speedCap ?? WORLD_CONFIG.maxLinearSpeed)
  if (die.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()) die.enteringElapsedMs += dtMs
  restoreWallCollisionIfInside(die.body, die.enteringElapsedMs, context.traySides, dtMs)
  const entering = die.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
  if (!entering) die.enteringElapsedMs = 0

  if (die.strongLaunchDirection) {
    die.strongLaunchElapsedMs = (die.strongLaunchElapsedMs ?? 0) + dtMs
    const velocity = die.body.linvel()
    const returning = velocity.x * die.strongLaunchDirection.x + velocity.z * die.strongLaunchDirection.z
    if (returning < -0.8 || die.strongLaunchElapsedMs > 2200) {
      if (die.strongLaunchDirection.speedCap === EXPLOSION_FLIGHT_SPEED) amortecerDepoisDaExplosao(die.body, definition.physics)
      else restaurarFisicaDoDado(die.body, definition.physics)
      die.strongLaunchDirection = undefined
      die.strongLaunchElapsedMs = 0
    }
  }

  const recovery = die.recovery ??= { elapsedMs: 0, nudges: 0, relaunches: 0 }
  const p = die.body.translation()
  // Defesa adicional contra estados inválidos do solver: nunca deixar um corpo cair para sempre.
  if (![p.x, p.y, p.z].every(Number.isFinite) || p.y < -1 || p.y > 30) {
    return relaunchStuckDie(die, context) ? 'moving' : 'failed'
  }

  const inside = !entering && isInsideRegularPolygon(p.x, p.z, trayApothem(context.traySides), context.traySides, 0, trayRotation(context.traySides))
  if (die.phase === 'done') {
    const reading = readTopFace(definition, die.body.rotation(), resolveAmbiguousMargin(definition))
    const v = die.body.linvel()
    const w = die.body.angvel()
    // Outro dado ainda rolando pode derrubar um já contado. A leitura final tem que corresponder
    // ao que TODOS mostram no fim, e não a uma face lida antes de um encontrão posterior.
    if (inside && hasFloorContact(die.body, context) && !reading.isAmbiguous && reading.value === die.lastValue && Math.hypot(v.x, v.y, v.z) < SETTLE_CONFIG.linearVelocitySleepThreshold && Math.hypot(w.x, w.y, w.z) < SETTLE_CONFIG.angularVelocitySleepThreshold) return 'settled'
    die.phase = 'rolling'
    die.lastValue = null
    die.tracker.reset()
    recovery.elapsedMs = 0
  }

  recovery.elapsedMs += dtMs
  const state = die.tracker.update(die.body, dtMs)
  if (state === 'settled' && inside && !die.strongLaunchDirection) {
    const reading = readTopFace(definition, die.body.rotation(), resolveAmbiguousMargin(definition))
    if (!reading.isAmbiguous && hasFloorContact(die.body, context)) {
      die.phase = 'done'
      die.lastValue = reading.value
      return 'settled'
    }
    if (recovery.nudges < 2) {
      applyNudge(die.body)
      die.tracker.reset()
      recovery.nudges++
    } else {
      return relaunchStuckDie(die, context) ? 'moving' : 'failed'
    }
  }
  if (recovery.elapsedMs >= ROLL_RECOVERY_MS) return relaunchStuckDie(die, context) ? 'moving' : 'failed'
  return 'moving'
}
