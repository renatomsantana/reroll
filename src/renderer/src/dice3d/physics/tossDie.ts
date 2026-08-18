import RAPIER from '@dimforge/rapier3d-compat'
import { SPAWN_CONFIG, TRAY_CONFIG } from '../config/physicsConfig'
import { randomInRange, randomQuaternion } from '../utils/random'
import { diceEnteringCollisionGroups } from './collisionGroups'

export interface TossOptions {
  /** Slot de destino (padrão: centro da bandeja) — o dado nasce a `throwDistance` dali e é arremessado de volta em direção a ele. Usado pra espalhar vários dados em slots (Fase 9). */
  target?: { x: number; z: number }
}

/**
 * Reposiciona qualquer dado com um ARREMESSO DE FORA DA BANDEJA: nasce do
 * lado de fora dela, numa direção aleatória em torno do slot de destino, e é
 * arremessado de volta pra dentro — como se uma mão alcançasse por cima da
 * borda e jogasse o dado, em vez de o dado já nascer dentro da bandeja. Zera
 * a velocidade antes: senão o impulso novo soma com o resto de velocidade da
 * queda anterior.
 *
 * O dado nasce numa altura BAIXA (perto do chão, não perto do topo da
 * parede) mesmo estando horizontalmente do lado de fora — ele atravessa o
 * LUGAR da parede sem colidir com ela enquanto ainda está "entrando" (ver
 * `collisionGroups.ts`/`restoreWallCollisionIfInside`), então não precisa de
 * um arco alto o bastante pra literalmente pular por cima dela. Isso importa
 * de verdade: exigir altura suficiente pra saltar a parede (>
 * `TRAY_CONFIG.wallHeight`) multiplicava a velocidade de impacto no chão
 * (∝ √altura) o bastante pra, com `MAX_SIMULTANEOUS_DICE` dados colidindo ao
 * mesmo tempo, ocasionalmente arremessar um dado de volta pra fora por cima
 * da parede na hora de POUSAR — o mesmo bug de escape que este módulo evita,
 * só que causado pela ENTRADA em vez de evitado por ela.
 */
export function tossDie(body: RAPIER.RigidBody, options: TossOptions = {}): void {
  const target = options.target ?? { x: 0, z: 0 }

  if (body.numColliders() > 0) {
    body.collider(0).setCollisionGroups(diceEnteringCollisionGroups())
  }

  // O ângulo de lançamento é sorteado em torno do ângulo do PRÓPRIO slot de destino (não
  // totalmente independente) — como uma mão que alcança por cima da borda perto de onde vai
  // soltar aquele dado, não de qualquer lugar aleatório da bandeja. Isso importa de verdade
  // com muitos dados simultâneos: ângulos totalmente independentes fazem as trajetórias se
  // cruzarem bem mais (um dado lançado de um lado mirando o slot do lado oposto atravessa o
  // caminho de vários outros dados no meio do ar), gerando colisões em cadeia que impedem
  // alguns dados de assentar dentro do tempo esperado — visto na prática rodando
  // `diceEscape.test.ts` com os 24 dados simultâneos do limite da cena.
  const targetAngleFromCenter = Math.atan2(target.z, target.x)
  const spread = SPAWN_CONFIG.launchAngleSpreadRad
  const launchAngle = targetAngleFromCenter + randomInRange([-spread, spread])
  // Jitter na distância (ver comentário de `launchRadiusJitter`) — evita que dois dados com
  // ângulo de lançamento parecido nasçam sobrepostos um no outro.
  const launchRadius =
    TRAY_CONFIG.apothem +
    SPAWN_CONFIG.launchOutsideDistance +
    randomInRange([-SPAWN_CONFIG.launchRadiusJitter, SPAWN_CONFIG.launchRadiusJitter])
  const x = Math.cos(launchAngle) * launchRadius
  const z = Math.sin(launchAngle) * launchRadius
  const y = randomInRange(SPAWN_CONFIG.launchHeightRange)

  body.setTranslation({ x, y, z }, true)

  const [qx, qy, qz, qw] = randomQuaternion()
  body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)

  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)

  const towardTargetAngle = Math.atan2(target.z - z, target.x - x)
  const impulseAngle =
    towardTargetAngle + randomInRange([-SPAWN_CONFIG.throwAngleSpreadRad, SPAWN_CONFIG.throwAngleSpreadRad])

  // Impulso horizontal calculado a partir da distância REAL até o slot (ver o comentário de
  // `flightDurationRange` em physicsConfig.ts) — nunca fixo, senão fica errado tanto pra
  // lançamentos próximos quanto distantes, já que o ponto de lançamento agora varia bem
  // mais (é sorteado ao redor do centro da bandeja, não mais perto do slot).
  const distanceToTarget = Math.hypot(target.x - x, target.z - z)
  const flightDuration = randomInRange(SPAWN_CONFIG.flightDurationRange)
  const horizontalSpeed = Math.min(
    Math.max(distanceToTarget / flightDuration, SPAWN_CONFIG.minHorizontalSpeed),
    SPAWN_CONFIG.maxHorizontalSpeed
  )

  body.applyImpulse(
    {
      x: Math.cos(impulseAngle) * horizontalSpeed,
      // Componente pra cima: dá um pequeno arco de arremesso de verdade, em vez do dado só
      // deslizar rente ao chão desde o primeiro instante (ver `verticalImpulseRange`).
      y: randomInRange(SPAWN_CONFIG.verticalImpulseRange),
      z: Math.sin(impulseAngle) * horizontalSpeed
    },
    true
  )

  const torqueStrength = randomInRange(SPAWN_CONFIG.torqueStrengthRange)
  body.applyTorqueImpulse(
    {
      x: randomInRange([-torqueStrength, torqueStrength]),
      y: randomInRange([-torqueStrength, torqueStrength]),
      z: randomInRange([-torqueStrength, torqueStrength])
    },
    true
  )
}
