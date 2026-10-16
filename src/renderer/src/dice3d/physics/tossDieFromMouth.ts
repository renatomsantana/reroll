import RAPIER from '@dimforge/rapier3d-compat'
import { SPAWN_CONFIG } from '../config/physicsConfig'
import { computeTowerBesideLayout } from '../geometry/towerBesideTrayLayout'
import { randomInRange, randomQuaternion } from '../utils/random'
import { diceEnteringCollisionGroups } from './collisionGroups'

/**
 * Lança um dado A PARTIR DA BOCA da torre que fica ao lado da bandeja (ver
 * `towerBesideTrayLayout.ts`), rolando pra dentro do hexágono: "os dados são da boca dela e rolam no
 * hexágono, não faz os dados spawnarem lá em cima".
 *
 * Diferente de `tossDie`, que nasce alto e do lado de fora, em ângulo sorteado ao redor do slot de
 * destino. Aqui o ponto de partida é FIXO — é uma boca de pedra, todo dado sai do mesmo buraco — e o
 * que varia é a posição dentro do vão, o instante da saída e o impulso. O dado sai com os grupos de
 * "entrando" (`diceEnteringCollisionGroups`), restaurados por `restoreWallCollisionIfInside` assim
 * que ele cruza pra dentro: a mesma rede de segurança do arremesso normal.
 */

/**
 * Intervalo (ms) entre um dado e o próximo saindo da boca. Existe por necessidade física, não por
 * estética: todo dado nasce no MESMO ponto, e dois corpos criados sobrepostos fazem o solver aplicar
 * um impulso de separação capaz de arremessar um deles a uma velocidade absurda — o mesmo problema
 * que `SPAWN_CONFIG.launchRadiusJitter` resolve no arremesso normal espalhando os pontos de partida.
 * Aqui não dá pra espalhar no espaço, então espalha-se no TEMPO; de brinde, é o que uma torre de
 * dados de verdade faz, com os dados saindo em fila.
 */
export const MOUTH_RELEASE_INTERVAL_MS = 140

export type ThrowStrength = 'leve' | 'normal' | 'forte' | 'explosao'

export interface DiceBasePhysics {
  restitution: number
  friction: number
  linearDamping: number
  angularDamping: number
}

export interface LaunchDirection {
  x: number
  z: number
  /** Teto desta rajada até a primeira parede; o modo Explosão precisa de um teto próprio. */
  speedCap: number
}

/**
 * A força altera duas coisas que uma mão altera de verdade: deslocamento e giro. `normal` preserva
 * exatamente a física que já estava aprovada; os outros modos só escalam o lançamento, e o teto
 * global de velocidade da cena continua impedindo uma colisão rara de expulsar o dado da mesa.
 */
const THROW_STRENGTH_MULTIPLIERS: Record<ThrowStrength, { speed: number; torque: number }> = {
  leve: { speed: 0.72, torque: 0.75 },
  normal: { speed: 1, torque: 1 },
  forte: { speed: 1.35, torque: 1.65 },
  // A velocidade é o exagero; giro 4,8× fazia grupos de d20 se apoiarem uns nos outros e nunca
  // cruzarem o limiar de repouso. Ainda gira mais que Forte, sem deixar “Rolando...” eterno.
  explosao: { speed: 4.4, torque: 2 }
}

export function multiplicadoresDaForca(strength: ThrowStrength): {
  speed: number
  torque: number
} {
  return THROW_STRENGTH_MULTIPLIERS[strength]
}

/**
 * Faixa PRÓPRIA de velocidade e tempo de voo, em vez do `SPAWN_CONFIG` do arremesso normal.
 *
 * É a correção do "os dados colidem demais e saem do hexágono". Os dois lançamentos calculam a
 * velocidade igual (`distância até o slot / tempo de voo`), mas partem de situações opostas: no
 * normal o ponto de partida é sorteado perto do ângulo do próprio slot, então a distância é curta e
 * o teto de 5.5 quase nunca é atingido; da boca sai tudo do MESMO ponto, e a distância até um slot do
 * lado oposto chega a 11 — a conta pedia perto de 20 e levava 5.5. O resultado era todo dado caindo
 * curto, amontoado no canto da torre e empurrando os da frente pra fora do vão.
 *
 * Subir a velocidade é seguro: o collider da parede tem 20 de altura (contra 1.8 do visual),
 * justamente pra conter energia de impacto extra.
 */
