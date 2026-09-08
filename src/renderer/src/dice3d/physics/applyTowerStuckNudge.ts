import RAPIER from '@dimforge/rapier3d-compat'
import { randomInRange } from '../utils/random'
import { findNearestBaffleDirection } from '../geometry/buildTowerBaffles'

/**
 * Empurrão de recuperação SÓ da torre: direcionado (não radial genérico) e escalado por `attempt`,
 * quantas vezes seguidas o dado já foi considerado travado sem progresso no meio.
 *
 * O diagnóstico foi uma cadeia de tentativas medidas, e ela é o argumento contra simplificar isto: um
 * teste headless com os 7 tipos de dado (o d6 sozinho sempre deu 100%) achou d20 e d100 presos na
 * primeira prateleira, porque formas com muitas facetas quase planas encontram ali um repouso estável
 * que d4-d12 não encontram. Empurrão genérico mais forte: ainda 0/20 nos dois. Arredondar a quina da
 * prateleira: insuficiente sozinho. Empurrão DIRECIONADO (`findNearestBaffleDirection`): resolveu o d20
 * na hora, e o d100 continuou preso, porque o atrito máximo engolia o impulso no mesmo frame. Reduzir
 * o atrito do d100 dentro da torre: insuficiente sozinho, mantido porque ajuda. Aumentar o
 * DESLOCAMENTO DE POSIÇÃO: resolveu o d100 de vez.
 *
 * E daí veio o bug seguinte: aplicar a versão forte, com salto de posição, já na primeira pausa fazia
 * dados que só tiveram um quique normal entre prateleiras pularem visivelmente pra baixo — "the dice...
 * are just jumping through the tower to the floor". Por isso os três níveis por `attempt`: correção bem
 * discreta na primeira (só impulso e torque leves), intermediária na segunda, e a forte, com salto de
 * posição, só da terceira em diante — onde chega quem realmente precisa.
 */
interface NudgeTier {
  impulseStrength: number
  liftStrength: number
  torqueStrength: number
  positionNudgeDistance: number
}

const TIERS: NudgeTier[] = [
  { impulseStrength: 0.8, liftStrength: 0.5, torqueStrength: 1.2, positionNudgeDistance: 0 },
  { impulseStrength: 1.8, liftStrength: 1.1, torqueStrength: 2.2, positionNudgeDistance: 0 },
  { impulseStrength: 3.0, liftStrength: 2.0, torqueStrength: 3.0, positionNudgeDistance: 0.9 }
]

export function applyTowerStuckNudge(body: RAPIER.RigidBody, attempt: number): void {
  const tier = TIERS[Math.min(attempt, TIERS.length) - 1]
  const direction = findNearestBaffleDirection(body.translation().y)

  if (tier.positionNudgeDistance > 0) {
    const t = body.translation()
    body.setTranslation(
      {
        x: t.x + direction.x * tier.positionNudgeDistance,
        y: t.y + Math.abs(direction.y) * tier.positionNudgeDistance,
        z: t.z + direction.z * tier.positionNudgeDistance
      },
      true
    )
  }

  body.applyImpulse(
    {
      x: direction.x * tier.impulseStrength,
      y: tier.liftStrength,
      z: direction.z * tier.impulseStrength
    },
    true
  )

  body.applyTorqueImpulse(
    {
      x: randomInRange([-tier.torqueStrength, tier.torqueStrength]),
      y: randomInRange([-tier.torqueStrength, tier.torqueStrength]),
      z: randomInRange([-tier.torqueStrength, tier.torqueStrength])
    },
    true
  )
}
