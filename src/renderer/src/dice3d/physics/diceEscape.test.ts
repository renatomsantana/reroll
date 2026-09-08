import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker, type SettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDie } from './tossDie'
import { diceEnteringCollisionGroups, restoreWallCollisionIfInside } from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon } from './regularPolygon'
import { readTopFace } from '../faceReading/readTopFace'
import { MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG, TRAY_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { createD6Body } from '../dice-defs/buildD6Body'
import { D6_DEFINITION } from '../dice-defs/d6'

/**
 * Regressão pro bug relatado: com muitos dados colidindo entre si, a energia acumulada podia jogar um
 * dado alto o bastante pra passar por cima de uma parede baixa demais — acima da parede não existe
 * collider nenhum, então o dado escapava e caía pra sempre, fora da bandeja e fora de vista. Roda a
 * física de verdade (mesmo `world.step()`, mesmo `tossDie`, mesma lógica de settle e nudge) com o
 * número MÁXIMO de dados simultâneos que o app permite: o pior caso real, não um cenário artificial.
 *
 * NOTA HONESTA: com o arremesso de fora e de cima, cada dado passa mais tempo "entrando" (ignorando a
 * parede), e com isso cresce a chance de colisão no ar antes de cruzar pra dentro. Medido num sweep de
 * 1 a 16 dados, 20 rolagens cada: até 10 simultâneos o teste fica ~90% confiável na forma de estresse
 * usada aqui (5 rolagens seguidas reaproveitando os mesmos corpos, mais dura que o uso real), e de 12
 * pra cima degrada visivelmente. Foi por isso que o teto caiu de 24 pra 10 na época — preferiu-se
 * manter o arremesso dramático a suavizá-lo pra caber mais dados.
 *
 * Ainda assim este teste não é 100% garantido: é a cauda estatística inerente a simular vários corpos
 * rígidos convergindo ao mesmo tempo, e não algo a esconder enfraquecendo a asserção.
 */
function simulateAllUntilSettled(
  world: RAPIER.World,
  dice: { body: RAPIER.RigidBody; tracker: SettleTracker; entrandoMs: number }[],
  maxSteps: number
): void {
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  const settled = new Set<number>()

  for (let step = 0; step < maxSteps && settled.size < dice.length; step++) {
    world.step()

    dice.forEach((die, index) => {
      /**
       * Tempo em fase de ENTRADA, contabilizado como o app faz (ver `DiceCanvasMulti`).
       *
       * Passar `0` aqui — o que este teste fazia — DESLIGA o resgate de
       * `ENTRY_FORCE_PUSH_TIMEOUT_MS`. Um dado que sai e não cruza pra dentro fica com os grupos de
       * "entrando", que não colidem com a parede, e cai pelo vazio: o diagnóstico achou um em
       * y = -4672, com 41 cutucadas, e o teste relatando "14 de 15 assentaram".
       *
       * Era esta a origem da instabilidade destes testes desde 18/08 — não física indeterminada, e
       * sim o teste desligando a rede de segurança que a produção tem.
       */
      clampLinearVelocity(die.body, WORLD_CONFIG.maxLinearSpeed)
      const entrando =
        die.body.numColliders() > 0 &&
        die.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
      if (entrando) die.entrandoMs += dtMs
      restoreWallCollisionIfInside(die.body, die.entrandoMs)
      if (!entrando) die.entrandoMs = 0
      if (settled.has(index)) return

      const state = die.tracker.update(die.body, dtMs)
      if (state === 'settled') {
        const reading = readTopFace(D6_DEFINITION, die.body.rotation(), resolveAmbiguousMargin(D6_DEFINITION))
        if (reading.isAmbiguous) {
          applyNudge(die.body)
          die.tracker.reset()
        } else {
          settled.add(index)
        }
      } else if (state === 'stuck') {
        applyNudge(die.body)
        die.tracker.reset()
      }
    })
  }

  if (settled.size < dice.length) {
    throw new Error(
      `${dice.length - settled.size} de ${dice.length} dados não assentaram dentro do limite de passos do teste`
    )
  }
}

describe('contenção da bandeja — dados não devem escapar por cima da parede', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it(
    `${MAX_SIMULTANEOUS_DICE} d6 simultâneos (o máximo permitido pelo app) continuam dentro da bandeja após assentar, em várias rolagens seguidas`,
    () => {
      const world = createPhysicsWorld()
      createBoundaryColliders(world)

      const slots = computeSpawnSlots(MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG.slotSafeHalfExtent)
      const dice = slots.map((slot) => ({
        body: createD6Body(world),
        tracker: createSettleTracker(),
        /** Tempo em fase de ENTRADA — alimenta o resgate; ver o comentário no laço. */
        entrandoMs: 0,
        slot
      }))

      const TRIALS = 5
      const MAX_STEPS_PER_TRIAL = 6000
      // Colisor do dado tem meio-lado ~D6_DEFINITION.scale/2 — uma margem folgada
      // além da parede detecta "voou por cima e caiu do lado de fora", sem falsos
      // positivos por um dado só encostando na parede por dentro.
      const WALL_CROSS_MARGIN = 0.5

      for (let trial = 0; trial < TRIALS; trial++) {
        for (const die of dice) {
          tossDie(die.body, { target: die.slot })
          die.tracker.reset()
        }

        simulateAllUntilSettled(world, dice, MAX_STEPS_PER_TRIAL)

        for (const die of dice) {
          const t = die.body.translation()
          // Teste de semiplanos contra o hexágono de verdade (não uma caixa envolvente) —
          // um dado que escapou por cima de UM lado específico da parede não escaparia
          // dessa checagem só por ainda estar dentro da caixa envolvente nos outros eixos.
          expect(isInsideRegularPolygon(t.x, t.z, TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments, WALL_CROSS_MARGIN)).toBe(
            true
          )
          // Não atravessou o chão nem ficou "voando" empoleirado sem nunca descer.
          expect(t.y).toBeGreaterThan(-1)
          expect(t.y).toBeLessThan(TRAY_CONFIG.wallHeight + 1)
        }
      }

      world.free()
    },
    60000
  )
})
