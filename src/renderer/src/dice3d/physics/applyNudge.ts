import RAPIER from '@dimforge/rapier3d-compat'
import { NUDGE_CONFIG } from '../config/physicsConfig'
import { randomInRange } from '../utils/random'

/**
 * Perturbação física mínima — não um resultado sorteado. Usada só quando o
 * dado assenta equilibrado numa aresta/vértice (ambíguo) ou trava sem
 * assentar. A física continua decidindo o resultado; isso só desfaz um
 * equilíbrio instável que não existiria com atrito/geometria perfeitos.
 */
export function applyNudge(body: RAPIER.RigidBody): void {
  const { impulseStrength, torqueStrength } = NUDGE_CONFIG

  body.applyImpulse(
    {
      x: randomInRange([-impulseStrength, impulseStrength]),
      y: impulseStrength,
      z: randomInRange([-impulseStrength, impulseStrength])
    },
    true
  )

  body.applyTorqueImpulse(
    {
      x: randomInRange([-torqueStrength, torqueStrength]),
      y: randomInRange([-torqueStrength, torqueStrength]),
      z: randomInRange([-torqueStrength, torqueStrength])
    },
    true
  )
}
