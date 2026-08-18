import RAPIER from '@dimforge/rapier3d-compat'
import { SETTLE_CONFIG } from '../config/physicsConfig'

export type SettleState = 'moving' | 'settling' | 'settled' | 'stuck'

export interface SettleTracker {
  /** Chamar uma vez por frame com o delta em ms; devolve o estado atualizado. */
  update: (body: RAPIER.RigidBody, deltaMs: number) => SettleState
  /** Chamar ao relançar o dado ou depois de uma perturbação, pra começar a contagem do zero. */
  reset: () => void
}

function magnitude(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/**
 * Só considera um dado "parado" quando a velocidade linear e angular ficam
 * abaixo dos limiares de `physicsConfig.SETTLE_CONFIG` de forma contínua por
 * `stableDurationMs` — não no instante em que cruzam o limiar. Isso evita
 * ler o resultado durante uma pausa momentânea no meio de um quique (o dado
 * desacelera perto do topo de cada quique, cruzando o limiar brevemente,
 * antes de cair de novo).
 *
 * Se isso nunca acontecer dentro de `maxSettleTimeMs`, reporta `'stuck'` —
 * o chamador decide o que fazer (nesta fase: aplicar uma perturbação mínima
 * e continuar simulando, nunca inventar um resultado).
 */
export function createSettleTracker(): SettleTracker {
  let stableForMs = 0
  let elapsedMs = 0

  return {
    update(body, deltaMs) {
      elapsedMs += deltaMs

      const isSlow =
        magnitude(body.linvel()) < SETTLE_CONFIG.linearVelocitySleepThreshold &&
        magnitude(body.angvel()) < SETTLE_CONFIG.angularVelocitySleepThreshold

      stableForMs = isSlow ? stableForMs + deltaMs : 0

      if (stableForMs >= SETTLE_CONFIG.stableDurationMs) return 'settled'
      if (elapsedMs >= SETTLE_CONFIG.maxSettleTimeMs) return 'stuck'
      return stableForMs > 0 ? 'settling' : 'moving'
    },
    reset() {
      stableForMs = 0
      elapsedMs = 0
    }
  }
}
