import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { TRAY_CONFIG, TOWER_CONFIG } from '../config/physicsConfig'
import { isInsideRegularPolygon } from './regularPolygon'
import { D100_DEFINITION } from '../dice-defs/d100Sphere'

/**
 * Atrito/restituição usados SÓ enquanto o D100 está dentro da torre (ver `dropDieIntoTower.ts`) —
 * bem mais próximos do padrão dos outros dados (`DICE_DEFAULT_PHYSICS`) que o tuning original do
 * D100 (`D100_DEFINITION.physics`, atrito máximo/restituição baixa, pensado pra "grudar" na
 * bandeja aberta). MEDIDO: com o tuning original, o D100 fica preso por MINUTOS simulados no
 * mecanismo de prateleiras (atrito máximo engole o empurrão de recuperação quase inteiro a cada
 * frame) — restaurado ao valor original (`D100_DEFINITION.physics`, nunca duplicado aqui) assim
 * que o dado sai da torre (`exitTowerIfDescended` abaixo), pra continuar "grudando" na bandeja
 * de pouso como sempre, sem rolar pra sempre por ali.
 */
export const TOWER_D100_PHYSICS_OVERRIDE = {
  friction: 0.5,
  restitution: 0.3
}

/**
 * Grupos de colisão do Rapier (16 bits de "pertence a" + 16 bits de "colide com", ver
 * `InteractionGroups`). Usados só pra uma coisa: deixar um dado recém-arremessado do LADO DE
 * FORA da bandeja (ver `tossDie.ts`) atravessar o LUGAR da parede sem colidir com ela
 * enquanto ainda está entrando, evitando precisar de um arco físico alto o bastante pra
 * "pular por cima" da parede de verdade — essa altura extra de queda (~3.5+ unidades pra
 * limpar `TRAY_CONFIG.wallHeight`) se traduzia em impacto forte demais no chão/outros dados,
 * causando escapes por cima da parede na hora de POUSAR, não de entrar (ver histórico deste
 * arquivo/commit se quiser os números). Continua colidindo com o chão e com os outros dados
 * o tempo todo — só a parede é temporariamente ignorada, e só pelo próprio dado que está
 * entrando.
 */
const GROUP_DICE = 0b0001
const GROUP_WALL = 0b0010
const GROUP_FLOOR = 0b0100
/**
 * Prateleiras/parede da torre de dados (modo "torre", ver `TOWER_CONFIG`) — bit próprio, não
 * reusa `GROUP_WALL`: diferente da parede da bandeja aberta (que um dado "entrando" ignora
 * temporariamente, ver `DICE_ENTERING_GROUPS` abaixo), as prateleiras da torre precisam colidir
 * com o dado O TEMPO TODO enquanto ele está caindo — não existe um equivalente de "ainda
 * entrando" aqui, ignorá-las faria o dado atravessá-las direto.
 */
const GROUP_TOWER = 0b1000

function pack(membership: number, filter: number): number {
  return (membership << 16) | filter
}

export const WALL_COLLISION_GROUPS = pack(GROUP_WALL, GROUP_DICE)
export const FLOOR_COLLISION_GROUPS = pack(GROUP_FLOOR, GROUP_DICE)
export const TOWER_COLLISION_GROUPS = pack(GROUP_TOWER, GROUP_DICE)

const DICE_NORMAL_GROUPS = pack(GROUP_DICE, GROUP_DICE | GROUP_WALL | GROUP_FLOOR)
const DICE_ENTERING_GROUPS = pack(GROUP_DICE, GROUP_DICE | GROUP_FLOOR)
/** Dado "caindo dentro da torre" (modo torre) — colide com outros dados e com as prateleiras/parede da torre, nunca com a parede/chão da bandeja aberta (que nem existe nesse modo, ver `createTowerScene.ts`). */
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
 * Dado "na fila" da torre (ainda não é a vez dele cair, ver `TOWER_CONFIG.maxConcurrentInTower`
 * / fila em `DiceCanvasMulti.tsx`) — não colide com NADA (filtro vazio), só pra não correr o
 * risco de vários corpos nascendo sobrepostos na origem se sobreporem de verdade (o solver do
 * Rapier resolve sobreposição profunda com um impulso de separação que pode ser bem mais
 * violento que qualquer física de jogo normal, já visto antes neste projeto — ver comentário de
 * `launchRadiusJitter` em `physicsConfig.ts`). O mesh desse dado também fica invisível
 * (`mesh.visible = false`) enquanto estiver nesse grupo — a posição exata não importa, ele nunca
 * deveria aparecer na tela até ser ativado.
 */
