import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker, type SettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDie } from './tossDie'
import { restoreWallCollisionIfInside } from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon } from './regularPolygon'
import { readTopFace } from '../faceReading/readTopFace'
import { MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG, TRAY_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { createD6Body } from '../dice-defs/buildD6Body'
import { D6_DEFINITION } from '../dice-defs/d6'

/**
 * Regressão pro bug relatado: com muitos dados colidindo entre si, a energia
 * acumulada das colisões podia jogar um dado alto o bastante pra passar por
 * cima de uma parede baixa demais — acima da parede não existe collider
 * nenhum (ver `createBoundaryColliders.ts`), então o dado "escapava" e caía
 * pra sempre, fora da bandeja e fora de vista. Roda a física de verdade
 * (mesmo `world.step()`, mesmo `tossDie`, mesma lógica de settle/nudge usada
 * em produção) com o número MÁXIMO de dados simultâneos que o app permite —
 * o pior caso real, não um cenário artificial.
 *
 * NOTA HONESTA (arremesso de fora E DE CIMA da bandeja, ver `tossDie.ts`/`SPAWN_CONFIG`):
 * a pedido do usuário, o arremesso agora nasce bem mais alto (parecendo alguém em pé
 * jogando os dados pra dentro), o que aumenta o tempo que cada dado passa "entrando"
 * (ignorando a parede, ver `collisionGroups.ts`) e, por consequência, a chance de colisão
 * no meio do ar com outro dado simultâneo antes de cruzar pra dentro. Testado
 * exaustivamente (sweep de contagens 1-16, 20 rolagens cada): 1-10 dados simultâneos
 * ficam ~90%+ confiáveis neste teste de estresse (5 rolagens seguidas reaproveitando os
 * mesmos corpos — mais dura que o uso real), 12+ degrada visivelmente. Por isso
 * `MAX_SIMULTANEOUS_DICE` foi reduzido de 24 pra 10 — preferiu-se manter o arremesso
 * dramático pedido e reduzir o teto de dados simultâneos, a suavizar o arremesso pra caber
 * mais dados de uma vez. A bandeja também foi aumentada depois (halfExtent 5.5→6.5, a
 * pedido do usuário) na esperança de espalhar mais os slots de pouso e reduzir ainda mais a
 * densidade de colisão durante a entrada — resultado empírico misto (~80-90% neste teste de
 * estresse, dentro do ruído estatístico da amostra pequena de execuções, sem melhora nem
 * piora clara). Ainda assim este teste não é 100% garantido mesmo em 10 — é sinal
 * real de uma cauda estatística inerente a simular vários corpos rígidos convergindo ao
 * mesmo tempo, não algo a esconder enfraquecendo a asserção ou pulando o teste.
 */
function simulateAllUntilSettled(
  world: RAPIER.World,
  dice: { body: RAPIER.RigidBody; tracker: SettleTracker }[],
  maxSteps: number
): void {
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  const settled = new Set<number>()

  for (let step = 0; step < maxSteps && settled.size < dice.length; step++) {
    world.step()

    dice.forEach((die, index) => {
      clampLinearVelocity(die.body, WORLD_CONFIG.maxLinearSpeed)
      restoreWallCollisionIfInside(die.body)
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
