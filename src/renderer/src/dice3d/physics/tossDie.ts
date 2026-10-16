import RAPIER from '@dimforge/rapier3d-compat'
import { SPAWN_CONFIG, TRAY_CONFIG } from '../config/physicsConfig'
import { trayApothem, trayRotation } from '../geometry/trayShape'
import { randomInRange, randomQuaternion } from '../utils/random'
import { diceEnteringCollisionGroups } from './collisionGroups'
import { regularPolygonRadiusAt } from './regularPolygon'
import {
  aplicarFisicaDoPrimeiroRicochete,
  multiplicadoresDaForca,
  restaurarFisicaDoDado,
  velocidadeMaximaDoRicochete,
  type DiceBasePhysics,
  type LaunchDirection,
  type ThrowStrength
} from './tossDieFromMouth'

export interface TossOptions {
  /** Slot de destino (padrão: centro da bandeja) — o dado nasce a `throwDistance` dali e é arremessado de volta em direção a ele. Usado pra espalhar vários dados em slots (Fase 9). */
  target?: { x: number; z: number }
  /**
   * Lados da bandeja em cena — a forma é escolhida pelo usuário (ver `trayShape.ts`), e o ponto
   * de largada tem que acompanhar. Ver o comentário de `launchRadius` no corpo.
   */
  sides?: number
  /** Intensidade do lançamento; Forte atravessa a bandeja e busca a parede oposta. */
  strength?: ThrowStrength
  /** Material original, usado para o ricochete temporário e sua restauração. */
  basePhysics?: DiceBasePhysics
}

/**
 * Reposiciona qualquer dado com um ARREMESSO DE FORA DA BANDEJA: nasce do lado de fora, numa direção
 * aleatória em torno do slot de destino, e é arremessado de volta pra dentro, como se uma mão
 * alcançasse por cima da borda. Zera a velocidade antes, senão o impulso novo soma com o resto da
 * queda anterior.
 *
 * O dado nasce numa altura BAIXA mesmo estando horizontalmente do lado de fora, porque ele atravessa o
 * LUGAR da parede sem colidir com ela enquanto está entrando (ver `collisionGroups.ts`). Isso importa
 * de verdade: exigir altura suficiente pra saltar a parede multiplicava a velocidade de impacto no
 * chão (∝ √altura) o bastante pra, com a bandeja cheia, ocasionalmente arremessar um dado por cima da
 * parede na hora de POUSAR — o mesmo escape que este módulo evita, causado pela entrada.
 */
export function tossDie(body: RAPIER.RigidBody, options: TossOptions = {}): LaunchDirection | null {
  const target = options.target ?? { x: 0, z: 0 }
  const sides = options.sides ?? TRAY_CONFIG.wallSegments
  const selectedStrength = options.strength ?? 'normal'
  const ricochet = selectedStrength === 'forte' || selectedStrength === 'explosao'

  if (body.numColliders() > 0) {
    body.collider(0).setCollisionGroups(diceEnteringCollisionGroups())
    if (options.basePhysics) {
      if (ricochet) aplicarFisicaDoPrimeiroRicochete(body, options.basePhysics, selectedStrength)
      else restaurarFisicaDoDado(body, options.basePhysics)
    }
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
  /**
   * Distância do centro até o ponto de largada: a borda da bandeja NA DIREÇÃO DO LANÇAMENTO, mais a
   * folga de fora e o jitter (que evita dois dados com ângulo parecido nascerem sobrepostos).
   *
   * Era `TRAY_CONFIG.apothem` fixo, o do hexágono, e isso quebrava nas outras formas com número
   * medido: no TRIÂNGULO, cujo apótema é 3.75, o dado largava de 8.5 e atravessava quase cinco
   * unidades de vazio antes de entrar — 72% dos dados eram desviados no caminho e precisavam do
   * empurrão de retorno, contra 13% no hexágono. O triângulo não é difícil: o dado estava sendo
   * largado num ponto calculado pra outra forma.
   *
   * `regularPolygonRadiusAt` e não o apótema porque a borda de um polígono não fica à mesma distância
   * em toda direção — largar sempre no apótema deixaria o dado NASCER DENTRO da bandeja quando o
   * ângulo cai perto de uma ponta.
   */
  const launchRadius =
    regularPolygonRadiusAt(launchAngle, trayApothem(sides), sides, trayRotation(sides)) +
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
  // A rajada atravessa a bandeja num único instante visual; CCD impede que a velocidade extrema
  // pule o collider fino da parede entre dois passos da física. A gravidade continua ligada aqui,
  // porque sem torre o dado primeiro encosta no chão e então vai à parede.
  body.setGravityScale(1, true)
  body.enableCcd(ricochet)

  const oppositeAngle = launchAngle + Math.PI
  const oppositeWallRadius = regularPolygonRadiusAt(oppositeAngle, trayApothem(sides), sides, trayRotation(sides))
  const ricochetTarget = {
    x: Math.cos(oppositeAngle) * (oppositeWallRadius - 0.15),
    z: Math.sin(oppositeAngle) * (oppositeWallRadius - 0.15)
  }
  const effectiveTarget = ricochet ? ricochetTarget : target
  const towardTargetAngle = Math.atan2(effectiveTarget.z - z, effectiveTarget.x - x)
  const impulseAngle =
    towardTargetAngle +
    randomInRange(ricochet ? [-0.06, 0.06] : [-SPAWN_CONFIG.throwAngleSpreadRad, SPAWN_CONFIG.throwAngleSpreadRad])

  // Impulso horizontal calculado a partir da distância REAL até o slot (ver o comentário de
  // `flightDurationRange` em physicsConfig.ts) — nunca fixo, senão fica errado tanto pra
  // lançamentos próximos quanto distantes, já que o ponto de lançamento agora varia bem
  // mais (é sorteado ao redor do centro da bandeja, não mais perto do slot).
  const distanceToTarget = Math.hypot(effectiveTarget.x - x, effectiveTarget.z - z)
  const flightDuration = randomInRange(SPAWN_CONFIG.flightDurationRange)
  const strength = multiplicadoresDaForca(selectedStrength)
  const baseHorizontalSpeed = ricochet
    ? 10.25
    : Math.min(
        Math.max(distanceToTarget / flightDuration, SPAWN_CONFIG.minHorizontalSpeed),
        SPAWN_CONFIG.maxHorizontalSpeed
      )
  const horizontalSpeed = baseHorizontalSpeed * strength.speed

  body.applyImpulse(
    {
      x: Math.cos(impulseAngle) * horizontalSpeed,
      // Componente pra cima: dá um pequeno arco de arremesso de verdade, em vez do dado só
      // deslizar rente ao chão desde o primeiro instante (ver `verticalImpulseRange`).
      y: ricochet ? 0.18 : randomInRange(SPAWN_CONFIG.verticalImpulseRange),
      z: Math.sin(impulseAngle) * horizontalSpeed
    },
    true
  )

  const torqueStrength = randomInRange(SPAWN_CONFIG.torqueStrengthRange) * strength.torque
  body.applyTorqueImpulse(
    {
      x: randomInRange([-torqueStrength, torqueStrength]),
      y: randomInRange([-torqueStrength, torqueStrength]),
      z: randomInRange([-torqueStrength, torqueStrength])
    },
    true
  )

  return ricochet
    ? {
        x: Math.cos(impulseAngle),
        z: Math.sin(impulseAngle),
        speedCap: velocidadeMaximaDoRicochete(selectedStrength)
      }
    : null
}
