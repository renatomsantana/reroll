import * as THREE from 'three'
import { TOWER_CONFIG } from '../config/physicsConfig'
import { STONE_COLOR, STONE_ROUGHNESS } from './createTowerScene'

/**
 * Enfeites puramente cosméticos da torre (ameias, bandeira) — o usuário achou a torre original
 * "sem cara de castelo", depois REJEITOU uma primeira tentativa com 6 torreões separados ("não
 * quero torres de castelos") a favor da referência real trazida em `ideias/`: UMA torre só, com
 * padrão de tijolo (ver `createBrickTexture.ts`, aplicado na casca em `createTowerScene.ts`) e
 * ameias no topo — sem torreões satélite. Tudo aqui é geometria procedural do three.js, sem
 * textura externa nenhuma pros elementos 3D (mesma restrição já seguida pelo resto do projeto,
 * ver histórico do sistema de temas removido) — a textura de tijolo É procedural (canvas 2D
 * desenhado em código), não uma imagem externa, mesma distinção. NUNCA participa da física: fica
 * fora do raio de qualquer collider (`TOWER_CONFIG.shellApothem`/`baseFloorRadius`), então não
 * precisa de nenhum ajuste em `createTowerColliders.ts`.
 */

const FLAG_COLOR = 0xb03030
const POLE_COLOR = 0x3a3a3a

function stoneMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: STONE_COLOR, roughness: STONE_ROUGHNESS })
}

/**
 * Anel de ameias (merlons) alternando bloco/vão ao redor de um círculo — usado tanto no topo
 * da casca da torre quanto no topo da parede baixa da base. `count` sempre par, metade vira
 * bloco e metade vira vão, alternados.
 */
function createMerlonRing(radius: number, y: number, count: number, material: THREE.Material): THREE.Group {
  const group = new THREE.Group()
  // 0.6/0.35 → 1.1/0.65: torre ficou mais baixa/atarracada nesta rodada (`TOWER_CONFIG.turns`
  // reduzido) — ameias do mesmo tamanho de antes ficariam ainda mais "perdidas" numa torre menor;
  // aumentadas pra ler como uma coroa de merlons de verdade, pedido do usuário de mais cara de
  // castelo medieval (silhueta quebrada no topo, não uma borda fina).
  const merlonHeight = 1.1
  const merlonDepth = 0.65
  const circumference = 2 * Math.PI * radius
  const slot = circumference / count
  const merlonWidth = slot * 0.55

  for (let i = 0; i < count; i += 2) {
    const angle = (i / count) * Math.PI * 2
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(merlonWidth, merlonHeight, merlonDepth), material)
    merlon.position.set(Math.cos(angle) * radius, y + merlonHeight / 2, Math.sin(angle) * radius)
    merlon.lookAt(0, merlon.position.y, 0)
    merlon.castShadow = true
    group.add(merlon)
  }

  return group
}

/** Mastro + bandeirola triangular no topo — o toque final que faz a silhueta ler como castelo de longe. */
function createFlag(x: number, z: number, baseY: number): THREE.Group {
  const group = new THREE.Group()
  const poleHeight = 1.6

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, poleHeight, 8),
    new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.6 })
  )
  pole.position.set(x, baseY + poleHeight / 2, z)
  group.add(pole)

  const flagShape = new THREE.Shape()
  flagShape.moveTo(0, 0)
  flagShape.lineTo(0.7, -0.18)
  flagShape.lineTo(0, -0.36)
  flagShape.closePath()
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(flagShape),
    new THREE.MeshStandardMaterial({ color: FLAG_COLOR, roughness: 0.6, side: THREE.DoubleSide })
  )
  flag.position.set(x, baseY + poleHeight - 0.1, z)
  group.add(flag)

  return group
}

/**
 * Monta todos os enfeites da torre — chamado uma vez por `createTowerScene`, com o `topY` real
 * da rampa (varia com `TOWER_CONFIG.slopeDeg`/`turns`) pra ameias/bandeira sempre ficarem no
 * lugar certo mesmo se a geometria da rampa mudar de altura no futuro.
 */
export function createTowerDecor(topY: number): THREE.Object3D {
  const group = new THREE.Group()
  const { shellApothem, shellTopMargin } = TOWER_CONFIG
  const shellTopY = topY + shellTopMargin
  const material = stoneMaterial()

  // Ameias da base removidas junto com a parede baixa da base (`createTowerScene.ts`) — sem
  // parede pra "coroar", um anel de merlons flutuando no ar não fazia mais sentido nenhum.
  group.add(createMerlonRing(shellApothem, shellTopY, 20, material))
  group.add(createFlag(0, 0, shellTopY))

  return group
}
