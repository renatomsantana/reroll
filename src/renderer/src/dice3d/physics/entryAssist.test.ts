import { beforeAll, describe, expect, it } from 'vitest'
import type RAPIER from '@dimforge/rapier3d-compat'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker, type SettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDie } from './tossDie'
import { tossDieFromMouth } from './tossDieFromMouth'
import { diceEnteringCollisionGroups, restoreWallCollisionIfInside } from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon, regularPolygonSegmentAngle } from './regularPolygon'
import { readTopFace } from '../faceReading/readTopFace'
import { MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'
import {
  TRAY_SHAPES,
  TRAY_SHAPE_SIDES,
  trayApothem,
  traySafeHalfExtent,
  trayRotation,
  type TrayShape
} from '../geometry/trayShape'
import type { PhysicalDiceSides } from '@shared/types/dice3d'

/**
 * O EMPURRÃO DE ENTRADA tem que continuar sendo física, não ímã.
 *
 * O que este teste protege, na descrição do próprio usuário: "ele sai mas tenta voltar rapidamente
 * pra bandeja". O empurrão que traz de volta um dado desviado durante a entrada
 * (`restoreWallCollisionIfInside`) já foi um `setLinvel` — trocava a velocidade horizontal do dado
 * de uma vez. Medido com física de verdade, isso mudava a velocidade em até 15.4 u/s num único
 * quadro e disparava quadro após quadro, o que na tela lê como o dado sendo puxado por um fio, não
 * rolando de volta.
 *
 * Hoje é uma ACELERAÇÃO, então nenhuma chamada pode mudar a velocidade em mais do que
 * `aceleração × dt`. É isso que a primeira asserção trava: qualquer volta a um empurrão
 * instantâneo estoura o limite, por mais bem-intencionada que seja.
 *
 * As outras duas asserções são o outro lado do pedido — "que sempre caia dentro do tabuleiro":
 * todo dado assenta e todo dado termina dentro da bandeja, em todas as quatro formas.
 */

/** Teto de mudança de velocidade por chamada, com folga pro erro de ponto flutuante. */
const MAX_DELTA_V_POR_CHAMADA = 0.9
/**
 * Excursão máxima tolerada além da parede no lançamento PELA BOCA, onde o dado nasce a apenas
 * `mouthClearance` da borda — qualquer coisa muito além disso é o dado passeando fora da bandeja.
 * O arremesso pela BANDEJA não entra nesta asserção: lá o dado nasce de propósito
 * `launchOutsideDistance` (±jitter) fora da parede, então a distância grande é o desenho do
 * arremesso, não um desvio. Medido depois da correção: 0.70 a 1.27 conforme a forma.
 */
const MAX_EXCURSAO_PELA_BOCA = 2.5
const MARGEM_DA_PAREDE = 0.5

interface Die {
  sides: PhysicalDiceSides
  body: RAPIER.RigidBody
  tracker: SettleTracker
  slot: { x: number; z: number }
  entrandoMs: number
  assentado: boolean
}

/** Quanto `(x, z)` está ALÉM da parede do polígono (negativo = dentro). */
function alemDaParede(x: number, z: number, apothem: number, sides: number, rotation: number): number {
  let pior = -Infinity
  for (let i = 0; i < sides; i++) {
    const angulo = regularPolygonSegmentAngle(i, sides, rotation)
    const projetado = x * Math.cos(angulo) + z * Math.sin(angulo) - apothem
    if (projetado > pior) pior = projetado
  }
  return pior
}

function rolar(launcher: 'tray' | 'mouth', shape: TrayShape) {
  const sides = TRAY_SHAPE_SIDES[shape]
  const apothem = trayApothem(sides)
  const rotation = trayRotation(sides)
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000

  const world = createPhysicsWorld()
  createBoundaryColliders(world, sides)

  const slots = computeSpawnSlots(
    MAX_SIMULTANEOUS_DICE,
    traySafeHalfExtent(sides, SPAWN_CONFIG.slotSafeHalfExtent)
  )
  // Tipos MISTURADOS, como uma rolagem de verdade ("2d6 + 1d20") — os outros testes de contenção
  // rodam um tipo por vez, e é na mistura de tamanhos que um dado grande manda um pequeno longe.
  const dice: Die[] = slots.map((slot, i) => {
    const tipo = AVAILABLE_DICE_TYPES[i % AVAILABLE_DICE_TYPES.length]
    return {
      sides: tipo,
      body: DICE_REGISTRY[tipo].createBody(world),
      tracker: createSettleTracker(),
      slot,
      entrandoMs: 0,
      assentado: false
    }
  })

  for (const die of dice) {
    const definicao = DICE_REGISTRY[die.sides].definition
    if (launcher === 'mouth') {
      tossDieFromMouth(die.body, {
        target: die.slot,
        sides,
        radius: definicao.scale * definicao.boundingRadius
      })
    } else {
      tossDie(die.body, { target: die.slot, sides })
    }
    die.tracker.reset()
  }

  let maiorDeltaV = 0
  let maiorExcursao = -Infinity

  const MAX_PASSOS = 20000
  let assentados = 0
  for (let passo = 0; passo < MAX_PASSOS && assentados < dice.length; passo++) {
    world.step()
    for (const die of dice) {
      clampLinearVelocity(die.body, WORLD_CONFIG.maxLinearSpeed)
      const entrando =
        die.body.numColliders() > 0 &&
        die.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
      if (entrando) die.entrandoMs += dtMs

      const p = die.body.translation()
      const fora = alemDaParede(p.x, p.z, apothem, sides, rotation)
      if (fora > maiorExcursao) maiorExcursao = fora

      const antes = die.body.linvel()
      restoreWallCollisionIfInside(die.body, die.entrandoMs, sides, dtMs)
      const depois = die.body.linvel()
      const deltaV = Math.hypot(depois.x - antes.x, depois.y - antes.y, depois.z - antes.z)
      if (deltaV > maiorDeltaV) maiorDeltaV = deltaV

      if (!entrando) die.entrandoMs = 0
      if (die.assentado) continue

      const estado = die.tracker.update(die.body, dtMs)
      if (estado === 'settled') {
        const definicao = DICE_REGISTRY[die.sides].definition
        const leitura = readTopFace(definicao, die.body.rotation(), resolveAmbiguousMargin(definicao))
        if (leitura.isAmbiguous) {
          applyNudge(die.body)
          die.tracker.reset()
        } else {
          die.assentado = true
          assentados++
        }
      } else if (estado === 'stuck') {
        applyNudge(die.body)
        die.tracker.reset()
      }
    }
  }

  const posicoes = dice.map((die) => die.body.translation())
  world.free()
  return { assentados, total: dice.length, maiorDeltaV, maiorExcursao, posicoes, apothem, sides, rotation }
}

describe('empurrão de entrada — resgate por aceleração, nunca por troca de velocidade', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  for (const launcher of ['tray', 'mouth'] as const) {
    it.each(TRAY_SHAPES)(`${launcher} / %s`, (shape: TrayShape) => {
      const r = rolar(launcher, shape)

      expect(r.maiorDeltaV).toBeLessThan(MAX_DELTA_V_POR_CHAMADA)
      expect(r.assentados).toBe(r.total)
      for (const p of r.posicoes) {
        expect(isInsideRegularPolygon(p.x, p.z, r.apothem, r.sides, MARGEM_DA_PAREDE, r.rotation)).toBe(true)
        expect(p.y).toBeGreaterThan(-1)
      }
      if (launcher === 'mouth') expect(r.maiorExcursao).toBeLessThan(MAX_EXCURSAO_PELA_BOCA)
    }, 120000)
  }
})
