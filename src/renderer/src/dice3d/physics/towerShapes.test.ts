import { beforeAll, describe, expect, it } from 'vitest'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDieFromMouth, MOUTH_RELEASE_INTERVAL_MS } from './tossDieFromMouth'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon } from './regularPolygon'
import {
  diceEnteringCollisionGroups,
  parkedCollisionGroups,
  restoreWallCollisionIfInside
} from './collisionGroups'
import { readTopFace } from '../faceReading/readTopFace'
import {
  MAX_SIMULTANEOUS_DICE,
  SPAWN_CONFIG,
  WORLD_CONFIG,
  resolveAmbiguousMargin
} from '../config/physicsConfig'
import { DICE_REGISTRY } from '../dice-defs/registry'
import {
  TRAY_SHAPES,
  TRAY_SHAPE_SIDES,
  trayApothem,
  traySafeHalfExtent,
  trayRotation,
  type TrayShape
} from '../geometry/trayShape'
import { computeTowerBesideLayout } from '../geometry/towerBesideTrayLayout'

/**
 * Lançamento PELA TORRE em cada formato de bandeja.
 *
 * `towerMouthSpawn.test.ts` já cobre os sete tipos de dado, mas só no hexágono. Quando a forma virou
 * escolha do usuário, a torre passou a se mudar junto: ela encosta no meio de uma FACE, e tanto a
 * distância quanto o ângulo mudam com a forma (no quadrado ela vai parar exatamente à direita, no
 * triângulo a -30°). Ou seja, o ponto de onde o dado sai é outro em cada bandeja — e é isso que este
 * teste vigia.
 *
 * O caso duro é o triângulo: menor área, quinas de 60°, e a boca da torre mais perto do centro.
 */

const MAX_STEPS = 20000
const MARGEM = 0.5

describe('lançamento pela TORRE em cada formato de bandeja', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it.each(TRAY_SHAPES)('%s', (forma: TrayShape) => {
    const sides = TRAY_SHAPE_SIDES[forma]
    const apothem = trayApothem(sides)
    const entry = DICE_REGISTRY[6]
    const raio = entry.definition.scale * entry.definition.boundingRadius
    const world = createPhysicsWorld()
    createBoundaryColliders(world, sides)

    const layout = computeTowerBesideLayout({}, sides)
    // A boca tem que ficar FORA da bandeja: é de lá que o dado entra.
    expect(Math.hypot(layout.mouth.x, layout.mouth.z)).toBeGreaterThan(apothem)

    const slots = computeSpawnSlots(MAX_SIMULTANEOUS_DICE, traySafeHalfExtent(sides, SPAWN_CONFIG.slotSafeHalfExtent))
    const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
    const passosPorDado = Math.round(MOUTH_RELEASE_INTERVAL_MS / dtMs)

    const dice = slots.map((slot, i) => {
      const body = entry.createBody(world)
      // Parqueado até a vez dele, como no app: todos nascem no MESMO ponto e o que os separa é o tempo.
      if (body.numColliders() > 0) body.collider(0).setCollisionGroups(parkedCollisionGroups())
      body.setTranslation({ x: i * 2, y: -40, z: 0 }, true)
      return {
        body,
        tracker: createSettleTracker(),
        slot,
        soltarNoPasso: i * passosPorDado,
        solto: false,
        pronto: false,
        /** Tempo em fase de ENTRADA — alimenta o resgate; ver o comentário no laço. */
        entrandoMs: 0
      }
    })

    let prontos = 0
    for (let passo = 0; passo < MAX_STEPS && prontos < dice.length; passo++) {
      for (const die of dice) {
        if (!die.solto && passo >= die.soltarNoPasso) {
          tossDieFromMouth(die.body, { target: die.slot, radius: raio, sides })
          die.tracker.reset()
          die.solto = true
        }
      }
      world.step()
      for (const die of dice) {
        if (!die.solto || die.pronto) continue
        /**
         * Contabiliza o tempo em fase de ENTRADA, exatamente como o app faz (ver `DiceCanvasMulti`).
         *
         * Sem isto o teste passava `0` e o resgate de `ENTRY_FORCE_PUSH_TIMEOUT_MS` NUNCA disparava —
         * um dado que sai da boca e não cruza pra dentro fica com os grupos de "entrando", que não
         * colidem com a parede, e cai pelo vazio. Foi o que o diagnóstico encontrou: dado em y = -4672
         * depois de 41 cutucadas, e o teste acusando "14 de 15 assentaram".
         *
         * Ou seja: a instabilidade destes testes desde 18/08 não era física indeterminada, era o teste
         * desligando a rede de segurança que a produção tem.
         */
        clampLinearVelocity(die.body, WORLD_CONFIG.maxLinearSpeed)
        const entrando =
          die.body.numColliders() > 0 &&
          die.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
        if (entrando) die.entrandoMs += dtMs
        restoreWallCollisionIfInside(die.body, die.entrandoMs, sides)
        if (!entrando) die.entrandoMs = 0
        const estado = die.tracker.update(die.body, dtMs)
        if (estado === 'settled') {
          const leitura = readTopFace(entry.definition, die.body.rotation(), resolveAmbiguousMargin(entry.definition))
          if (leitura.isAmbiguous) {
            applyNudge(die.body)
            die.tracker.reset()
          } else {
            die.pronto = true
            prontos++
          }
        } else if (estado === 'stuck') {
          applyNudge(die.body)
          die.tracker.reset()
        }
      }
    }

    expect(prontos).toBe(dice.length)
    for (const die of dice) {
      const t = die.body.translation()
      expect(isInsideRegularPolygon(t.x, t.z, apothem, sides, MARGEM, trayRotation(sides))).toBe(true)
    }
  })
})
