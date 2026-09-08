import * as THREE from 'three'
import { TOWER_CONFIG } from '../config/physicsConfig'

/**
 * Geometria do mecanismo de dice tower: prateleiras inclinadas, cada uma presa numa parede e girada
 * em relação à anterior (`baffleRotationalOffsetDeg`, alternando sentido), criando um caminho em
 * zig-zag espiralado — o dado cai, bate numa prateleira, é redirecionado pra borda aberta do lado
 * oposto e cai na próxima. Cada prateleira é um retângulo (posição, quaternion e dimensões), e o
 * MESMO transform alimenta o mesh visual e o collider físico, pra nunca desalinharem.
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
   * Vetor unitário "morro abaixo" desta prateleira (da parede presa rumo à borda aberta), usado por
   * `applyTowerStuckNudge.ts` pra empurrar um dado travado na direção certa daquela prateleira, em
   * vez de um empurrão genérico (ver `findNearestBaffleDirection`).
   */
  direction: THREE.Vector3
  /** Altura (Y) do ponto de FIXAÇÃO (parede) desta prateleira — topo do intervalo vertical dela. */
  topY: number
  /** Altura (Y) da BORDA ABERTA desta prateleira — base do intervalo vertical dela. */
  bottomY: number
}

/**
 * Ângulo onde a prateleira `i` (0 = mais alta) fica presa na parede, na convenção
 * `(cos θ·R, y, sin θ·R)` do resto da torre. A 0 fica em 0°, e cada próxima gira
 * `180° + baffleRotationalOffsetDeg`, alternando o SINAL do deslocamento extra. É esse sinal
 * alternado, e não o giro em si, que produz o caminho não repetitivo: sem alternar, o giro extra se
 * acumularia sempre na mesma direção e o padrão voltaria a ser previsível.
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
 * Altura em que o dado nasce: acima da prateleira mais alta, com `topClearance` de queda livre antes
 * do primeiro impacto. Determinístico a partir de `TOWER_CONFIG`, calculado uma vez em `TOWER_TOP_Y`.
 */
export function computeTowerTopY(): number {
  const { exitY, bottomClearance, baffleCount, baffleVerticalSpacing, topClearance } = TOWER_CONFIG
  const highestAttachY = exitY + bottomClearance + baffleCount * baffleVerticalSpacing
  return highestAttachY + topClearance
}

export const TOWER_TOP_Y = computeTowerTopY()

/**
 * Ângulo na direção em que o dado sai da ÚLTIMA prateleira, usado pelo recorte do portão
 * (`buildTowerShellGeometry.ts`) e pela posição da plataforma de pouso. A última prateleira empurra o
 * dado PRA FORA da parede onde está presa, ou seja, na direção oposta ao ângulo de fixação dela.
 */
export function computeTowerExitAngle(): number {
  const lastIndex = TOWER_CONFIG.baffleCount - 1
  return computeAttachAngle(lastIndex) + Math.PI
}

/**
 * Constrói os transforms de todas as prateleiras, da mais alta (primeira atingida) à mais baixa.
 *
 * Cada prateleira é modelada por um vetor DIREÇÃO unitário (da parede presa, apontando pra dentro da
 * torre e pra baixo), e alinhar o eixo +X local do retângulo a ele com
 * `Quaternion.setFromUnitVectors` — em vez de compor rotações por eixo e sinal na mão — é a mesma
 * técnica de `createRingWall.ts`, adotada depois de bugs reais de sinal com trigonometria manual.
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
    // i=0 é a prateleira mais alta, então `attachY` decresce conforme i cresce. É `(baffleCount - i)`
    // e não `baffleCount - 1 - i`: a última precisa ter a BORDA ABERTA acima de `exitY` por
    // `bottomClearance`, não o ponto de FIXAÇÃO — um off-by-one aqui já derrubou a borda aberta dela
    // pra baixo do chão.
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
 * Direção "morro abaixo" da prateleira mais próxima da altura `y`, usada por `applyTowerStuckNudge`
 * pra empurrar um dado travado na direção certa. Medido: o empurrão genérico (radial pra fora do eixo
 * da torre, sem saber em qual prateleira o dado está) tirava d20 e d100 do lugar, mas raramente na
 * direção que ajudava, e o dado voltava a assentar perto de onde estava, ciclo após ciclo (~30
 * segundos simulados até escapar). Empurrar na direção real da prateleira resolve na raiz.
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
