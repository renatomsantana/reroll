import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { TRAY_CONFIG, TOWER_CONFIG, WORLD_CONFIG } from '../config/physicsConfig'
import { trayApothem, trayRotation } from '../geometry/trayShape'
import { isInsideRegularPolygon } from './regularPolygon'
import { D100_DEFINITION } from '../dice-defs/d100Sphere'

/**
 * Atrito e restituição só enquanto o d100 está dentro da torre (`dropDieIntoTower.ts`). O tuning dele
 * é feito pra grudar na bandeja aberta, e nas prateleiras deixava o dado preso por minutos simulados:
 * o atrito máximo engolia quase todo o empurrão de recuperação a cada frame. O original volta na
 * saída (`exitTowerIfDescended`).
 */
export const TOWER_D100_PHYSICS_OVERRIDE = {
  friction: 0.5,
  restitution: 0.3
}

/**
 * Grupos de colisão do Rapier (16 bits de "pertence a" + 16 de "colide com"). Servem pra uma coisa: o
 * dado recém-arremessado atravessa o LUGAR da parede enquanto está entrando, em vez de precisar de um
 * arco alto pra pular por cima dela — essa altura extra virava impacto forte demais no pouso, e daí
 * escapes. Ele segue colidindo com o chão e com quem já está na bandeja.
 */
const GROUP_DICE = 0b0001
const GROUP_WALL = 0b0010
const GROUP_FLOOR = 0b0100
/**
 * Prateleiras e parede da torre. Bit próprio, e não `GROUP_WALL`, porque elas precisam colidir com
 * o dado o tempo todo: não existe fase "ainda entrando" aqui, ignorá-las seria atravessá-las.
 */
const GROUP_TOWER = 0b1000
/**
 * Bit próprio do dado que ainda está entrando, pra dois dados entrando não colidirem entre si.
 *
 * Medido (15 dados de tipos misturados, 12 rolagens): deixando-os se atropelar, 18% dos da bandeja e
 * 24% dos da boca da torre eram desviados no voo e paravam FORA do hexágono, até 6.74 unidades além
 * da parede e até 2450ms lá fora, com 1837 empurrões de entrada em 44 dados. É o "ele sai mas tenta
 * voltar rapidamente pra bandeja" que ele viu. A causa é a largada: na torre todo dado nasce no mesmo
 * ponto, um a cada 140ms. Quem já está na bandeja continua sendo obstáculo legítimo.
 */
const GROUP_DICE_ENTERING = 0b10000

function pack(membership: number, filter: number): number {
  return (membership << 16) | filter
}

export const WALL_COLLISION_GROUPS = pack(GROUP_WALL, GROUP_DICE)
/**
 * O chão aceita as duas pertinências de dado: o que está entrando não é mais `GROUP_DICE` e sem
 * este bit atravessaria o chão em queda livre. A parede não ganha o mesmo, ignorá-la é o que
 * define a fase de entrada.
 */
export const FLOOR_COLLISION_GROUPS = pack(GROUP_FLOOR, GROUP_DICE | GROUP_DICE_ENTERING)
export const TOWER_COLLISION_GROUPS = pack(GROUP_TOWER, GROUP_DICE)

const DICE_NORMAL_GROUPS = pack(
  GROUP_DICE,
  GROUP_DICE | GROUP_WALL | GROUP_FLOOR | GROUP_DICE_ENTERING
)
const DICE_ENTERING_GROUPS = pack(GROUP_DICE_ENTERING, GROUP_DICE | GROUP_FLOOR)
/** Dado caindo dentro da torre: colide com dados e com a torre, nunca com a bandeja aberta (que nem existe nesse modo). */
const DICE_DESCENDING_GROUPS = pack(GROUP_DICE, GROUP_DICE | GROUP_TOWER | GROUP_FLOOR)

export function diceNormalCollisionGroups(): number {
  return DICE_NORMAL_GROUPS
}

