import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker, type SettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDie } from './tossDie'
import { tossDieFromMouth, MOUTH_RELEASE_INTERVAL_MS } from './tossDieFromMouth'
import {
  diceEnteringCollisionGroups,
  parkedCollisionGroups,
  restoreWallCollisionIfInside
} from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon } from './regularPolygon'
import { readTopFace } from '../faceReading/readTopFace'
import {
  MAX_SIMULTANEOUS_DICE,
  SPAWN_CONFIG,
  TRAY_CONFIG,
  WORLD_CONFIG,
  resolveAmbiguousMargin
} from '../config/physicsConfig'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'
import {
  TRAY_SHAPES,
  TRAY_SHAPE_SIDES,
  trayApothem,
  traySafeHalfExtent,
  trayRotation,
  type TrayShape
} from '../geometry/trayShape'

/**
 * A MATRIZ COMPLETA da rolagem, no teto do app: cada FORMA de bandeja × cada TIPO de lançamento ×
 * cada TIPO de dado, sempre com `MAX_SIMULTANEOUS_DICE` (20) dados, e mais um saco MISTO com os
 * sete tipos juntos — que é o que uma rolagem de RPG de verdade parece.
 *
 * Por que 20 e não 4: o que quebra numa bandeja cheia não é o dado sozinho, é o TRÂNSITO. Vinte
 * corpos saindo pelo mesmo buraco da torre, ou caindo juntos num triângulo cujo apótema é metade
 * do círculo, empurram uns aos outros contra a parede — e é assim que um dado sai da caixa. Os
 * testes por tipo com poucos dados mostram a geometria de cada dado; este mostra o amontoado.
 *
 * ALEATORIEDADE INTACTA, de propósito: nada aqui é semeado nem preso. `tossDie`/`tossDieFromMouth`
 * sorteiam ângulo, força, altura e rotação inicial a cada chamada, e é justamente o sorteio que faz
 * o teste vasculhar casos novos a cada rodada — prender a semente deixaria o teste bonito e cego.
 * A consequência aceita é que ele é uma AMOSTRA, não uma prova: por isso as asserções são de
 * contenção ("acabou dentro"), que valem pra qualquer sorteio, e não de posição exata.
 *
 * E por isso também, quando falha, ele DESPEJA O ESTADO do dado — foi assim que a instabilidade de
 * 18/08 acabou sendo diagnosticada (um dado em y = -4672, em queda livre fora do mundo, com o teste
 * relatando só "14 de 15 assentaram"). Mensagem sem estado manda a gente adivinhar; o estado
 * responde na primeira linha.
 */

/** ~333s de física simulada — teto de "isto nunca deveria demorar tanto", não de tempo esperado. */
const MAX_STEPS = 20000
/** Folga além da parede: acusa "saiu voando" sem acusar dado encostado na parede por dentro. */
const MARGEM = 0.5
/**
 * DUAS rolagens seguidas nos mesmos corpos, como o app faz: `roll()` não cria dados novos, ele
 * re-arremessa os que já estão na bandeja (ver `DiceCanvasMulti`). A segunda rolagem parte de vinte
 * dados espalhados e assentados, não de uma bandeja limpa — situação que a primeira nunca cria.
 */
const ROLAGENS = 2

type Lancamento = 'bandeja' | 'torre'

interface Dado {
  body: RAPIER.RigidBody
  sides: PhysicalDiceSides
  tracker: SettleTracker
  slot: { x: number; z: number }
  /** Passo em que este dado sai da boca (torre); na bandeja todos saem juntos no passo 0. */
  passoDeLargada: number
  liberado: boolean
  assentado: boolean
  entrandoMs: number
}

function descrever(dado: Dado, indice: number): string {
  const t = dado.body.translation()
  const v = dado.body.linvel()
  const w = dado.body.angvel()
  return (
    `#${indice} d${dado.sides} ` +
    `pos=(${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}) ` +
    `vel=(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}) ` +
    `giro=(${w.x.toFixed(2)}, ${w.y.toFixed(2)}, ${w.z.toFixed(2)}) ` +
    `assentado=${dado.assentado}`
  )
}

function despejo(dados: Dado[], contexto: string): string {
  const naoAssentados = dados
    .map((dado, indice) => ({ dado, indice }))
    .filter(({ dado }) => !dado.assentado)
    .map(({ dado, indice }) => descrever(dado, indice))
  return [contexto, ...naoAssentados].join(String.fromCharCode(10))
}