export function parkedCollisionGroups(): number {
  return pack(GROUP_DICE, 0)
}

/** Ver comentário do "empurrão de entrada" dentro de `restoreWallCollisionIfInside`. */
const ENTRY_ASSIST_SPEED_THRESHOLD = 3.5
const ENTRY_ASSIST_SPEED = 4.5

/**
 * Tempo máximo (ms) que um dado "entrando" pode ficar sem colidir com a parede antes do
 * empurrão de retorno passar a agir MESMO com velocidade acima de `ENTRY_ASSIST_SPEED_THRESHOLD`
 * — ver comentário grande do empurrão abaixo. BUG REAL medido com física de verdade (10 d6
 * simultâneos, 15 rodadas): um dado rebatido por outro dado ainda entrando pode manter
 * velocidade horizontal alta por bastante tempo sem nunca cruzar de volta pra dentro do
 * hexágono — sem esse teto, chegou a ficar até 3283ms "fantasma" (sem parede nenhuma),
 * vagando até 6.6 unidades pra fora do hexágono (quase o apótema inteiro, 6.5). Valor
 * escolhido um pouco ACIMA do pior caso de uma entrada LEGÍTIMA sem interferência
 * (`launchOutsideDistance`±jitter / `minHorizontalSpeed` ≈ 875ms), pra não disparar cedo
 * demais numa entrada normal, só devagar.
 */
const ENTRY_FORCE_PUSH_TIMEOUT_MS = 900

/**
 * Margem de segurança (unidades de mundo) subtraída do apótema na checagem de "já entrou" —
 * BUG REAL encontrado rolando `d6.statistical.test.ts` repetidas vezes depois da bandeja virar
 * hexágono: o teste "está dentro" original usava o apótema puro como limite, mas o COLLIDER
 * físico da parede tem meia-espessura própria (`createRingWall`'s `halfThickness=0.15`) —
 * então um dado cujo CENTRO acabou de cruzar o apótema pode já estar fisicamente embutido
 * dentro do volume sólido da parede no exato instante em que a colisão é restaurada. Perto de
 * um LADO plano isso é só ~0.15 de sobreposição (pequena, resolvida sem drama). Perto de um
 * VÉRTICE do hexágono é bem pior: dois painéis adjacentes se encontram ali, e o próprio limite
 * geométrico "dentro do polígono" (baseado no apótema) chega a ficar praticamente na MESMA
 * distância radial onde o volume físico da parede começa (verificado numericamente: apótema
 * 6.5 → limite de "dentro" no vértice ≈ 7.505, enquanto a parede ocupa daí pra fora a partir de
 * ~7.33) — ou seja, sem margem, a transição podia acontecer com o dado JÁ tocando a parede.
 * Reproduzido ao vivo: dado lançado rumo ao centro, colisão restaurada bem perto de um vértice,
 * solver resolve a sobreposição com um impulso violento (inversão quase total da velocidade,
 * ver histórico de `_debugD6`/investigação desta sessão) que arremessa o dado pra fora da
 * bandeja — o mesmo padrão de "sobreposição profunda → impulso de separação violento" que este
 * projeto já documentou antes (spawn jitter, ver `launchRadiusJitter`). Corrigido encolhendo o
 * polígono usado no teste por essa margem, garantindo que a transição sempre aconteça bem ANTES
 * do dado alcançar o volume físico da parede, em qualquer direção (lado ou vértice).
 */
const WALL_ENTRY_SAFETY_MARGIN = 0.5

/**
 * Chamado todo frame por dado (ver `DiceCanvasMulti.tsx`/testes de física): assim que a
 * posição horizontal do dado volta pra dentro da bandeja, restaura a colisão normal com a
 * parede. Idempotente e barato — só mexe no collider quando ele ainda está na fase "entrando"
 * E já cruzou pra dentro, então é seguro chamar em todo dado, todo frame, sem checar nada
 * fora daqui.
 *
 * `enteringElapsedMs` (opcional, default 0): quanto tempo simulado o dado já passou nesta fase
 * "entrando" sem cruzar pra dentro — quem chama é responsável por acumular e resetar isso (ver
 * `DiceCanvasMulti.tsx`/`diceEscape.test.ts`). Usado só pra decidir quando o empurrão de
 * retorno abaixo passa a agir mesmo com velocidade alta (ver `ENTRY_FORCE_PUSH_TIMEOUT_MS`).
 */
