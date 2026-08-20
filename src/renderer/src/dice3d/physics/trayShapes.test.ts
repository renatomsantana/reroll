import { beforeAll, describe, expect, it } from 'vitest'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDie } from './tossDie'
import { diceEnteringCollisionGroups, restoreWallCollisionIfInside } from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { isInsideRegularPolygon } from './regularPolygon'
import { readTopFace } from '../faceReading/readTopFace'
import { MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { DICE_REGISTRY } from '../dice-defs/registry'
import {
  TRAY_SHAPES,
  TRAY_SHAPE_SIDES,
  trayApothem,
  traySafeHalfExtent,
  trayRotation,
  type TrayShape
} from '../geometry/trayShape'

/**
 * CONTENÇÃO em cada FORMA de bandeja — triângulo, quadrado, hexágono e círculo.
 *
 * A forma virou escolha do usuário, e trocá-la muda a parede FÍSICA, não só o desenho: cada uma tem
 * um apótema diferente (o triângulo tem 3.75 contra 7.5 do círculo, porque todas cabem no mesmo
 * círculo circunscrito) e uma quantidade diferente de quinas onde um dado pode se prender.
 *
 * O triângulo é o caso duro e é por ele que este teste existe: é a forma com menos área e com as
 * quinas mais fechadas (60°), e os pontos de destino do arremesso (`computeSpawnSlots`) são
 * calculados a partir de um quadrado seguro que não sabe da forma. Se algum dia um dado escapar por
 * causa disso, é aqui que aparece.
 */

/** O MÁXIMO que o app permite — o pior caso real, pedido do usuário ("testa 15 dados em cada tabuleiro"). */
const DADOS = MAX_SIMULTANEOUS_DICE
const MAX_STEPS = 20000
/** Folga além da parede: detecta "saiu voando" sem acusar dado encostado na parede por dentro. */
const MARGEM = 0.5

describe('contenção em cada formato de bandeja', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it.each(TRAY_SHAPES)('%s', (forma: TrayShape) => {
    const sides = TRAY_SHAPE_SIDES[forma]
    const apothem = trayApothem(sides)
    const entry = DICE_REGISTRY[6]
    const world = createPhysicsWorld()
    createBoundaryColliders(world, sides)

    /**
     * A MESMA conta do app (`traySafeHalfExtent`), e não uma escala escrita aqui.
     *
     * A primeira versão deste teste escalava os alvos por conta própria, e com isso ele passava
     * enquanto o APP continuava mirando no quadrado do hexágono — ou seja, o teste escondia
     * exatamente o defeito que o usuário encontrou sozinho ("estão spawnando fora das caixas").
     * Teste que corrige o cenário em vez de exercitar o código de produção não vale nada.
     */
    const slots = computeSpawnSlots(DADOS, traySafeHalfExtent(sides, SPAWN_CONFIG.slotSafeHalfExtent))

    /**
     * Guarda direta do defeito: TODO ALVO tem que estar dentro da bandeja. É a asserção que teria
     * apontado o problema no primeiro segundo, sem precisar simular nada — dado mirado pra fora só
     * pode acabar fora.
     */
    for (const slot of slots) {
      expect(isInsideRegularPolygon(slot.x, slot.z, apothem, sides, 0, trayRotation(sides))).toBe(true)
    }

    const dice = slots.map((slot) => ({
      body: entry.createBody(world),
      tracker: createSettleTracker(),
      slot,
      assentado: false,
      /** Tempo em fase de ENTRADA — alimenta o resgate; ver o comentário no laço. */
      entrandoMs: 0
    }))

    for (const die of dice) {
      // `sides` como a produção passa (ver `DiceCanvasMulti`): o ponto de largada do arremesso sai
      // da borda da bandeja NA FORMA em uso, não do apótema do hexágono. Sem isto o teste largava
      // os dados do lugar errado em três das quatro formas.
      tossDie(die.body, { target: die.slot, sides })
      die.tracker.reset()
    }

    const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
    let assentados = 0
    for (let passo = 0; passo < MAX_STEPS && assentados < dice.length; passo++) {
      world.step()
      for (const die of dice) {
        if (die.assentado) continue
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
            die.assentado = true
            assentados++
          }
        } else if (estado === 'stuck') {
          applyNudge(die.body)
          die.tracker.reset()
        }
      }
    }

    expect(assentados).toBe(dice.length)
    for (const die of dice) {
      const t = die.body.translation()
      /**
       * A ROTAÇÃO entra na conta: as formas são giradas pra ficarem de frente pra câmera (ver
       * `trayRotation`), e conferir contra o polígono sem girar seria conferir contra uma bandeja
       * que não existe — o teste passaria mesmo com o dado fora da parede de verdade.
       */
      expect(isInsideRegularPolygon(t.x, t.z, apothem, sides, MARGEM, trayRotation(sides))).toBe(true)
    }
  })
})