function estacionar(body: RAPIER.RigidBody, indice: number): void {
  if (body.numColliders() > 0) body.collider(0).setCollisionGroups(parkedCollisionGroups())
  // Longe de tudo e sem colisor ativo: é a fila da boca da torre (ver `parkTowerDie` na produção).
  body.setTranslation({ x: indice * 2, y: -40, z: 0 }, true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

function raioDe(sides: PhysicalDiceSides): number {
  const definicao = DICE_REGISTRY[sides].definition
  return definicao.scale * definicao.boundingRadius
}

/**
 * Uma rolagem inteira, do arremesso ao repouso, com o MESMO laço da produção (`DiceCanvasMulti`):
 * teto de velocidade, contagem do tempo de entrada, restauração da colisão com a parede ao cruzar
 * pra dentro, cutucada em dado travado e releitura de face ambígua.
 *
 * A forma (`traySides`) atravessa todas as chamadas que a produção também alimenta com ela — quem
 * esquecer de passá-la aqui está testando um app que não existe.
 */
function rolar(world: RAPIER.World, dados: Dado[], traySides: number, lancamento: Lancamento): number {
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  let assentados = 0

  for (const [indice, dado] of dados.entries()) {
    dado.assentado = false
    dado.entrandoMs = 0
    dado.liberado = false
    // Só a torre tem fila: na bandeja os vinte são arremessados no mesmo instante, como o `roll()`
    // da produção faz — e é esse "todos de uma vez" que enche a bandeja de trânsito.
    if (lancamento === 'torre') estacionar(dado.body, indice)
  }

  for (let passo = 0; passo < MAX_STEPS && assentados < dados.length; passo++) {
    for (const dado of dados) {
      const largada = lancamento === 'torre' ? dado.passoDeLargada : 0
      if (dado.liberado || passo < largada) continue
      if (lancamento === 'torre') {
        tossDieFromMouth(dado.body, { target: dado.slot, radius: raioDe(dado.sides), sides: traySides })
      } else {
        tossDie(dado.body, { target: dado.slot, sides: traySides })
      }
      dado.tracker.reset()
      dado.liberado = true
    }

    world.step()

    for (const dado of dados) {
      if (!dado.liberado || dado.assentado) continue
      clampLinearVelocity(dado.body, WORLD_CONFIG.maxLinearSpeed)
      const entrando =
        dado.body.numColliders() > 0 &&
        dado.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
      if (entrando) dado.entrandoMs += dtMs
      restoreWallCollisionIfInside(dado.body, dado.entrandoMs, traySides)
      if (!entrando) dado.entrandoMs = 0

      const definicao = DICE_REGISTRY[dado.sides].definition
      const estado = dado.tracker.update(dado.body, dtMs)
      if (estado === 'settled') {
        const leitura = readTopFace(definicao, dado.body.rotation(), resolveAmbiguousMargin(definicao))
        if (leitura.isAmbiguous) {
          applyNudge(dado.body)
          dado.tracker.reset()
        } else {
          dado.assentado = true
          assentados++
        }
      } else if (estado === 'stuck') {
        applyNudge(dado.body)
        dado.tracker.reset()
      }
    }
  }

  return assentados
}

function montarDados(world: RAPIER.World, tipos: PhysicalDiceSides[], traySides: number): Dado[] {
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  const passosEntreSaidas = Math.round(MOUTH_RELEASE_INTERVAL_MS / dtMs)
  /**
   * A mesma conta do app: os alvos encolhem junto com a forma (`traySafeHalfExtent`). Sem isso o
   * dado é MIRADO pra fora do triângulo, e aí ele só pode acabar fora dele.
   */
  const slots = computeSpawnSlots(tipos.length, traySafeHalfExtent(traySides, SPAWN_CONFIG.slotSafeHalfExtent))
  return tipos.map((sides, indice) => ({
    body: DICE_REGISTRY[sides].createBody(world),
    sides,
    tracker: createSettleTracker(),
    slot: slots[indice],
    // Na torre saem em fila (todos nascem no MESMO ponto); na bandeja, todos de uma vez.
    passoDeLargada: indice * passosEntreSaidas,
    liberado: false,
    assentado: false,
    entrandoMs: 0
  }))
}

function conferirDados(dados: Dado[], traySides: number, contexto: string): void {
  const apotema = trayApothem(traySides)
  for (const [indice, dado] of dados.entries()) {
    const t = dado.body.translation()
    const onde = `${contexto} — ${descrever(dado, indice)}`
    // Semiplanos da forma EM USO, com a rotação dela: uma caixa envolvente deixaria passar o dado
    // caído na grama do lado de fora de uma quina.
    expect(
      isInsideRegularPolygon(t.x, t.z, apotema, traySides, MARGEM, trayRotation(traySides)),
      `${onde} — fora da bandeja`
    ).toBe(true)
    expect(t.y, `${onde} — atravessou o chão ou subiu demais`).toBeGreaterThan(-1)
    expect(t.y, `${onde} — parou empoleirado acima da parede`).toBeLessThan(TRAY_CONFIG.wallHeight + 1)

    const definicao = DICE_REGISTRY[dado.sides].definition
    const leitura = readTopFace(definicao, dado.body.rotation(), resolveAmbiguousMargin(definicao))
    const valores = definicao.faces.map((face) => face.value)
    // Face válida: dado parado numa posição impossível (meio enterrado na parede, de canto sobre a
    // borda) costuma aparecer aqui antes de aparecer na tela.
    expect(valores, `${onde} — leu face ${leitura.value}, que não existe neste dado`).toContain(leitura.value)
  }
}

const LANCAMENTOS: Lancamento[] = ['bandeja', 'torre']

/**
 * O SACO MISTO: vinte dados repartidos entre os sete tipos, em vez de vinte iguais.
 *
 * É o caso que mais se parece com uma rolagem de mesa, e é fisicamente diferente dos dois:
 * dados de tamanhos e massas diferentes disputando o mesmo espaço quicam de um jeito que vinte
 * cópias do mesmo dado nunca produzem — um d4 prensado entre dois d20 é a situação clássica de
 * dado que sobe pela parede.
 */
function sacoMisto(): PhysicalDiceSides[] {
  const tipos: PhysicalDiceSides[] = []
  while (tipos.length < MAX_SIMULTANEOUS_DICE) {
    tipos.push(AVAILABLE_DICE_TYPES[tipos.length % AVAILABLE_DICE_TYPES.length])
  }
  return tipos
}

describe(`matriz completa — ${MAX_SIMULTANEOUS_DICE} dados em cada forma, por cada lançamento`, () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  const combinacoes = TRAY_SHAPES.flatMap((forma) =>
    LANCAMENTOS.flatMap((lancamento) => AVAILABLE_DICE_TYPES.map((sides) => [forma, lancamento, sides] as const))
  )

  it.each(combinacoes)(
    `%s, pela %s — ${MAX_SIMULTANEOUS_DICE} d%i assentam dentro, em ${ROLAGENS} rolagens seguidas`,
    (forma: TrayShape, lancamento: Lancamento, sides: PhysicalDiceSides) => {
      const traySides = TRAY_SHAPE_SIDES[forma]
      const world = createPhysicsWorld()
      createBoundaryColliders(world, traySides)
      const dados = montarDados(world, Array<PhysicalDiceSides>(MAX_SIMULTANEOUS_DICE).fill(sides), traySides)

      for (let rolagem = 1; rolagem <= ROLAGENS; rolagem++) {
        const contexto = `${forma}/${lancamento}/d${sides} rolagem ${rolagem}`
        const assentados = rolar(world, dados, traySides, lancamento)
        expect(assentados, despejo(dados, `${contexto}: ${assentados} de ${dados.length} assentaram`)).toBe(dados.length)
        conferirDados(dados, traySides, contexto)
      }

      world.free()
    },
    120000
  )

  const mistos = TRAY_SHAPES.flatMap((forma) => LANCAMENTOS.map((lancamento) => [forma, lancamento] as const))

  it.each(mistos)(
    `%s, pela %s — saco misto de ${MAX_SIMULTANEOUS_DICE} dados dos sete tipos`,
    (forma: TrayShape, lancamento: Lancamento) => {
      const traySides = TRAY_SHAPE_SIDES[forma]
      const world = createPhysicsWorld()
      createBoundaryColliders(world, traySides)
      const dados = montarDados(world, sacoMisto(), traySides)

      for (let rolagem = 1; rolagem <= ROLAGENS; rolagem++) {
        const contexto = `${forma}/${lancamento}/misto rolagem ${rolagem}`
        const assentados = rolar(world, dados, traySides, lancamento)
        expect(assentados, despejo(dados, `${contexto}: ${assentados} de ${dados.length} assentaram`)).toBe(dados.length)
        conferirDados(dados, traySides, contexto)
      }

      world.free()
    },
    120000
  )
})