const MOUTH_FLIGHT_DURATION_RANGE = [0.45, 0.65] as const
const MOUTH_MIN_SPEED = 4.5
const MOUTH_MAX_SPEED = 9.5

/** Rajada curta do Forte pela torre; dura só até a primeira parede. */
export const STRONG_TOWER_FLIGHT_SPEED = 24
/** Modo propositalmente exagerado: quase o dobro do Forte, ainda contido pela parede e pelo CCD. */
export const EXPLOSION_FLIGHT_SPEED = 46

export function velocidadeMaximaDoRicochete(strength: ThrowStrength): number {
  return strength === 'explosao' ? EXPLOSION_FLIGHT_SPEED : STRONG_TOWER_FLIGHT_SPEED
}

/**
 * Abertura angular do arremesso, bem menor que a do normal (0.5 rad): "deixa mais forte pra que vá
 * reto". Da bandeja, o desvio dá variedade a lançamentos que já vêm de ângulos diferentes; da boca,
 * onde todos partem do mesmo ponto e na mesma direção, ele só espalha dado contra a parede lateral.
 */
const MOUTH_ANGLE_SPREAD_RAD = 0.12

/** O forte mira a parede oposta, com material mais elástico, para produzir um ricochete visível. */
const STRONG_RICOCHET_ANGLE_SPREAD_RAD = 0.08
const STRONG_RICOCHET_RESTITUTION = 0.9
const STRONG_RICOCHET_FRICTION = 0.12

/**
 * Material temporário: existe só até o primeiro ricochete. O amortecimento continua sendo o
 * original do dado, para a força extra não virar uma sequência longa de quicadas.
 */
export function aplicarFisicaDoPrimeiroRicochete(
  body: RAPIER.RigidBody,
  basePhysics: DiceBasePhysics,
  strength: ThrowStrength = 'forte'
): void {
  if (body.numColliders() === 0) return
  const collider = body.collider(0)
  const explosao = strength === 'explosao'
  collider.setRestitution(Math.max(basePhysics.restitution, explosao ? 0.98 : STRONG_RICOCHET_RESTITUTION))
  collider.setFriction(Math.min(basePhysics.friction, explosao ? 0.03 : STRONG_RICOCHET_FRICTION))
  collider.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
  collider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
  body.setLinearDamping(basePhysics.linearDamping)
  body.setAngularDamping(basePhysics.angularDamping)
}

/** Volta imediatamente ao material normal depois que a parede devolve o dado. */
export function restaurarFisicaDoDado(body: RAPIER.RigidBody, basePhysics: DiceBasePhysics): void {
  if (body.numColliders() === 0) return
  const collider = body.collider(0)
  collider.setRestitution(basePhysics.restitution)
  collider.setFriction(basePhysics.friction)
  collider.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Average)
  collider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
  body.setLinearDamping(basePhysics.linearDamping)
  body.setAngularDamping(basePhysics.angularDamping)
  body.setGravityScale(1, true)
  body.enableCcd(false)
}

/**
 * Depois do ricochete explosivo a cena precisa voltar ao controle rapidamente. A pancada inicial
 * permanece idêntica; só a cauda recebe mais amortecimento, evitando pilhas de muitos dados que
 * parecem paradas mas continuam girando frações de radiano para sempre.
 */
export function amortecerDepoisDaExplosao(body: RAPIER.RigidBody, basePhysics: DiceBasePhysics): void {
  restaurarFisicaDoDado(body, basePhysics)
  body.setLinearDamping(Math.max(basePhysics.linearDamping, 0.7))
  body.setAngularDamping(Math.max(basePhysics.angularDamping, 0.9))
}

export interface MouthTossOptions {
  /** Slot de destino dentro da bandeja (ver `computeSpawnSlots`) — dá a direção e a força do impulso. */
  target?: { x: number; z: number }
  /**
   * Raio circunscrito do dado (`scale × boundingRadius` da definição dele). É o que separa o CENTRO
   * do corpo do piso da boca: sem ele o dado nasce enterrado até a metade na madeira do tabuleiro e
   * atravessa o portão inteiro por dentro da pedra — o "dado passando pelo portão como se fosse
   * fantasma". Vem de fora porque cada tipo tem o seu (0.56 no d20, 0.43 no d12), e um valor único
   * deixaria metade dos tipos afundada e a outra metade flutuando.
   */
  radius?: number
  /** Lados da bandeja — a boca da torre se move com a forma (ver `computeTowerBesideLayout`). */
  sides?: number
  /** Intensidade escolhida na rolagem: muda a velocidade de saída e o giro do dado. */
  strength?: ThrowStrength
  /** Material original deste tipo de dado, restaurado ao sair do modo Forte. */
  basePhysics?: DiceBasePhysics
}