export function restoreWallCollisionIfInside(body: RAPIER.RigidBody, enteringElapsedMs = 0): void {
  if (body.numColliders() === 0) return
  const collider = body.collider(0)
  if (collider.collisionGroups() !== DICE_ENTERING_GROUPS) return

  const t = body.translation()
  const withinTray = isInsideRegularPolygon(
    t.x,
    t.z,
    TRAY_CONFIG.apothem - WALL_ENTRY_SAFETY_MARGIN,
    TRAY_CONFIG.wallSegments
  )
  if (withinTray) {
    collider.setCollisionGroups(DICE_NORMAL_GROUPS)
    return
  }

  /**
   * Empurrão de entrada: um dado "entrando" que perde o embalo ANTES de cruzar pra dentro da
   * bandeja (ex.: bateu noutro dado no meio do caminho) nunca dispararia o `withinTray` acima
   * — ficaria parado pra sempre do lado de fora, visível fora da bandeja, já que ele ignora a
   * parede enquanto estiver nesse estado. Define a velocidade horizontal (não SOMA um
   * impulso — nunca acelera sem limite mesmo chamado todo frame) rumo ao centro quando o dado
   * já está devagar OU quando já passou tempo demais tentando entrar (`enteringElapsedMs` >
   * `ENTRY_FORCE_PUSH_TIMEOUT_MS`) — essa segunda condição existe porque um dado rebatido por
   * outro dado vizinho ainda entrando pode manter velocidade alta por vários segundos sem
   * nunca cruzar pra dentro, ficando "fantasma" (sem colisão com a parede) visível por tempo
   * demais (medido: até 3283ms/6.6 unidades pra fora sem esse teto). (Uma versão mais fraca,
   * baseada em impulso pequeno somado em vez de substituir a velocidade, não vencia o
   * atrito/colisões com dados vizinhos.)
   */
  const v = body.linvel()
  const horizontalSpeed = Math.hypot(v.x, v.z)
  if (horizontalSpeed < ENTRY_ASSIST_SPEED_THRESHOLD || enteringElapsedMs > ENTRY_FORCE_PUSH_TIMEOUT_MS) {
    const towardCenterAngle = Math.atan2(-t.z, -t.x)
    body.setLinvel(
      {
        x: Math.cos(towardCenterAngle) * ENTRY_ASSIST_SPEED,
        y: v.y,
        z: Math.sin(towardCenterAngle) * ENTRY_ASSIST_SPEED
      },
      true
    )
  }
}

/**
 * Equivalente de `restoreWallCollisionIfInside` pro modo torre: assim que o dado desce abaixo da
 * altura de saída (`TOWER_CONFIG.exitY`), ele já "saiu" — troca pro grupo normal (colide com
 * dado/parede/chão). Não existe uma fase intermediária "entrando" aqui como na bandeja aberta: a
 * cena da torre não tem parede retangular nenhuma pra ignorar temporariamente
 * (`createTowerScene.ts`), então ir direto pro grupo normal já é seguro — o único collider que
 * passa a valer de novo é o chão circular da base, que o dado sempre deveria colidir mesmo.
 *
 * NÃO mexe na velocidade aqui — o dado chega já se movendo com a velocidade real que construiu
 * caindo entre as prateleiras (ver `dropDieIntoTower.ts`/`buildTowerBaffles.ts`), sem nenhum
 * reforço/redirecionamento artificial na saída.
 */
export function exitTowerIfDescended(body: RAPIER.RigidBody, sides?: PhysicalDiceSides): void {
  if (body.numColliders() === 0) return
  const collider = body.collider(0)
  if (collider.collisionGroups() !== DICE_DESCENDING_GROUPS) return

  if (body.translation().y <= TOWER_CONFIG.exitY) {
    collider.setCollisionGroups(DICE_NORMAL_GROUPS)
    // Desliga o soft-CCD ligado em `dropDieIntoTower.ts` (0 = desligado, ver doc de
    // `setSoftCcdPrediction`) — só precisa dele enquanto o dado está dentro da torre.
    body.setSoftCcdPrediction(0)
    // Restaura o atrito/restituição originais do D100 (ver `TOWER_D100_PHYSICS_OVERRIDE` acima) —
    // só valem ENQUANTO dentro da torre; de volta na bandeja de pouso, o D100 precisa continuar
    // "grudando" como sempre.
    if (sides === 100) {
      collider.setFriction(D100_DEFINITION.physics.friction)
      collider.setRestitution(D100_DEFINITION.physics.restitution)
    }
  }
}

