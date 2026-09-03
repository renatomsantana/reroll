import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { ensureRapierReady } from '../physics/rapierContext'
import { createPhysicsWorld } from '../physics/createPhysicsWorld'
import { createBoundaryColliders } from '../physics/createBoundaryColliders'
import { createSettleTracker } from '../physics/createSettleTracker'
import { applyNudge } from '../physics/applyNudge'
import { tossDie } from '../physics/tossDie'
import { restoreWallCollisionIfInside } from '../physics/collisionGroups'
import { clampLinearVelocity } from '../physics/clampVelocity'
import { readTopFace } from '../faceReading/readTopFace'
import { WORLD_CONFIG, resolveAmbiguousMargin } from '../config/physicsConfig'
import { AVAILABLE_DICE_TYPES, DICE_REGISTRY } from './registry'

/**
 * CADA DADO SOZINHO, na bandeja vazia, mil vezes: a face que cai sai na mesma proporção?
 *
 * Pedido dele (03/09/2026): "deixar a rolagem de dados o mais aleatória possível". A cena 3D não
 * sorteia número nenhum — o resultado é a física, e o acaso entra pelas condições iniciais do
 * arremesso (`tossDie`, agora sobre `crypto.getRandomValues`, ver `utils/random.ts`). Então a
 * pergunta certa não é "o gerador é bom?", é "a GEOMETRIA de cada dado é honesta quando cai de
 * um arremesso aleatório?". `d6.statistical.test.ts` responde pro d6; este responde pros sete,
 * com a mesma simulação de produção (mesmo `world.step()`, mesmo `readTopFace`, mesmo nudge).
 *
 * É teste de VIÉS GROSSEIRO, como o do d6: qui-quadrado com alfa 0,001, folgado de propósito pra
 * nunca falhar por flutuação — rolagem física tem mais variância que sorteio puro — e ainda assim
 * pegar centro de massa deslocado, face que nunca sai, numeração torta. A distribuição de cada
 * dado sai no console: é o número que se olha quando alguém perguntar se o d20 é honesto.
 */
/**
 * Trezentas por dado na suíte (uns oito segundos no total: a suíte inteira roda a cada commit, e
 * os testes de disco já caem por timeout quando a máquina está ocupada). Pra MEDIR de verdade,
 * suba o número: `ROLAGENS_ESTATISTICAS=5000 npx vitest run todosOsDados`. Medido em 03/09/2026
 * com 1000 e depois 5000 por dado: nenhum viés (o d10 deu 19,8 em 1000 e 4,9 em 5000, ou seja,
 * flutuação; o d20, 15,3 e 13,5).
 */
const ROLAGENS = Number(process.env.ROLAGENS_ESTATISTICAS ?? 300)
const MAXIMO_DE_PASSOS = 8000

/** Valor crítico do qui-quadrado, alfa 0,001, por graus de liberdade (faces − 1). */
const CRITICO: Record<number, number> = { 3: 16.266, 5: 20.515, 7: 24.322, 9: 27.877, 11: 31.264, 19: 43.82, 99: 148.23 }

function rolarUmaVez(world: RAPIER.World, body: RAPIER.RigidBody, sides: PhysicalDiceSides): number {
  const definicao = DICE_REGISTRY[sides].definition
  tossDie(body, { target: { x: 0, z: 0 } })
  const tracker = createSettleTracker()
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  for (let passo = 0; passo < MAXIMO_DE_PASSOS; passo++) {
    world.step()
    clampLinearVelocity(body, WORLD_CONFIG.maxLinearSpeed)
    restoreWallCollisionIfInside(body)
    const estado = tracker.update(body, dtMs)
    if (estado === 'settled') {
      const leitura = readTopFace(definicao, body.rotation(), resolveAmbiguousMargin(definicao))
      if (!leitura.isAmbiguous) return leitura.value
      applyNudge(body)
      tracker.reset()
    } else if (estado === 'stuck') {
      applyNudge(body)
      tracker.reset()
    }
  }
  throw new Error(`d${sides} não assentou em ${MAXIMO_DE_PASSOS} passos`)
}

describe('distribuição de cada dado sozinho (física real, headless)', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  for (const sides of AVAILABLE_DICE_TYPES) {
    it(
      `d${sides}: nenhum viés grosseiro em ${ROLAGENS} rolagens`,
      () => {
        const world = createPhysicsWorld()
        createBoundaryColliders(world)
        const body = DICE_REGISTRY[sides].createBody(world)
        const faces = [...new Set(DICE_REGISTRY[sides].definition.faces.map((face) => face.value))]
        const contagem = new Map<number, number>(faces.map((face) => [face, 0]))

        for (let i = 0; i < ROLAGENS; i++) {
          const valor = rolarUmaVez(world, body, sides)
          expect(contagem.has(valor), `leu ${valor}, que não é face do d${sides}`).toBe(true)
          contagem.set(valor, (contagem.get(valor) ?? 0) + 1)
        }
        world.free()

        const esperado = ROLAGENS / faces.length
        const qui = [...contagem.values()].reduce((soma, observado) => soma + (observado - esperado) ** 2 / esperado, 0)
        const critico = CRITICO[faces.length - 1]
        const resumo = [...contagem.entries()].map(([face, n]) => `${face}:${n}`).join(' ')
        console.log(`d${sides} — qui-quadrado ${qui.toFixed(2)} (crítico ${critico}) — ${resumo}`)

        // "Toda face saiu" só faz sentido com amostra folgada: com 300 rolagens do d100 (3 por face), uma face zerada é acaso, não viés.
        if (ROLAGENS >= faces.length * 10) {
          for (const [face, n] of contagem) expect(n, `a face ${face} do d${sides} nunca saiu`).toBeGreaterThan(0)
        }
        expect(qui, `d${sides} enviesado: ${resumo}`).toBeLessThan(critico)
      },
      120_000
    )
  }
})