export function tossDieFromMouth(body: RAPIER.RigidBody, options: MouthTossOptions = {}): LaunchDirection | null {
  const layout = computeTowerBesideLayout({}, options.sides)
  const target = options.target ?? { x: 0, z: 0 }
  const selectedStrength = options.strength ?? 'normal'
  const ricochet = selectedStrength === 'forte' || selectedStrength === 'explosao'

  if (body.numColliders() > 0) {
    const collider = body.collider(0)
    collider.setCollisionGroups(diceEnteringCollisionGroups())
    if (options.basePhysics) {
      if (ricochet) aplicarFisicaDoPrimeiroRicochete(body, options.basePhysics, selectedStrength)
      else restaurarFisicaDoDado(body, options.basePhysics)
    }
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
   * APOIADO no piso da boca: `mouth.y` é a superfície, e o centro do corpo fica um raio acima dela. O
   * sorteio continua, mas agora é um saltinho a partir do apoio, não a partir do meio da pedra.
   */
  const y = layout.mouth.y + (options.radius ?? 0) + randomInRange([0, 0.08])

  body.setTranslation({ x, y, z }, true)

  const [qx, qy, qz, qw] = randomQuaternion()
  body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)

  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  /**
   * Pela torre, o Forte é uma flecha horizontal: a gravidade fica desligada somente no trecho da
   * boca até a parede oposta. Assim o dado não bate no chão antes da parede. No primeiro retorno,
   * `DiceCanvasMulti` chama `restaurarFisicaDoDado`, religa a gravidade e ele cai na bandeja.
   */
  body.setGravityScale(ricochet ? 0 : 1, true)
  body.enableCcd(ricochet)

  // Mesma conta do arremesso normal: velocidade horizontal derivada da distância REAL até o slot, e
  // não um impulso fixo. Entre o slot mais próximo e o mais distante há vários unidades de diferença,
  // e um valor único deixaria metade dos dados curta e a outra metade batendo na parede oposta.
  const towardTarget = Math.atan2(target.z - z, target.x - x)
  /**
   * No Forte, o primeiro alvo é a PAREDE oposta: a direção da boca continua reta depois do centro,
   * a restituição devolve o dado e a parede alta invisível garante que o espetáculo fica na bandeja.
   * Nos outros modos, cada dado continua mirando seu slot de repouso.
   */
  const launchAngle = ricochet ? Math.atan2(layout.mouthDirection.z, layout.mouthDirection.x) : towardTarget
  const angleSpread = ricochet ? STRONG_RICOCHET_ANGLE_SPREAD_RAD : MOUTH_ANGLE_SPREAD_RAD
  const angle = launchAngle + randomInRange([-angleSpread, angleSpread])
  const distance = Math.hypot(target.x - x, target.z - z)
  const flightDuration = randomInRange(MOUTH_FLIGHT_DURATION_RANGE)
  const strength = multiplicadoresDaForca(selectedStrength)
  const baseSpeed = Math.min(Math.max(distance / flightDuration, MOUTH_MIN_SPEED), MOUTH_MAX_SPEED)
  const speed = ricochet ? velocidadeMaximaDoRicochete(selectedStrength) : baseSpeed * strength.speed

  body.applyImpulse(
    {
      x: Math.cos(angle) * speed,
      /** Sem componente vertical: no Forte ele voa reto; nos outros modos cai normalmente. */
      y: 0,
      z: Math.sin(angle) * speed
    },
    true
  )

  const torque = randomInRange(SPAWN_CONFIG.torqueStrengthRange) * strength.torque
  body.applyTorqueImpulse(
    {
      x: randomInRange([-torque, torque]),
      y: randomInRange([-torque, torque]),
      z: randomInRange([-torque, torque])
    },
    true
  )

  return ricochet
    ? { x: Math.cos(angle), z: Math.sin(angle), speedCap: velocidadeMaximaDoRicochete(selectedStrength) }
    : null
}
