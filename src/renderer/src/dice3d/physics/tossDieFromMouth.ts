import RAPIER from '@dimforge/rapier3d-compat'
import { SPAWN_CONFIG } from '../config/physicsConfig'
import { computeTowerBesideLayout } from '../geometry/towerBesideTrayLayout'
import { randomInRange, randomQuaternion } from '../utils/random'
import { diceEnteringCollisionGroups } from './collisionGroups'

/**
 * Lança um dado A PARTIR DA BOCA da torre que fica ao lado da bandeja (ver
 * `towerBesideTrayLayout.ts`), rolando pra dentro do hexágono — o pedido do usuário: "os dados são
 * da boca dela e rolam no hexágono, não faz os dados spawnarem lá em cima".
 *
 * Diferente de `tossDie`, que nasce ALTO e do lado de fora, em ângulo sorteado ao redor do slot de
 * destino ("alguém em pé jogando os dados pra dentro"). Aqui o ponto de partida é FIXO — é uma boca
 * de pedra, todo dado sai do mesmo buraco — e o que varia é só a posição dentro do vão, o instante
 * da saída (ver `MOUTH_RELEASE_INTERVAL_MS`) e o impulso.
 *
 * A boca fica `TOWER_BESIDE_CONFIG.mouthClearance` acima do topo da parede, então o dado sai por
 * cima dela; ainda assim ele entra com os grupos de colisão de "entrando"
 * (`diceEnteringCollisionGroups`), restaurados por `restoreWallCollisionIfInside` assim que cruza
 * pra dentro — a mesma rede de segurança do arremesso normal, e o que torna o vão de 0.35 acima da
 * borda uma folga confortável em vez de uma passagem raspando.
 */

/**
 * Intervalo (ms) entre um dado e o próximo saindo da boca.
 *
 * Existe por necessidade física, não por estética: todo dado nasce no MESMO ponto, e dois corpos
 * criados sobrepostos fazem o solver aplicar um impulso de separação que pode arremessar um deles a
 * uma velocidade absurda — o mesmo problema que `SPAWN_CONFIG.launchRadiusJitter` resolve no
 * arremesso normal espalhando os pontos de partida. Aqui não dá pra espalhar no espaço (a boca é
 * uma só), então espalha-se no TEMPO. De brinde, é o que uma torre de dados de verdade faz: os
 * dados saem em fila, um atrás do outro.
 */
export const MOUTH_RELEASE_INTERVAL_MS = 140

/**
 * Faixa PRÓPRIA de velocidade e tempo de voo, em vez do `SPAWN_CONFIG` do arremesso normal.
 *
 * Esta é a correção do "os dados colidem demais e saem do hexágono" que o usuário reportou. Os dois
 * lançamentos calculam a velocidade igual — `distância até o slot / tempo de voo` —, mas partem de
 * situações opostas: no arremesso normal o ponto de partida é sorteado PERTO do ângulo do próprio
 * slot, então a distância é curta e o teto de 5.5 do `SPAWN_CONFIG` quase nunca é atingido. Da boca
 * sai tudo do MESMO ponto, e a distância até um slot do lado oposto chega a 11 — a conta pedia perto
 * de 20 e levava 5.5.
 *
 * O resultado era todo dado caindo curto, amontoado no canto da torre, batendo uns nos outros e
 * empurrando os da frente pra fora do vão. Não era a força que faltava por gosto: era um teto
 * herdado de uma geometria que não é esta.
 *
 * Subir a velocidade é seguro: o collider da parede tem `wallColliderHeight` de 20 de altura (contra
 * 1.8 do visual), justamente pra conter energia de impacto extra — dado nenhum sai por cima dela
 * depois de estar dentro.
 */
const MOUTH_FLIGHT_DURATION_RANGE = [0.45, 0.65] as const
const MOUTH_MIN_SPEED = 4.5
const MOUTH_MAX_SPEED = 9.5

/**
 * Abertura angular do arremesso, bem menor que a do arremesso normal (0.5 rad) — "deixa mais forte
 * pra que vá reto", pedido do usuário. Da bandeja, o desvio dá variedade a lançamentos que já vêm de
 * ângulos diferentes; da boca, onde todos partem do mesmo ponto e na mesma direção, o desvio só
 * espalha dado contra a parede lateral em vez de mandá-lo pro slot.
 */
const MOUTH_ANGLE_SPREAD_RAD = 0.12

