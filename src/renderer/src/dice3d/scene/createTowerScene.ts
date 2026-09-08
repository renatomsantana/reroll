import * as THREE from 'three'
import { TOWER_CONFIG, TRAY_CONFIG, EXIT_PLATFORM_CONFIG } from '../config/physicsConfig'
import { regularPolygonCircumradius } from '../physics/regularPolygon'
import { computeBaffleTransforms, computeTowerExitAngle, TOWER_TOP_Y } from '../geometry/buildTowerBaffles'
import { buildTowerShellGeometry } from '../geometry/buildTowerShellGeometry'
import {
  DEFAULT_WALL_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_FLOOR_COLOR,
  createHexShape,
  createGroundPlane
} from './createScene'
import { createTowerDecor } from './createTowerDecor'
import { applySceneBackground } from './applySceneBackground'
import { createBrickTexture } from './createBrickTexture'
import { createStonePavingTexture } from './createStonePavingTexture'

/**
 * A casca da torre é OPACA ("você não vê dentro da torre, apenas por cima"). Sem tampo nem fundo: dá
 * pra ver as prateleiras de cima, olhando pela abertura, só não através da parede lateral.
 */
const SHELL_OPACITY = 1
const FLOOR_ROUGHNESS = 0.9
/**
 * Argamassa quase preta, escurecida em várias rodadas ("mais contraste, parecer uma torre da idade
 * média"). Junto com a pedra escura e a variação de tom por tijolo, ela lê como fenda funda sob luz
 * direta em vez de uma linha de cor.
 */
export const MORTAR_COLOR = 0x100f0d
/**
 * Pedra do castelo, cor FIXA e não customizável junto de parede, chão e fundo: é a estrutura da
 * torre, não a bandeja. Exportada pra `createTowerDecor.ts` usar a mesma cor e rugosidade sem
 * duplicar o número. Era um cinza médio neutro e lia como concreto moderno; a referência real é
 * cinza-chumbo quase preto, que junto com a argamassa acima dá o contraste que faltava.
 */
export const STONE_COLOR = 0x3a382f
export const STONE_ROUGHNESS = 0.95

export interface TowerSceneHandle {
  scene: THREE.Scene
  /** Altura (Y) do topo da torre — onde o dado nasce (ver `dropDieIntoTower.ts`). */
  topY: number
  /** Altura (Y) considerada "já saiu da torre". */
  exitY: number
  /** Atualiza cor da parede/fundo/chão da bandeja circular da base (e imagem de fundo) SEM recriar a cena — mesmo mecanismo de `TraySceneHandle.updateColors`. A torre em si (pedra) não muda de cor. */
  updateColors: (
    wallColor: number,
    backgroundColor: number,
    floorColor: number,
    backgroundImage: string | null
  ) => void
}

/**
 * Praça hexagonal da base: era um círculo com parede baixa ao redor, e ele pediu pra tirar a parede e
 * deixar a base hexagonal também, como o chão da bandeja aberta. `baseFloorRadius` vira o apótema do
 * hexágono (mesmo papel de `TRAY_CONFIG.apothem`) e `wallSegments` garante o mesmo hexágono de
 * verdade, não uma aproximação.
 */
function createBaseFloor(floorColor: number): THREE.Mesh {
  const circumradius = regularPolygonCircumradius(TOWER_CONFIG.baseFloorRadius, TRAY_CONFIG.wallSegments)
  const geometry = new THREE.ShapeGeometry(createHexShape(circumradius, TRAY_CONFIG.wallSegments))
  geometry.rotateX(-Math.PI / 2)
  // "Relevos de tijolos na terra": chão liso de cor sólida não lia como praça de pedra de castelo.
  // `floorColor` continua tingindo o resultado por multiplicação, como o veludo da bandeja, em vez de
  // travar numa cor fixa.
  const { map, normalMap } = createStonePavingTexture(STONE_COLOR, MORTAR_COLOR)
  const floor = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: floorColor,
      map,
      normalMap,
      normalScale: new THREE.Vector2(1, 1),
      roughness: FLOOR_ROUGHNESS
    })
  )
  floor.receiveShadow = true
  return floor
}

/**
 * Casca opaca, sem tampo nem fundo (ver `SHELL_OPACITY`), com geometria própria
 * (`buildTowerShellGeometry`, e não `CylinderGeometry`) por causa do recorte de verdade do portão. O
 * `normalMap` existe pra a argamassa ler como recuada sob luz, e não como variação de cor plana.
 */
