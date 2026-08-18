import * as THREE from 'three'
import { TOWER_CONFIG } from '../config/physicsConfig'

/**
 * Geometria do mecanismo de "dice tower" de verdade — prateleiras (baffles) inclinadas, cada uma
 * presa numa parede e girada em relação à anterior (`baffleRotationalOffsetDeg`, alternando
 * sentido), criando um caminho em zig-zag espiralado ao redor do eixo da torre: o dado cai, bate
 * numa prateleira, é redirecionado pra borda aberta (do lado oposto de onde está presa) e cai na
 * próxima, presa numa parede girada. Segue `dice_tower_parametric_prompt.md` (spec CAD trazida
 * pelo usuário) — substituiu tanto a rampa em espiral contínua do design original quanto a
 * primeira versão de baffles desta sessão (só 2 lados fixos, sem giro).
 *
 * Cada prateleira é construída/consumida como um retângulo simples (posição + quaternion +
 * dimensões) — o MESMO transform alimenta tanto o mesh visual (`createTowerScene.ts`) quanto o
 * collider físico (`createTowerColliders.ts`), pra garantir que nunca desalinham.
 */
export interface BaffleTransform {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  /** Comprimento (ao longo da inclinação, da parede presa até a borda aberta). */
  length: number
  /** Largura (perpendicular à inclinação, horizontal). */
  width: number
  thickness: number
  /**
   * Vetor unitário "morro abaixo" desta prateleira (da parede presa rumo à borda aberta) — usado
   * por `applyTowerStuckNudge.ts` pra empurrar um dado travado NA DIREÇÃO CERTA daquela
   * prateleira específica, em vez de um empurrão genérico (ver `findNearestBaffleDirection`
   * abaixo).
   */
  direction: THREE.Vector3
  /** Altura (Y) do ponto de FIXAÇÃO (parede) desta prateleira — topo do intervalo vertical dela. */
  topY: number
  /** Altura (Y) da BORDA ABERTA desta prateleira — base do intervalo vertical dela. */
  bottomY: number
}

/**
 * Ângulo (radianos, mesma convenção `(cos(theta)·R, y, sin(theta)·R)` usada pelo resto da torre)
 * onde a prateleira `i` (0 = mais alta) fica PRESA na parede. A prateleira 0 fixa em 0°; cada
 * próxima gira `180° + baffleRotationalOffsetDeg` em relação à anterior, alternando o SINAL do
 * deslocamento extra (+/-) a cada uma — é esse sinal alternado (não só o giro em si) que produz
 * o caminho não repetitivo pedido pelo spec ("prevent geometrically biased outcomes"): sem
 * alternar o sinal, o giro extra se acumularia sempre na mesma direção e o padrão voltaria a ser
 * previsível depois de `360/offset` prateleiras.
 */
function computeAttachAngle(index: number): number {
  const offsetRad = (TOWER_CONFIG.baffleRotationalOffsetDeg * Math.PI) / 180
  let angle = 0
  for (let i = 1; i <= index; i++) {
    const sign = i % 2 === 1 ? 1 : -1
    angle += Math.PI + offsetRad * sign
  }
  return angle
}

/**
 * Altura (Y) onde o dado nasce — acima da primeira (mais alta) prateleira, com
 * `TOWER_CONFIG.topClearance` de queda livre antes do primeiro impacto (`entry_drop_height` no
 * spec). Determinístico a partir de `TOWER_CONFIG`, calculado uma vez como constante de módulo
 * (`TOWER_TOP_Y`).
 */
export function computeTowerTopY(): number {
  const { exitY, bottomClearance, baffleCount, baffleVerticalSpacing, topClearance } = TOWER_CONFIG
  const highestAttachY = exitY + bottomClearance + baffleCount * baffleVerticalSpacing
  return highestAttachY + topClearance
}

export const TOWER_TOP_Y = computeTowerTopY()

/**
 * Ângulo (radianos) na direção em que o dado naturalmente sai da ÚLTIMA prateleira — usado por
 * `buildTowerShellGeometry.ts` (recorte do portão) e `createExitLandingPlatform` (posição da
 * "mini área de aterrissagem"). A última prateleira empurra o dado PRA FORA da parede onde ela
 * está presa (ver `computeBaffleTransforms`) — ou seja, na direção OPOSTA ao próprio ângulo de
 * fixação dela.
 */
export function computeTowerExitAngle(): number {
  const lastIndex = TOWER_CONFIG.baffleCount - 1
  return computeAttachAngle(lastIndex) + Math.PI
}