export interface MouthTossOptions {
  /** Slot de destino dentro da bandeja (ver `computeSpawnSlots`) — dá a direção e a força do impulso. */
  target?: { x: number; z: number }
  /**
   * Raio circunscrito do dado (`scale × boundingRadius` da definição dele). É o que separa o CENTRO
   * do corpo do piso da boca: sem ele o dado nasce enterrado até a metade na madeira do tabuleiro e
   * atravessa o portão inteiro por dentro da pedra — que foi exatamente o "dado passando pelo portão
   * como se fosse fantasma" reportado pelo usuário.
   *
   * Tem que vir de fora, e não sair de uma média aqui, porque cada tipo tem o seu: 0.56 no d20,
   * 0.43 no d12. Um valor único deixaria metade dos tipos afundada e a outra metade flutuando.
   */
  radius?: number
  /** Lados da bandeja — a boca da torre se move com a forma (ver `computeTowerBesideLayout`). */
  sides?: number
}

export function tossDieFromMouth(body: RAPIER.RigidBody, options: MouthTossOptions = {}): void {
  const layout = computeTowerBesideLayout({}, options.sides)
  const target = options.target ?? { x: 0, z: 0 }

  if (body.numColliders() > 0) {
    body.collider(0).setCollisionGroups(diceEnteringCollisionGroups())
  }

  // Tangente do vão do portão: perpendicular à direção de saída, no plano do chão. É ao longo dela
  // que o ponto de partida varia — o dado sai por um lado ou por outro da boca, nunca sempre pelo
  // meio exato. A amplitude é uma fração do vão pra nenhum dado nascer encaixado na moldura.
  const tangent = { x: -layout.mouthDirection.z, z: layout.mouthDirection.x }
  // Reduzido de 0.28 pra 0.18 do vão junto com o resto: quanto mais lateral o dado nasce, mais
  // atravessado ele sai em relação à direção do slot, e mais chance tem de raspar a parede vizinha.
  const lateral = randomInRange([-layout.gateArcWidth * 0.18, layout.gateArcWidth * 0.18])
  // Um passo pra dentro do vão, pra o corpo não nascer com metade dele dentro da pedra do batente.
  const forward = 0.18

  const x = layout.mouth.x + tangent.x * lateral + layout.mouthDirection.x * forward
  const z = layout.mouth.z + tangent.z * lateral + layout.mouthDirection.z * forward
  /**
   * APOIADO no piso da boca: `mouth.y` é a superfície, e o centro do corpo fica um raio acima dela.
   * O sorteio de 0..0.08 continua, mas agora é um saltinho a partir do apoio, não a partir do meio
   * da pedra.
   */
  const y = layout.mouth.y + (options.radius ?? 0) + randomInRange([0, 0.08])

  body.setTranslation({ x, y, z }, true)

  const [qx, qy, qz, qw] = randomQuaternion()
  body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)

  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)

  // Mesma conta do arremesso normal: velocidade horizontal derivada da distância REAL até o slot,
  // não um impulso fixo — daqui até o slot mais próximo e até o mais distante da bandeja há uma
  // diferença de várias unidades, e um valor único deixaria metade dos dados curta e a outra
  // metade batendo na parede oposta.
  const towardTarget = Math.atan2(target.z - z, target.x - x)
  const angle = towardTarget + randomInRange([-MOUTH_ANGLE_SPREAD_RAD, MOUTH_ANGLE_SPREAD_RAD])
  const distance = Math.hypot(target.x - x, target.z - z)
  const flightDuration = randomInRange(MOUTH_FLIGHT_DURATION_RANGE)
  const speed = Math.min(Math.max(distance / flightDuration, MOUTH_MIN_SPEED), MOUTH_MAX_SPEED)

  body.applyImpulse(
    {
      x: Math.cos(angle) * speed,
      /**
       * Sem componente pra CIMA, ao contrário de `tossDie`. Lá o empurrãozinho vertical imita a mão
       * de quem joga; aqui o dado está saindo de um buraco na parede — qualquer subida faria ele
       * parecer cuspido pra cima, não rolando pra fora. A queda até o chão da bandeja (2.15) é o que
       * dá o tombo.
       */
      y: 0,
      z: Math.sin(angle) * speed
    },
    true
  )

  const torque = randomInRange(SPAWN_CONFIG.torqueStrengthRange)
  body.applyTorqueImpulse(
    {
      x: randomInRange([-torque, torque]),
      y: randomInRange([-torque, torque]),
      z: randomInRange([-torque, torque])
    },
    true
  )
}