export function diceEnteringCollisionGroups(): number {
  return DICE_ENTERING_GROUPS
}

export function diceDescendingCollisionGroups(): number {
  return DICE_DESCENDING_GROUPS
}

/**
 * Dado na fila da torre (`TOWER_CONFIG.maxConcurrentInTower`): não colide com nada, senão vários
 * corpos parados na origem se sobreporiam e o solver separaria com violência. O mesh dele também
 * fica invisível enquanto estiver aqui.
 */
export function parkedCollisionGroups(): number {
  return pack(GROUP_DICE, 0)
}

/** Ver o empurrão de entrada em `restoreWallCollisionIfInside`. */
const ENTRY_ASSIST_SPEED_THRESHOLD = 3.5
/** Velocidade radial pra dentro que o empurrão persegue: é teto, não valor imposto. */
const ENTRY_ASSIST_TARGET_SPEED = 4.5
/**
 * Aceleração (u/s²) do empurrão de entrada.
 *
 * Era um `setLinvel`, que trocava a velocidade horizontal de uma vez: mudava até 15.4 u/s num quadro,
 * quadro após quadro, e na tela lê como ímã. Como aceleração, o resgate muda no máximo
 * `ENTRY_ASSIST_ACCELERATION × dt` (0.75 u/s a 60fps) e o dado CURVA de volta mantendo o giro.
 *
 * O valor é medido contra o ATRITO: parado do lado de fora, o atrito (0.6 com gravidade 13) come
 * ~7.8 u/s² de qualquer empurrão horizontal. Com 14 sobravam ~6 e três dados em 1440 pararam fora,
 * com excursões de 10.6 unidades; com 45 sobram ~37, o dado volta em ~0.12s e nenhum ficou fora.
 */
const ENTRY_ASSIST_ACCELERATION = 45

/**
 * Quanto tempo um dado entrando pode ficar sem cruzar pra dentro antes de o empurrão agir mesmo com
 * velocidade acima do limiar. Sem esse teto, um dado rebatido por outro mantinha velocidade alta sem
 * nunca voltar: até 3283ms fantasma e 6.6 unidades fora do hexágono. Fica um pouco acima do pior caso
 * de uma entrada legítima (≈875ms).
 */
const ENTRY_FORCE_PUSH_TIMEOUT_MS = 900

/**
 * Margem tirada do apótema na checagem de "já entrou".
 *
 * O collider da parede tem meia-espessura própria, então um dado cujo centro acabou de cruzar o
 * apótema pode já estar embutido no volume sólido dela. Num LADO plano é ~0.15 de sobreposição; num
 * VÉRTICE é pior, porque o limite do polígono fica quase na mesma distância radial onde a parede
 * começa (apótema 6.5 → limite no vértice ≈ 7.505, parede a partir de ~7.33), e o solver desfaz a
 * sobreposição com um impulso que inverte a velocidade e joga o dado pra fora.
 */
const WALL_ENTRY_SAFETY_MARGIN = 0.5

/**
 * Chamado todo frame por dado: quando ele volta pra dentro da bandeja, restaura a colisão com a
 * parede. Idempotente e barato, e só age na fase "entrando".
 *
 * `enteringElapsedMs` é o tempo simulado nesta fase sem cruzar pra dentro; quem chama acumula e
 * reseta. Só decide quando o empurrão passa a agir mesmo com velocidade alta.
 */
