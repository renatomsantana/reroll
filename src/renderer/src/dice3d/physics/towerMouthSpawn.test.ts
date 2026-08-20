import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker, type SettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDieFromMouth, MOUTH_RELEASE_INTERVAL_MS } from './tossDieFromMouth'
import {
  diceEnteringCollisionGroups,
  parkedCollisionGroups,
  restoreWallCollisionIfInside
} from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon } from './regularPolygon'
import { computeTowerBesideLayout } from '../geometry/towerBesideTrayLayout'
import { readTopFace } from '../faceReading/readTopFace'
import {
  MAX_SIMULTANEOUS_DICE,
  SPAWN_CONFIG,
  TRAY_CONFIG,
  WORLD_CONFIG,
  resolveAmbiguousMargin
} from '../config/physicsConfig'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'
import type { PhysicalDiceSides } from '@shared/types/dice3d'

/**
 * O dado sai da BOCA da torre ao lado da bandeja (ver `tossDieFromMouth.ts`) e tem que acabar
 * DENTRO do hexágono — este é o teste que separa "a torre parece certa na tela" de "o dado
 * realmente cai onde deveria".
 *
 * Duas coisas específicas deste lançamento que o teste da bandeja (`diceEscape.test.ts`) não cobre:
 *
 * 1. o ponto de partida é fixo e fica FORA do hexágono, 0.35 acima do topo da parede. Um impulso
 *    fraco demais e o dado despenca do lado de fora, na grama, em vez de entrar;
 * 2. todos os dados saem do MESMO buraco. Sem o intervalo de `MOUTH_RELEASE_INTERVAL_MS` eles
 *    nasceriam sobrepostos, e o impulso de separação do solver arremessa corpos sobrepostos com
 *    força absurda.
 */
interface TestDie {
  body: RAPIER.RigidBody
  tracker: SettleTracker
  slot: { x: number; z: number }
  releaseStep: number
  released: boolean
  /** Tempo em fase de ENTRADA — alimenta o resgate; ver o comentário no laço. */
  entrandoMs: number
}