function createTowerShellMesh(topY: number): THREE.Mesh {
  const { shellApothem, shellTopMargin, gateArcWidth, gateHeight } = TOWER_CONFIG
  const height = topY + shellTopMargin
  const circumference = 2 * Math.PI * shellApothem
  const { map, normalMap } = createBrickTexture(STONE_COLOR, MORTAR_COLOR, circumference, height)
  const mesh = new THREE.Mesh(
    buildTowerShellGeometry({
      radius: shellApothem,
      height,
      gateAngleRad: computeTowerExitAngle(),
      gateArcWidth,
      gateHeight,
      radialSegments: 48
    }),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      normalMap,
      normalScale: new THREE.Vector2(1, 1),
      roughness: STONE_ROUGHNESS,
      transparent: SHELL_OPACITY < 1,
      opacity: SHELL_OPACITY,
      side: THREE.DoubleSide
    })
  )
  mesh.receiveShadow = true
  return mesh
}

/**
 * Plataforma de pouso fora do portão. O CENTRO do disco fica em `shellApothem + platformRadius`, e
 * não em `shellApothem`, pra a borda mais próxima encostar exatamente na parede sem sobrepor. É uma
 * plataforma de verdade — um cilindro baixo com collider do MESMO tamanho, os dois lendo de
 * `EXIT_PLATFORM_CONFIG` — pra o dado ficar apoiado no topo do degrau, não afundado nele.
 *
 * Cilindro, e não retângulo orientado: sólido de revolução não tem frente pra girar errado. Cor de
 * pedra, e não a de piso customizável, pra ler como soleira saindo da torre.
 */
function createExitLandingPlatform(): THREE.Mesh {
  const angle = computeTowerExitAngle()
  const { radius: platformRadius, height: platformHeight } = EXIT_PLATFORM_CONFIG
  const centerDistance = TOWER_CONFIG.shellApothem + platformRadius
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(platformRadius, platformRadius, platformHeight, 32),
    new THREE.MeshStandardMaterial({ color: STONE_COLOR, roughness: STONE_ROUGHNESS })
  )
  mesh.position.set(Math.cos(angle) * centerDistance, platformHeight / 2, Math.sin(angle) * centerDistance)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const DOOR_WOOD_COLOR = 0x4a3520
const DOOR_STUD_COLOR = 0x2a2a2a

/**
 * Moldura de pedra (dois pilares e a verga) em volta do recorte do portão, mais uma folha de madeira
 * ABERTA encostada na parede ao lado: o recorte sozinho lia como um buraco, sem nada reconhecível
 * como porta. A rotação de cada peça sai de `Quaternion.setFromUnitVectors`, nunca de trigonometria
 * de sinal na mão — já houve bug real de desalinhamento por causa disso.
 */
function createGateStructure(): THREE.Group {
  const { shellApothem, gateArcWidth, gateHeight } = TOWER_CONFIG
  const angle = computeTowerExitAngle()
  const halfAngle = gateArcWidth / 2 / shellApothem
  const radialAt = (a: number) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
  const tangentAt = (a: number) => new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))

  const group = new THREE.Group()
  const stoneMat = new THREE.MeshStandardMaterial({ color: STONE_COLOR, roughness: STONE_ROUGHNESS })

  const pillarWidth = 0.4
  const pillarDepth = 0.55
  const pillarHeight = gateHeight + 0.4

  for (const side of [-1, 1] as const) {
    const pillarAngle = angle + side * halfAngle
    const radialDir = radialAt(pillarAngle)
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarWidth, pillarHeight, pillarDepth), stoneMat)
    pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), radialDir)
    pillar.position.copy(radialDir).multiplyScalar(shellApothem).setY(pillarHeight / 2)
    pillar.castShadow = true
    group.add(pillar)
  }

  const lintelWidth = gateArcWidth + pillarWidth * 2
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(lintelWidth, 0.5, pillarDepth), stoneMat)
  const lintelTangent = tangentAt(angle)
  lintel.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), lintelTangent)
  lintel.position.copy(radialAt(angle)).multiplyScalar(shellApothem).setY(pillarHeight + 0.25)
  lintel.castShadow = true
  group.add(lintel)

  // Folha de madeira ABERTA — encostada na parede ao lado do pilar (não cobrindo a abertura),
  // como um portão de castelo de verdade deixado aberto. Encostada no pilar do lado "-1".
  const doorWidth = gateArcWidth * 0.85
  const doorHeight = gateHeight - 0.15
  const doorGroup = new THREE.Group()
  const doorMat = new THREE.MeshStandardMaterial({ color: DOOR_WOOD_COLOR, roughness: 0.85 })
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.12), doorMat)
  doorLeaf.position.x = doorWidth / 2
  doorGroup.add(doorLeaf)

  const studMat = new THREE.MeshStandardMaterial({ color: DOOR_STUD_COLOR, roughness: 0.6, metalness: 0.3 })
  for (const fx of [0.25, 0.75]) {
    for (const fy of [0.25, 0.75]) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), studMat)
      stud.position.set(fx * doorWidth, (fy - 0.5) * doorHeight, 0.07)
      doorGroup.add(stud)
    }
  }

  /**
   * Dobradiça no pilar do lado "-1". Fechada, a folha vai do hinge em direção ao outro pilar,
   * atravessando a abertura; girada 180°, ela continua a curva da parede PRA FORA, encostada por
   * fora. A primeira tentativa usava ~100° escolhidos no olho, e a porta ficava atravessada no meio
   * do vão (confirmado numa captura); 180° é o único ângulo que garante geometricamente que a folha
   * nunca cruza a abertura, qualquer que seja a largura do portão.
   */
  const hingeAngle = angle - halfAngle
  const hingeRadial = radialAt(hingeAngle)
  doorGroup.position.copy(hingeRadial).multiplyScalar(shellApothem).setY(doorHeight / 2 + 0.05)
  const openDirection = tangentAt(hingeAngle).multiplyScalar(-1)
  doorGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), openDirection)
  doorGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true
  })
  group.add(doorGroup)

  return group
}

