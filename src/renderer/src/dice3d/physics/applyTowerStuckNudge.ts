import RAPIER from '@dimforge/rapier3d-compat'
import { randomInRange } from '../utils/random'
import { findNearestBaffleDirection } from '../geometry/buildTowerBaffles'

/**
 * Empurrão de recuperação SÓ da torre — DIRECIONADO (não um empurrão radial genérico) e
 * ESCALADO por `attempt` (quantas vezes SEGUIDAS, sem progresso real no meio, o dado já foi
 * considerado "travado" — ver `DieInstance.stuckAttempts` em `DiceCanvasMulti.tsx`).
 *
 * HISTÓRICO DE DIAGNÓSTICO nesta sessão: um teste headless cobrindo os 7 tipos de dado (não só o
 * d6, que sozinho sempre deu 100%) achou que D20 (icosaédrico) e D100 (quase esférico) ficavam
 * presos na primeira prateleira — formas com muitas facetas quase planas encontram um repouso
 * estável ali que dados mais angulares (D4-D12) não encontram. Cadeia de tentativas medidas:
 * 1. Empurrão genérico mais forte (radial-pra-fora do eixo central) — ainda 0/20 pros dois.
 * 2. Arredondar a quina física da prateleira (`baffleEdgeRadius`) — sozinho, insuficiente.
 * 3. Empurrão DIRECIONADO (`findNearestBaffleDirection`) — resolveu o D20 na hora. D100 continuou
 *    preso (atrito máximo "engolia" o impulso quase inteiro no mesmo frame).
 * 4. Reduzir atrito/restituição do D100 só dentro da torre (`TOWER_D100_PHYSICS_OVERRIDE`) —
 *    sozinho insuficiente, mas mantido (não atrapalha, ajuda combinado com o resto).
 * 5. Aumentar bastante o DESLOCAMENTO DE POSIÇÃO (não só impulso) — resolveu o D100 de vez.
 *
 * BUG REAL da rodada seguinte: aplicar a versão FORTE (com salto de posição) já na PRIMEIRA
 * pausa detectada fazia dados que só tiveram um quique normal entre duas prateleiras (não really
 * "travados", só uma pausa momentânea que o `stuckTimeoutMs` == 500ms às vezes captura) "pularem"
 * visivelmente pra baixo, em vez de escorregar pela prateleira como deveriam — o usuário reportou
 * "the dice... are just jumping through the tower to the floor". A força forte continua
 * necessária pro D100 (que genuinamente precisa dela, em múltiplos ciclos), mas não deveria ser o
 * padrão pra toda pausa. Corrigido escalando em 3 níveis por `attempt`:
 * - 1ª tentativa: correção BEM discreta (só impulso pequeno + torque leve, sem mexer na posição)
 *   — o suficiente pra maioria dos casos reais (um dado só de leve equilibrado numa borda).
 * - 2ª tentativa: correção intermediária (mais impulso/torque, ainda sem mexer na posição).
 * - 3ª tentativa em diante: a correção forte (salto de posição incluído) — só chega aqui quem
 *   realmente precisa, depois de duas tentativas mais discretas já terem falhado.
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