function park(body: RAPIER.RigidBody, index: number): void {
  if (body.numColliders() > 0) body.collider(0).setCollisionGroups(parkedCollisionGroups())
  // Bem abaixo da mesa e espalhados: sem colisor ativo eles não interagem com nada, mas manter cada
  // um num lugar diferente evita qualquer surpresa se um dia o grupo de "estacionado" mudar.
  body.setTranslation({ x: index * 2, y: -40, z: 0 }, true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

/**
 * Orçamento de passos da simulação. Generoso de propósito — 20000 passos são ~333 segundos de física,
 * muito além de qualquer rolagem real.
 *
 * O limite é artefato DO TESTE: no app não existe teto, o laço roda até o dado assentar. Com 8000 o
 * teste falhava sozinho de vez em quando ("esperava 15, foram 14"), e a falha não era contenção —
 * nenhum dado saía do hexágono, um só demorava mais que a conta pra parar, normalmente um d12 ou d4
 * quicando numa quina. Um teto apertado transforma "demorou" em "quebrou", e o que este teste existe
 * pra vigiar é se o dado ACABA DENTRO, não se ele para rápido.
 */
const MAX_STEPS = 20000

function simulate(world: RAPIER.World, dice: TestDie[], sides: PhysicalDiceSides, maxSteps: number): number {
  const definition = DICE_REGISTRY[sides].definition
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  const settled = new Set<number>()

  for (let step = 0; step < maxSteps && settled.size < dice.length; step++) {
    dice.forEach((die) => {
      if (!die.released && step >= die.releaseStep) {
        tossDieFromMouth(die.body, {
          target: die.slot,
          radius: definition.scale * definition.boundingRadius
        })
        die.tracker.reset()
        die.released = true
      }
    })

    world.step()

    dice.forEach((die, index) => {
      if (!die.released || settled.has(index)) return
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

      const state = die.tracker.update(die.body, dtMs)
      if (state === 'settled') {
        const reading = readTopFace(definition, die.body.rotation(), resolveAmbiguousMargin(definition))
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

  return settled.size
}

describe('lançamento pela boca da torre ao lado da bandeja', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it('a boca fica fora do hexágono e acima da parede — é o que o dado precisa transpor', () => {
    const layout = computeTowerBesideLayout()
    const distanciaDoCentro = Math.hypot(layout.mouth.x, layout.mouth.z)

    // Fora da parede (senão a torre estaria dentro da bandeja)...
    expect(distanciaDoCentro).toBeGreaterThan(TRAY_CONFIG.apothem + TRAY_CONFIG.wallThickness)
    // ...e acima do topo dela (senão o dado sai batendo na parede por fora).
    expect(layout.mouth.y).toBeGreaterThan(TRAY_CONFIG.wallHeight)
    // A boca aponta pro centro.
    const paraOCentro = Math.hypot(layout.mouth.x + layout.mouthDirection.x, layout.mouth.z + layout.mouthDirection.z)
    expect(paraOCentro).toBeLessThan(distanciaDoCentro)
  })

  /**
   * TODOS os tipos de dado, não só o d6 — pedido explícito do usuário depois de ver dados saindo da
   * bandeja ("faz todo tipo de teste com a torre... testa com todos os dados"). Cada tipo tem massa,
   * atrito, restituição e forma de collider próprios (o d100 é uma esfera quase perfeita, o d4 tem
   * quatro faces e cai de ponta), e o lançamento da boca é o mesmo pra todos.
   */
  it.each(AVAILABLE_DICE_TYPES)(
    `${MAX_SIMULTANEOUS_DICE} d%i saindo da boca acabam todos dentro do hexágono`,
    (sides) => {
      const world = createPhysicsWorld()
      createBoundaryColliders(world)

      const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
      const releaseSteps = Math.round(MOUTH_RELEASE_INTERVAL_MS / dtMs)
      const slots = computeSpawnSlots(MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG.slotSafeHalfExtent)

      const dice: TestDie[] = slots.map((slot, index) => {
        const body = DICE_REGISTRY[sides].createBody(world)
        park(body, index)
        return {
          body,
          tracker: createSettleTracker(),
          slot,
          releaseStep: index * releaseSteps,
          released: false,
          entrandoMs: 0
        }
      })

      const assentados = simulate(world, dice, sides, MAX_STEPS)
      expect(assentados).toBe(dice.length)

      for (const die of dice) {
        const t = die.body.translation()
        // Mesma checagem de semiplanos do teste da bandeja: um dado que caiu na grama do lado de
        // fora falha aqui mesmo estando dentro da caixa envolvente nos outros eixos.
        expect(isInsideRegularPolygon(t.x, t.z, TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments, 0.5)).toBe(true)
        expect(t.y).toBeGreaterThan(-1)
        expect(t.y).toBeLessThan(TRAY_CONFIG.wallHeight + 1)
      }

      world.free()
    },
    60000
  )

  /**
   * O lançamento tem que ATRAVESSAR a bandeja, não só entrar nela. É a regressão do que o usuário
   * reportou como "colidindo muito": com o teto de velocidade do arremesso normal (5.5), a conta
   * `distância / tempo` era cortada em quase todo lançamento e os dados caíam amontoados no canto da
   * torre. Medido antes e depois — a distância média da boca subiu de ~6.9 pra ~8.7.
   *
   * TRÊS ROLAGENS, e a média sobre as três. A primeira versão media UMA rolagem contra um limite
   * tirado da média de muitas, e falhava sozinha de vez em quando (peguei uma em 7.33 contra o limite
   * de 7.5): quinze dados caindo é uma amostra pequena, e a média de uma rolagem só passeia bem mais
   * que a média geral. Com 45 amostras a conta fica onde deveria — e o limite continua bem acima dos
   * ~6.9 que o ajuste antigo produzia, que é o que o teste existe pra impedir de voltar.
   */
  it('os dados se espalham pela bandeja em vez de amontoar no canto da torre', () => {
    const world = createPhysicsWorld()
    createBoundaryColliders(world)

    const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
    const releaseSteps = Math.round(MOUTH_RELEASE_INTERVAL_MS / dtMs)
    const slots = computeSpawnSlots(MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG.slotSafeHalfExtent)
    const dice: TestDie[] = slots.map((slot, index) => {
      const body = DICE_REGISTRY[6].createBody(world)
      park(body, index)
      return {
        body,
        tracker: createSettleTracker(),
        slot,
        releaseStep: index * releaseSteps,
        released: false,
        entrandoMs: 0
      }
    })

    const boca = computeTowerBesideLayout().mouth
    const distancias: number[] = []

    for (let rolagem = 0; rolagem < 3; rolagem++) {
      dice.forEach((die, index) => {
        park(die.body, index)
        die.released = false
        die.tracker.reset()
      })
      expect(simulate(world, dice, 6, MAX_STEPS)).toBe(dice.length)
      for (const die of dice) {
        const t = die.body.translation()
        distancias.push(Math.hypot(t.x - boca.x, t.z - boca.z))
      }
    }

    const media = distancias.reduce((soma, d) => soma + d, 0) / distancias.length
    expect(media).toBeGreaterThan(7.5)

    world.free()
  }, 90000)
})