/**
 * Um `THREE.Mesh` por prateleira (baffle) — mesmo transform (posição/rotação/dimensões) usado
 * pelo collider físico em `createTowerColliders.ts` (`computeBaffleTransforms`, fonte única),
 * então visual e física nunca podem desalinhar.
 */
function createBaffleMeshes(): THREE.Mesh[] {
  const material = new THREE.MeshStandardMaterial({ color: STONE_COLOR, roughness: STONE_ROUGHNESS })
  return computeBaffleTransforms().map((baffle) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(baffle.length, baffle.thickness, baffle.width), material)
    mesh.position.copy(baffle.position)
    mesh.quaternion.copy(baffle.quaternion)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  })
}

function createLights(shadowFrustum: number): THREE.Light[] {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55)

  const directional = new THREE.DirectionalLight(0xfff4e0, 1.3)
  directional.position.set(10, 20, 10)
  directional.castShadow = true
  directional.shadow.mapSize.set(2048, 2048)
  directional.shadow.camera.left = -shadowFrustum
  directional.shadow.camera.right = shadowFrustum
  directional.shadow.camera.top = shadowFrustum
  directional.shadow.camera.bottom = -shadowFrustum
  directional.shadow.camera.near = 1
  directional.shadow.camera.far = 50

  return [ambient, directional]
}

/**
 * Cena da torre de dados, usada NO LUGAR da bandeja (`createTrayScene`) e não junto dela: os dois
 * modos são mutuamente exclusivos (quem escolhe é `DiceCanvasMulti.tsx`), então não existe conflito
 * de espaço entre a torre e a bandeja de lançamento aberto.
 */
export function createTowerScene(
  // A base da torre não tem parede própria; `wallColor` aqui pinta a MADEIRA da borda da mesa
  // (ver `createGroundPlane`), o mesmo que na bandeja aberta — os dois modos ficam apoiados na
  // mesma mesa e reagem igual à cor escolhida.
  wallColor: number = DEFAULT_WALL_COLOR,
  backgroundColor: number = DEFAULT_BACKGROUND_COLOR,
  floorColor: number = DEFAULT_FLOOR_COLOR,
  backgroundImage: string | null = null
): TowerSceneHandle {
  const scene = new THREE.Scene()
  applySceneBackground(scene, backgroundColor, backgroundImage)

  // Mesma mesa de grama da bandeja aberta (ver `createGroundPlane`) — os dois modos ficam
  // apoiados na mesma mesa, senão trocar de modo trocaria o cenário inteiro debaixo do jogador.
  const table = createGroundPlane(wallColor)
  scene.add(table.object)

  const floor = createBaseFloor(floorColor)
  scene.add(floor)
  const floorMaterial = floor.material as THREE.MeshStandardMaterial

  for (const baffleMesh of createBaffleMeshes()) scene.add(baffleMesh)
  scene.add(createTowerShellMesh(TOWER_TOP_Y))
  scene.add(createTowerDecor(TOWER_TOP_Y))
  scene.add(createExitLandingPlatform())
  scene.add(createGateStructure())

  const shadowFrustum = Math.max(TOWER_CONFIG.baseFloorRadius, TOWER_CONFIG.shellApothem) + 2
  for (const light of createLights(shadowFrustum)) scene.add(light)

  return {
    scene,
    topY: TOWER_TOP_Y,
    exitY: TOWER_CONFIG.exitY,
    // `wallColor` não tem mesh pra colorir aqui: a base perdeu a parede própria e a casca é pedra de
    // cor fixa (ver `STONE_COLOR`). O parâmetro fica só pra bater com a assinatura de
    // `TraySceneHandle.updateColors`, que `DiceCanvasMulti.tsx` chama sem saber qual cena está ativa.
    updateColors(newWallColor, newBackgroundColor, newFloorColor, newBackgroundImage) {
      applySceneBackground(scene, newBackgroundColor, newBackgroundImage)
      floorMaterial.color.set(newFloorColor)
      table.updateEdgeColor(newWallColor)
    }
  }
}
