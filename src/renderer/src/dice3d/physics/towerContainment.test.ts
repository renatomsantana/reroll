import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createTowerColliders } from './createTowerColliders'
import { createDescentProgressTracker } from './createDescentProgressTracker'
import { applyTowerStuckNudge } from './applyTowerStuckNudge'
import { dropDieIntoTower } from './dropDieIntoTower'
import { exitTowerIfDescended } from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { TOWER_CONFIG, WORLD_CONFIG } from '../config/physicsConfig'
import { TOWER_TOP_Y } from '../geometry/buildTowerBaffles'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'

/**
 * Regressão de contenção pro mecanismo de prateleiras (baffles) da torre — física real,
 * `world.step()` de verdade, mesma lógica de travamento/empurrão usada em produção
 * (`DiceCanvasMulti.tsx`). Mede "chegou até a saída dentro do tempo esperado, sem ficar preso
 * pra sempre entre duas prateleiras", equivalente ao que `diceEscape.test.ts` já mede pra
 * bandeja aberta.
 *
 * Substituiu o teste da rampa em espiral (removida nesta sessão — ver `tower.md.txt`/
 * `dice_tower_parametric_prompt.md`, specs trazidas pelo usuário pedindo um mecanismo de
 * prateleiras, não uma rampa contínua).
 *
 * COBRE TODOS OS TIPOS DE DADO, não só o d6 — BUG REAL encontrado nesta sessão: uma versão
 * anterior deste teste só cobria o d6 (100% confiável) e passou, mas o usuário reportou o dado
 * travando de verdade no app. Medido depois, caso a caso: D20 (icosaédrico) e D100 (quase
 * esférico) ficavam PERMANENTEMENTE presos na primeira prateleira — formas "redondas" encontram
 * um repouso estável por atrito na inclinação rasa das prateleiras (15°) que formas mais
 * angulares (D4-D12) não encontram. Um teste que só cobre um tipo de dado não pega esse tipo de
 * regressão — cada tipo tem geometria de colisão própria (cuboide pro d6, casco convexo pros
 * poliedros, ver `dice-defs/registry.ts`) que se comporta de forma bem diferente contra as
 * mesmas prateleiras.
 */
function simulateOneDescent(
  world: RAPIER.World,
  body: RAPIER.RigidBody,
  topY: number,
  maxSteps: number,
  sides: PhysicalDiceSides
): 'reached-exit' | 'stuck' | 'timed-out' {
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  const tracker = createDescentProgressTracker()
  tracker.reset(topY)

  for (let step = 0; step < maxSteps; step++) {
    world.step()
    clampLinearVelocity(body, WORLD_CONFIG.maxLinearSpeed)
    exitTowerIfDescended(body, sides)

    if (body.translation().y <= TOWER_CONFIG.exitY) return 'reached-exit'

    const { state, stuckAttempts } = tracker.update(body, dtMs)
    if (state === 'stuck') {
      // Mesma recuperação usada em produção (`DiceCanvasMulti.tsx`) — ver `applyTowerStuckNudge.ts`.
      applyTowerStuckNudge(body, stuckAttempts)
      tracker.softResetAfterNudge(body.translation().y)
    }
  }
  return 'timed-out'
}

describe('contenção da torre (prateleiras/baffles) — dado deve cair até a saída sem travar pra sempre', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it.each(AVAILABLE_DICE_TYPES)(
    'd%s solto no topo da torre chega até a saída em várias tentativas seguidas',
    (sides: PhysicalDiceSides) => {
      const world = createPhysicsWorld(TOWER_CONFIG.gravity)
      createTowerColliders(world)
      const body = DICE_REGISTRY[sides].createBody(world)

      const TRIALS = 20
      let reachedExit = 0
      // BUG DE COMENTÁRIO herdado do teste da rampa espiral original: dizia "5s" mas
      // `5 * 60 * physicsStepsPerSecond` são 300 SEGUNDOS (5 minutos) simulados por tentativa,
      // não 5 — corrigido aqui só a documentação, o valor em si (bem generoso, um teto de
      // "nunca deveria demorar tanto quanto isso") continua o mesmo.
      const MAX_STEPS = 5 * 60 * WORLD_CONFIG.physicsStepsPerSecond // 300s (5min) de física simulada por tentativa

      for (let trial = 0; trial < TRIALS; trial++) {
        dropDieIntoTower(body, TOWER_TOP_Y, sides)
        const result = simulateOneDescent(world, body, TOWER_TOP_Y, MAX_STEPS, sides)
        if (result === 'reached-exit') {
          reachedExit++
          // Não atravessou o chão/prateleira (tunneling) — ainda dentro de uma faixa vertical plausível.
          expect(body.translation().y).toBeGreaterThan(-1)
          expect(body.translation().y).toBeLessThanOrEqual(TOWER_TOP_Y)
        }
      }

      console.log(`TOWER_CONTAINMENT d${sides}: ${reachedExit}/${TRIALS} chegaram à saída dentro do limite de passos`)
      // Margem conservadora abaixo do que for medido, mesma filosofia de `diceEscape.test.ts` —
      // nunca prometer 100% de física real.
      expect(reachedExit).toBeGreaterThanOrEqual(Math.ceil(TRIALS * 0.6))

      world.free()
    },
    120000
  )
})