/**
 * Constrói os transforms (posição + rotação + dimensões) de todas as prateleiras, da mais alta
 * (primeira atingida) até a mais baixa (última antes da saída).
 *
 * Cada prateleira é modelada por um vetor DIREÇÃO unitário (da parede presa, apontando pra dentro
 * da torre e pra baixo) — usar `THREE.Quaternion.setFromUnitVectors` pra alinhar o eixo +X local
 * do retângulo a essa direção, em vez de compor rotações por eixo/sinal na mão, é a mesma técnica
 * já usada em `createRingWall.ts`/`createGateStructure` (`createTowerScene.ts`) depois de bugs
 * reais de sinal nesta sessão com trigonometria manual.
 */
export function computeBaffleTransforms(): BaffleTransform[] {
  const {
    shellApothem,
    baffleCount,
    baffleSlopeDeg,
    finalBaffleSlopeDeg,
    baffleSpanFraction,
    baffleWidthFraction,
    exitY,
    bottomClearance,
    baffleVerticalSpacing
  } = TOWER_CONFIG

  const span = 2 * shellApothem * baffleSpanFraction
  const width = 2 * shellApothem * baffleWidthFraction
  const localLengthAxis = new THREE.Vector3(1, 0, 0)
  const transforms: BaffleTransform[] = []

  for (let i = 0; i < baffleCount; i++) {
    // i=0 é a prateleira MAIS ALTA (primeira atingida); attachY decresce conforme i cresce.
    // `(baffleCount - i)` (não `baffleCount - 1 - i`) — a última prateleira (i = baffleCount-1)
    // precisa ter sua borda aberta ACIMA de `exitY` por `bottomClearance`, não seu ponto de
    // FIXAÇÃO (ver histórico: um bug real de "off-by-one" aqui derrubava a borda aberta da
    // última prateleira pra ABAIXO do chão).
    const attachY = exitY + bottomClearance + (baffleCount - i) * baffleVerticalSpacing

    const isLast = i === baffleCount - 1
    const slopeRad = ((isLast ? finalBaffleSlopeDeg : baffleSlopeDeg) * Math.PI) / 180
    const attachAngle = computeAttachAngle(i)

    // Direção horizontal "pra dentro" a partir do ponto de fixação (aponta do ponto na parede
    // rumo ao eixo central da torre) — o oposto do vetor radial nesse ângulo.
    const inwardHorizontal = new THREE.Vector3(-Math.cos(attachAngle), 0, -Math.sin(attachAngle))
    const direction = new THREE.Vector3(
      inwardHorizontal.x * Math.cos(slopeRad),
      -Math.sin(slopeRad),
      inwardHorizontal.z * Math.cos(slopeRad)
    )

    const attachPoint = new THREE.Vector3(Math.cos(attachAngle) * shellApothem, attachY, Math.sin(attachAngle) * shellApothem)
    const position = attachPoint.clone().addScaledVector(direction, span / 2)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(localLengthAxis, direction)
    const bottomY = attachY + direction.y * span

    transforms.push({
      position,
      quaternion,
      length: span,
      width,
      thickness: TOWER_CONFIG.baffleThickness,
      direction,
      topY: attachY,
      bottomY
    })
  }

  return transforms
}

/**
 * Direção "morro abaixo" da prateleira mais próxima da altura `y` — usado por
 * `applyTowerStuckNudge.ts` pra empurrar um dado travado NA DIREÇÃO CERTA daquela prateleira
 * específica.
 *
 * BUG REAL medido nesta sessão: um empurrão genérico (radial-pra-fora do eixo central da torre,
 * sem saber em qual prateleira o dado está) tirava D20/D100 do lugar, mas raramente na direção
 * que de fato ajudava — o dado voltava a assentar perto de onde estava, ciclo após ciclo (medido:
 * ~30+ segundos simulados até escapar, bem devagar demais pra um jogo). Empurrar na direção REAL
 * da prateleira (calculada geometricamente, nunca "no olho") resolve isso na raiz.
 */
export function findNearestBaffleDirection(y: number): THREE.Vector3 {
  const baffles = computeBaffleTransforms()
  let closest = baffles[0]
  let closestDist = Infinity
  for (const baffle of baffles) {
    const withinRange = y <= baffle.topY && y >= baffle.bottomY
    const dist = withinRange ? 0 : Math.min(Math.abs(y - baffle.topY), Math.abs(y - baffle.bottomY))
    if (dist < closestDist) {
      closestDist = dist
      closest = baffle
    }
  }
  return closest.direction
}