export function restoreWallCollisionIfInside(
  body: RAPIER.RigidBody,
  enteringElapsedMs = 0,
  /** Lados da bandeja em cena: a forma é escolha do usuário (`trayShape.ts`). */
  sides = TRAY_CONFIG.wallSegments,
  /**
   * Tempo de física desde a última chamada. O empurrão é uma aceleração, e sem `dt` viraria um
   * valor por quadro, ou seja, resgate dependente da taxa de quadros da máquina.
   */
  dtMs = 1000 / WORLD_CONFIG.physicsStepsPerSecond
): void {
  if (body.numColliders() === 0) return
  const collider = body.collider(0)
  if (collider.collisionGroups() !== DICE_ENTERING_GROUPS) return

  const t = body.translation()
  const withinTray = isInsideRegularPolygon(
    t.x,
    t.z,
    trayApothem(sides) - WALL_ENTRY_SAFETY_MARGIN,
    sides,
    0,
    trayRotation(sides)
  )
  if (withinTray) {
    collider.setCollisionGroups(DICE_NORMAL_GROUPS)
    return
  }

  /**
   * Empurrão de entrada: o dado que perde o embalo antes de cruzar (bateu noutro no caminho) nunca
   * dispararia o `withinTray` acima, e ficaria parado do lado de fora ignorando a parede pra sempre.
   * Age quando ele está devagar, quando já passou tempo demais tentando, ou quando vai pra longe.
   */
  const v = body.linvel()
  const horizontalSpeed = Math.hypot(v.x, v.z)

  const distanceFromCenter = Math.hypot(t.x, t.z)
  if (distanceFromCenter < 1e-6) return
  const inwardX = -t.x / distanceFromCenter
  const inwardZ = -t.z / distanceFromCenter

  // Só a componente radial importa: quem já vai entrar nesse ritmo não precisa de correção, e
  // insistir seria acelerar sem limite um dado que entra sozinho.
  const inwardSpeed = v.x * inwardX + v.z * inwardZ
  if (inwardSpeed >= ENTRY_ASSIST_TARGET_SPEED) return

  /**
   * O terceiro motivo é o que encurta as excursões longas: dado entrando que se AFASTA nunca está
   * certo, por mais rápido que vá. Só com lentidão e tempo, um dado rebatido a 5 u/s passava quase
   * um segundo se afastando (medido, até 10.6 unidades). Lançamento normal nasce indo pra dentro.
   */
  const afastando = inwardSpeed < 0
  if (!afastando && horizontalSpeed >= ENTRY_ASSIST_SPEED_THRESHOLD && enteringElapsedMs <= ENTRY_FORCE_PUSH_TIMEOUT_MS) {
    return
  }

  const deltaV = Math.min(
    (ENTRY_ASSIST_ACCELERATION * dtMs) / 1000,
    ENTRY_ASSIST_TARGET_SPEED - inwardSpeed
  )
  // `massa × Δv`: o impulso que produz exatamente `deltaV` seja qual for o dado. A massa é a mesma
  // hoje, mas derivar dela mantém a aceleração igual se algum dado mudar.
  const impulse = body.mass() * deltaV
  body.applyImpulse({ x: inwardX * impulse, y: 0, z: inwardZ * impulse }, true)
}

/**
 * O equivalente pro modo torre: abaixo de `TOWER_CONFIG.exitY` o dado já saiu e vai pro grupo normal.
 * Não há fase intermediária porque a cena da torre não tem parede de bandeja pra ignorar. A velocidade
 * não é tocada: o dado chega com a que construiu caindo entre as prateleiras.
 */
export function exitTowerIfDescended(body: RAPIER.RigidBody, sides?: PhysicalDiceSides): void {
  if (body.numColliders() === 0) return
  const collider = body.collider(0)
  if (collider.collisionGroups() !== DICE_DESCENDING_GROUPS) return

  if (body.translation().y <= TOWER_CONFIG.exitY) {
    collider.setCollisionGroups(DICE_NORMAL_GROUPS)
    // Desliga o soft-CCD ligado em `dropDieIntoTower.ts`; só vale dentro da torre.
    body.setSoftCcdPrediction(0)
    // Devolve o atrito original do d100: fora da torre ele precisa grudar na bandeja como sempre.
    if (sides === 100) {
      collider.setFriction(D100_DEFINITION.physics.friction)
      collider.setRestitution(D100_DEFINITION.physics.restitution)
    }
  }
}
