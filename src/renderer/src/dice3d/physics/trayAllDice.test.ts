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
import { SPAWN_CONFIG, TRAY_CONFIG, WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'
import type { PhysicalDiceSides } from '@shared/types/dice3d'

/**
 * Lançamento pela BANDEJA (sem torre) para TODOS os sete tipos de dado.
 *
 * Existia um buraco de cobertura que só apareceu ao revisar a suíte antes de fechar uma versão: o
 * modo TORRE tinha teste dos sete tipos (`towerMouthSpawn.test.ts`), e o modo bandeja — que é o
 * padrão do app, o que quase todo mundo usa — só tinha teste de d6 (`diceEscape.test.ts`). Ou seja,
 * o caminho mais percorrido era o menos verificado.
 *
 * O que este teste garante, por tipo: todo dado ASSENTA, todo dado acaba DENTRO do hexágono, e a
 * face lida é um valor válido daquele dado. Os três juntos são o que separa "a cena parece certa" de
 * "a rolagem funciona".
 *
 * Poucos dados por tipo (4, não 15) de propósito: o estresse de quantidade máxima já é o assunto de
 * `diceEscape.test.ts`, e repeti-lo sete vezes só deixaria a suíte lenta sem cobrir nada novo. O que
 * muda de tipo pra tipo é a GEOMETRIA — tamanho, número de faces, como quica e como assenta —, e
 * isso aparece com quatro dados igual aparece com quinze.
 */

const DADOS_POR_TIPO = 4
const MAX_STEPS = 20000
/** Folga além da parede: detecta "saiu voando" sem acusar dado encostado na parede por dentro. */
const MARGEM_DA_PAREDE = 0.5

describe('lançamento pela BANDEJA — os sete tipos assentam dentro do hexágono', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it.each(AVAILABLE_DICE_TYPES)('d%i', (sides: PhysicalDiceSides) => {
    const entry = DICE_REGISTRY[sides]
    const world = createPhysicsWorld()
    createBoundaryColliders(world)

    const slots = computeSpawnSlots(DADOS_POR_TIPO, SPAWN_CONFIG.slotSafeHalfExtent)
    const dice = slots.map((slot) => ({
      body: entry.createBody(world),
      tracker: createSettleTracker(),
      slot,
      assentado: false,
      /** Tempo em fase de ENTRADA — alimenta o resgate; ver o comentário no laço. */
      entrandoMs: 0,
      /** Valor lido NO INSTANTE do assentamento — ver o comentário na asserção. */
      valor: null as number | null
    }))

    for (const die of dice) {
      tossDie(die.body, { target: die.slot })
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
        restoreWallCollisionIfInside(die.body, die.entrandoMs)
        if (!entrando) die.entrandoMs = 0
        const estado = die.tracker.update(die.body, dtMs)
        if (estado === 'settled') {
          const leitura = readTopFace(entry.definition, die.body.rotation(), resolveAmbiguousMargin(entry.definition))
          // Face ambígua não é falha: é o dado apoiado numa quina. O app cutuca e volta a esperar,
          // e é exatamente isso que o teste faz — testar o caminho de produção, não um atalho.
          if (leitura.isAmbiguous) {
            applyNudge(die.body)
            die.tracker.reset()
          } else {
            die.assentado = true
            die.valor = leitura.value
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
      expect(
        isInsideRegularPolygon(t.x, t.z, TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments, MARGEM_DA_PAREDE)
      ).toBe(true)

      /**
       * O valor conferido é o lido NO INSTANTE em que o dado assentou, e não uma releitura agora —
       * que é o que o app faz (ver `updateDie` em `DiceCanvasMulti`: a face vira `lastValue` na hora
       * do settle e o dado sai da roda).
       *
       * A primeira versão relia no fim e ficou FLAKY: a simulação continua enquanto os outros dados
       * não assentam, e um dado já parado pode levar um encontrão de outro e acabar apoiado numa
       * quina. Isso não é defeito — o resultado da rolagem já tinha sido lido —, mas fazia o teste
       * acusar face ambígua de vez em quando.
       */
      expect(die.valor).not.toBeNull()
      // 1..N, cada um uma vez (ver `allDice.test.ts`, que fixa essa regra na definição).
      expect(die.valor).toBeGreaterThanOrEqual(1)
      expect(die.valor).toBeLessThanOrEqual(sides)
    }
  })
})
