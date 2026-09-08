import * as THREE from 'three'
import { TRAY_CONFIG } from '../config/physicsConfig'
import { trayApothem, trayRotation } from '../geometry/trayShape'
import { LIGHT_CONFIG } from '../config/sceneConfig'
import { regularPolygonCircumradius } from '../physics/regularPolygon'
import { createVelvetTextures } from './createVelvetNormalMap'
import { createGrassTextures, GRASS_TILE_WORLD_SIZE } from './createGrassTexture'
import { createWoodTextures, WOOD_TABLE_REPEAT, WOOD_WALL_REPEAT } from './createWoodTexture'
import { applySceneBackground } from './applySceneBackground'

/**
 * Cor de parede, fundo e chão quando nada é escolhido, exportadas pra quem monta a cena usar o
 * mesmo padrão no `updateColors`. A parede era verde escuro de quando ela era uma chapa de cor
 * lisa; virou marrom porque hoje a cor escolhida manda no tom de verdade (ver `woodTint`), e uma
 * bandeja verde de fábrica seria resto de configuração antiga vazando na tela.
 */
export const DEFAULT_WALL_COLOR = 0x6b4a2a
export const DEFAULT_BACKGROUND_COLOR = 0x000000
export const DEFAULT_FLOOR_COLOR = 0x243b6b

/**
 * Chão da bandeja com acabamento de VELUDO. `MeshPhysicalMaterial.sheen*` é a extensão do three feita
 * pra tecido: auréola suave nas bordas contra a luz, que o especular comum não reproduz, com
 * `sheenColor` mais claro simulando a fibra pegando luz.
 *
 * Só o `sheen` não bastou ("ainda não parece veludo"): ele é fresnel, quase invisível de cima. O
 * reforço são as duas texturas de `createVelvetTextures()`.
 */
const FLOOR_ROUGHNESS = 0.97
const FLOOR_SHEEN = 1
const FLOOR_SHEEN_ROUGHNESS = 0.35
const FLOOR_NORMAL_SCALE = 5

export interface TraySceneHandle {
  scene: THREE.Scene
  /**
   * Troca cor de parede, fundo e chão (e a imagem de fundo) sem recriar a cena, a cada mudança nas
   * Preferências. A imagem, quando existe, tem prioridade sobre a cor de fundo.
   */
  updateColors: (
    wallColor: number,
    backgroundColor: number,
    floorColor: number,
    backgroundImage: string | null
  ) => void
}

/**
 * Hexágono como `THREE.Shape`, e não `CylinderGeometry`, por causa do chão: extrudar essa forma dá
 * UV plana nas tampas, enquanto a tampa de um cilindro sai com UV polar. O normal map de veludo
 * precisa de UV plana pra ladrilhar como uma grade em vez de girar em espiral a partir do centro.
 */
export function createHexShape(radius: number, segments: number, rotation = 0): THREE.Shape {
  const shape = new THREE.Shape()
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2 + rotation
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  return shape
}

/**
 * Raio do tampo da mesa, ~2.1× o circunraio do hexágono. Era 40, um disco de cor sólida que cobria
 * quase o quadro e atrapalhava a imagem de fundo da aba Estilo; o tampo só precisa desfazer o efeito
 * de ilha flutuando.
 *
 * Exportado porque o limite de passeio da câmera WASD é este mesmo número (`TABLE_PAN_LIMIT` em
 * `DiceCanvasMulti.tsx`): copiado à mão, sairia de sincronia na primeira mudança do tampo.
 */
export const GROUND_RADIUS = 16

/** Espessura do tampo da mesa (a borda de madeira que aparece em volta da grama). */
const TABLE_EDGE_HEIGHT = 0.55
/** Repetições da textura de grama ao longo do diâmetro do tampo — ver `GRASS_TILE_WORLD_SIZE` (ladrilho grande justamente pra repetição não saltar aos olhos). */
const GRASS_REPEAT = (GROUND_RADIUS * 2) / GRASS_TILE_WORLD_SIZE

/**
 * A cor escolhida na aba Estilo vira TINTURA de madeira: é ela, e só ela, que manda no tom da
 * bandeja, da borda da mesa e do estojo; a textura entra por cima, quase branca, só desenhando veio
 * e juntas. Este é o piso de brilho (em linear) abaixo do qual a cor é clareada proporcionalmente —
 * uns 12% em sRGB, abaixo de qualquer preset, então só pega quem escolhe quase preto.
 */
const MIN_WOOD_LUMA = 0.012

export function woodTint(color: number): THREE.Color {
  const tinted = new THREE.Color(color)
  /**
   * Isto era `lerp(branco, 0.42)`, pra compensar um mapa de madeira castanho e escuro. Com o mapa
   * neutro, clarear só LAVA a escolha: misturar branco mexe nos três canais por igual e domina uma
   * cor escura. Medido no preset Couro — com 0.06 de branco a parede saía `#726c66`, um cinza; sem
   * mistura sai `#33261f`, marrom de verdade. O piso proporcional mantém o matiz.
   */
  const brightest = Math.max(tinted.r, tinted.g, tinted.b)
  if (brightest === 0) return tinted.setRGB(MIN_WOOD_LUMA, MIN_WOOD_LUMA, MIN_WOOD_LUMA)
  if (brightest < MIN_WOOD_LUMA) tinted.multiplyScalar(MIN_WOOD_LUMA / brightest)
  return tinted
}

export interface TrayPreviewHandle {
  object: THREE.Group
  updateColors: (wallColor: number, floorColor: number) => void
}

/**
 * A bandeja inteira (chão de veludo, caixa, aba e parede) num grupo só, pra servir de prévia na aba
 * Estilo. Monta com as MESMAS funções da cena de verdade, e não com uma imitação simplificada: uma
 * prévia que erra o material ou a proporção ensina errado. Sem mesa, grama, luz própria nem física
 * — quem monta decide enquadramento e iluminação (`TrayPreview.tsx`).
 */
export function createTrayPreview(
  wallColor: number,
  floorColor: number,
  /** Lados da bandeja: a forma é escolhida pelo usuário (ver `trayShape.ts`) e a prévia segue a cena. */
  sides = TRAY_CONFIG.wallSegments
): TrayPreviewHandle {
  const group = new THREE.Group()

  const floor = createFloor(floorColor, sides)
  group.add(floor)
  const floorMaterial = floor.material as THREE.MeshPhysicalMaterial

  const wood = createWoodTextures(WOOD_WALL_REPEAT)
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: woodTint(wallColor),
    map: wood.map,
    normalMap: wood.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.68,
    metalness: 0
  })
  group.add(createArenaPlatform(platformMaterial, sides))

  return {
    object: group,
    updateColors(newWallColor, newFloorColor) {
      platformMaterial.color.copy(woodTint(newWallColor))
      floorMaterial.color.set(newFloorColor)
      floorMaterial.sheenColor.set(newFloorColor).lerp(new THREE.Color(0xffffff), 0.4)
    }
  }
}

export interface TableHandle {
  object: THREE.Object3D
  /** Só a MADEIRA da borda acompanha a cor de parede escolhida; a grama é verde fixo (ver comentário). */
  updateEdgeColor: (edgeColor: number) => void
}

/**
 * A mesa onde a bandeja fica apoiada ("uma mesinha bonitinha de grama igual o tabletop rpg"), no
 * lugar do disco de cor sólida. A grama é verde FIXO: grama tingida de mostarda ou roxo (cores que
 * ele usa na bandeja) não é grama. A borda de madeira, sim, acompanha a cor de parede.
 */
export function createGroundPlane(edgeColor: number): TableHandle {
  const group = new THREE.Group()

  const grass = createGrassTextures(GRASS_REPEAT)
  const topGeometry = new THREE.CircleGeometry(GROUND_RADIUS, 64)
  topGeometry.rotateX(-Math.PI / 2)
  const top = new THREE.Mesh(
    topGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: grass.map,
      normalMap: grass.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 1,
      metalness: 0
    })
  )
  top.position.y = -0.03
  top.receiveShadow = true
  group.add(top)

  // Borda da mesa com o mesmo veio de madeira da bandeja (repetição maior, a circunferência é
  // bem maior) — mesa e bandeja lendo como o mesmo material é o que amarra os dois.
  const tableWood = createWoodTextures(WOOD_TABLE_REPEAT)
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: woodTint(edgeColor),
    map: tableWood.map,
    normalMap: tableWood.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.68,
    metalness: 0.02
  })
  const edge = new THREE.Mesh(
    new THREE.CylinderGeometry(GROUND_RADIUS, GROUND_RADIUS * 0.985, TABLE_EDGE_HEIGHT, 64, 1, true),
    edgeMaterial
  )
  edge.position.y = -0.03 - TABLE_EDGE_HEIGHT / 2
  group.add(edge)

  // Tampo de baixo: fecha o cilindro pra mesa não ficar oca vista de um ângulo rasante.
  const underGeometry = new THREE.CircleGeometry(GROUND_RADIUS * 0.985, 48)
  underGeometry.rotateX(Math.PI / 2)
  const under = new THREE.Mesh(underGeometry, edgeMaterial)
  under.position.y = -0.03 - TABLE_EDGE_HEIGHT
  group.add(under)

  return {
    object: group,
    updateEdgeColor: (color) => edgeMaterial.color.copy(woodTint(color))
  }
}

function createFloor(floorColor: number, wallSegments: number): THREE.Mesh {
  const circumradius = regularPolygonCircumradius(trayApothem(wallSegments), wallSegments)

  /**
   * `ShapeGeometry` (chapa plana) e não `ExtrudeGeometry`: com a extrusão o chão parecia um tronco,
   * um bloco hexagonal baixo com a lateral à mostra. O collider físico continua com espessura de
   * verdade — é a mesma separação visual/física da altura da parede.
   *
   * A rotação entra NEGADA, e isso não é gosto: o `Shape` é desenhado no plano XY e deitado com
   * `rotateX(-π/2)`, o que leva o Y da forma pro -Z do mundo, ou seja espelha a figura; a parede
   * física usa `(cos, sin)` como `(x, z)`, sem espelho. No hexágono nunca apareceu (espelhar um
   * polígono regular com vértice em 0° devolve os mesmos vértices), mas girar quebra a coincidência.
   */
  const geometry = new THREE.ShapeGeometry(createHexShape(circumradius, wallSegments, -trayRotation(wallSegments)))
  // Shape fica no plano XY, olhando pra +Z — gira pra ficar plano no XZ (chão), olhando pra
  // cima (+Y), na mesma altura (y=0) do topo do collider físico do chão.
  geometry.rotateX(-Math.PI / 2)

  const { normalMap, shadingMap } = createVelvetTextures()
  const floor = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: floorColor,
      map: shadingMap,
      roughness: FLOOR_ROUGHNESS,
      sheen: FLOOR_SHEEN,
      sheenRoughness: FLOOR_SHEEN_ROUGHNESS,
      sheenColor: new THREE.Color(floorColor).lerp(new THREE.Color(0xffffff), 0.4),
      normalMap,
      normalScale: new THREE.Vector2(FLOOR_NORMAL_SCALE, FLOOR_NORMAL_SCALE)
    })
  )
  floor.receiveShadow = true
  return floor
}

/**
 * Quanto a MESA fica abaixo do chão da bandeja: é o que dá altura pra caixa da base existir, já que
 * o chão não pode sair de y=0 (ver `PLATFORM_BASE_Y`). Exportado porque tudo que se apoia na mesa
 * desce junto ou fica flutuando — o estojo e a pelúcia, posicionados em `DiceCanvasMulti.tsx`.
 */
export const TABLE_DROP = 0.75

/**
 * Y de MUNDO da superfície de grama — o que se apoia na mesa (estojo, pelúcia) deve usar ISTO, e
 * não `-TABLE_DROP`. O tampo nasce 0.03 abaixo da origem do grupo da mesa, e essa diferença some
 * na conta se cada um resolver por fora.
 */
export const TABLE_SURFACE_Y = -TABLE_DROP - 0.03

/**
 * Plataforma copiada de `ideias/plataforma ideia.webp`: uma bandeja hexagonal de MDF cortada a laser.
 * O que define a peça é uma caixa hexagonal baixa embaixo, de raio maior que a bandeja, e uma ABA
 * plana correndo em volta do topo dela — é essa sobra em balanço que faz ler como bandeja sobre uma
 * base, e não como uma caixa só.
 *
 * O chão dos dados é a superfície de CIMA, no máximo uma espessura de MDF abaixo do topo da aba (a
 * primeira leitura da foto punha a aba alta e o veludo fundo, tipo poço). Como o chão está preso em
 * y=0, onde mora o collider, quem desce é a MESA — ver `TABLE_DROP`.
 */
const PLATFORM_BASE_Y = -TABLE_DROP - 0.02
/** Topo da caixa de baixo, logo acima do chão da bandeja. */
const PLATFORM_BOX_TOP = 0.02
/**
 * Topo da aba. Baixa de propósito: é a espessura de um painel passando rente ao chão, e não um
 * murinho. Nessa altura ela nem chega perto de atrapalhar a vista dos dados na parede da frente.
 */
const PLATFORM_RIM_TOP = 0.15
/** Quanto a caixa de baixo cresce além da bandeja. */
const PLATFORM_BOX_OFFSET = 0.78
/**
 * Quanto a aba cresce além da bandeja, maior que a caixa: é essa diferença que vira o balanço.
 *
 * Ele é pequeno por causa do ÂNGULO DA CÂMERA. A foto é quase da altura da mesa; a nossa câmera chega
 * ao rebordo da frente a ~60° de elevação, e nesse ângulo uma aba que avança `O` esconde
 * `O·tan(60°) ≈ 1.7·O` de altura da caixa. Com 0.45 a caixa inteira ficava tapada e a bandeja voltava
 * a parecer um aro deitado na grama; com 0.18 sobra ~0.46.
 */
const PLATFORM_RIM_OFFSET = 0.96
/**
 * O anel começa um tico DENTRO do raio da bandeja pra encostar na parede sem fresta. Coplanar com
 * ela não serviria: as duas faces disputariam profundidade e a borda "chiaria" com a câmera se
 * mexendo — mesmo empate de z-buffer já documentado nos ornamentos do estojo.
 */
const PLATFORM_INNER_OVERLAP = 0.05
/** Espessura do painel da parede — MDF, fino. */
const WALL_THICKNESS = 0.18
/**
 * Altura da parede visível acima da aba. Nada a ver com `TRAY_CONFIG.wallHeight`, que era a casca
 * vazada antiga, nem com o collider, que é a contenção física.
 *
 * O número sai de um limite de visão: a reta que sai da câmera (0, 13, 14.65) e raspa o topo interno
 * de uma parede de altura `h` chega ao chão a `6.5 - 8.15·h/(13-h)`. Com os 1.8 de antes isso
 * escondia 1.3 de bandeja na frente, um dado inteiro; com 0.75 a faixa cai pra ~0.5.
 */
const WALL_VISUAL_HEIGHT = 0.75

/**
 * Anel hexagonal maciço: o hexágono externo com um furo hexagonal no meio, extrudado. Um prisma
 * cheio taparia o chão de veludo. O furo usa a mesma volta de `createHexShape`, então as quinas do
 * anel caem nas mesmas direções das do chão e da parede — em hexágono, um desalinhamento de ângulo
 * não passa despercebido como passaria num cilindro liso.
 */
function createHexRingGeometry(
  innerCircumradius: number,
  outerCircumradius: number,
  height: number,
  segments: number,
  rotation = 0
): THREE.ExtrudeGeometry {
  const shape = createHexShape(outerCircumradius, segments, rotation)
  const hole = new THREE.Path()
  for (let i = 0; i <= segments; i++) {
    // O furo gira junto com o contorno, senão a parede sai com espessura desigual em cada lado.
    const angle = (i / segments) * Math.PI * 2 + rotation
    const x = Math.cos(angle) * innerCircumradius
    const y = Math.sin(angle) * innerCircumradius
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  shape.holes.push(hole)

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
  // `ExtrudeGeometry` cresce no +Z; girar -90° em X deixa o prisma em pé, de y=0 até y=height.
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/**
 * Base e rebordo de MDF em volta do hexágono (ver o comentário de `PLATFORM_BASE_Y`). Só visual,
 * sem collider nenhum: a contenção continua sendo a parede física, e nada aqui pode mudar o
 * resultado de uma rolagem. Usa o mesmo material de madeira da parede, então a peça toda lê como
 * uma bandeja só e a cor da aba Estilo continua mandando na madeira inteira.
 */
function createArenaPlatform(woodMaterial: THREE.MeshStandardMaterial, wallSegments: number): THREE.Group {
  const circumradius = regularPolygonCircumradius(trayApothem(wallSegments), wallSegments)
  const innerRadius = circumradius - PLATFORM_INNER_OVERLAP
  const group = new THREE.Group()

  function ring(inner: number, outer: number, baseY: number, topY: number): void {
    const mesh = new THREE.Mesh(
      createHexRingGeometry(inner, outer, topY - baseY, wallSegments, -trayRotation(wallSegments)),
      woodMaterial
    )
    mesh.position.y = baseY
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }

  // Caixa de baixo e aba em balanço. A aba começa ABAIXO do topo da caixa de propósito: encostar
  // exatamente daria o mesmo empate de z-buffer do `PLATFORM_INNER_OVERLAP`.
  ring(innerRadius, circumradius + PLATFORM_BOX_OFFSET, PLATFORM_BASE_Y, PLATFORM_BOX_TOP)
  ring(innerRadius, circumradius + PLATFORM_RIM_OFFSET, PLATFORM_BOX_TOP - 0.04, PLATFORM_RIM_TOP)

  /**
   * A parede, hoje um anel MACIÇO nascendo da aba em vez da casca vazada de antes. Isto foi o "o
   * problema são as paredes": renderizada só por dentro (`BackSide`), a da frente sumia por completo
   * e a bandeja ficava torta, com parede alta no fundo e nada na frente. A cara interna fica no
   * MESMO raio do collider, então o dado bate exatamente na superfície que se vê.
   */
  ring(
    circumradius,
    circumradius + WALL_THICKNESS,
    PLATFORM_RIM_TOP - 0.04,
    PLATFORM_RIM_TOP + WALL_VISUAL_HEIGHT
  )

  /**
   * Sem os rasgos queimados do corte a laser nem as juntas verticais das quinas: eram fiéis à foto,
   * mas na escala da cena viravam um tracejado preto em volta da bandeja.
   */

  return group
}

/**
 * A parede hexagonal já foi um `CylinderGeometry` aberto renderizado só por dentro; hoje é o anel
 * maciço de `createArenaPlatform`. Fica registrado o que aquela versão tinha de sutil, porque vale pra
 * qualquer hexágono novo aqui: ela precisava de `thetaStart: -Math.PI / 2`, porque o `CylinderGeometry`
 * põe o primeiro vértice em `(0, raio)` e o `createHexShape` põe o dele em `(raio, 0)`. Num polígono
 * de 6 lados esses 90° não são múltiplo dos 60° entre vértices, e os hexágonos ficam desencontrados
 * ("hexágono, parede e veludo em vértices diferentes").
 */

function createLights(): THREE.Light[] {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55)

  const directional = new THREE.DirectionalLight(0xfff4e0, 1.3)
  directional.position.set(...LIGHT_CONFIG.directional.position)
  directional.castShadow = true
  directional.shadow.mapSize.set(
    LIGHT_CONFIG.directional.shadowMapSize,
    LIGHT_CONFIG.directional.shadowMapSize
  )
  const frustum = LIGHT_CONFIG.directional.shadowFrustum
  directional.shadow.camera.left = -frustum
  directional.shadow.camera.right = frustum
  directional.shadow.camera.top = frustum
  directional.shadow.camera.bottom = -frustum
  directional.shadow.camera.near = 1
  directional.shadow.camera.far = 30

  return [ambient, directional]
}

/**
 * Parede e fundo são customizáveis por COR livre, e não por tema pronto: os temas fixos (cerca,
 * floresta) saíram feios, e a cor livre é o que já funcionava pros dados.
 */
export function createTrayScene(
  wallColor: number = DEFAULT_WALL_COLOR,
  backgroundColor: number = DEFAULT_BACKGROUND_COLOR,
  floorColor: number = DEFAULT_FLOOR_COLOR,
  backgroundImage: string | null = null,
  /** Lados da bandeja — triângulo, quadrado, hexágono ou círculo (ver `trayShape.ts`). */
  sides = TRAY_CONFIG.wallSegments
): TraySceneHandle {
  const scene = new THREE.Scene()
  applySceneBackground(scene, backgroundColor, backgroundImage)

  const table = createGroundPlane(wallColor)
  // Mesa REBAIXADA (ver `TABLE_DROP`): é o que abre espaço embaixo do chão da bandeja pra caixa
  // da base, sem tocar no chão nem no collider, que continuam em y=0.
  table.object.position.y = -TABLE_DROP
  scene.add(table.object)

  const floor = createFloor(floorColor, sides)
  scene.add(floor)
  const floorMaterial = floor.material as THREE.MeshPhysicalMaterial

  /**
   * Veio de madeira na parede ("o hexágono deixa mais rústico, algo como madeira"). O mapa é neutro
   * e MULTIPLICA a cor escolhida na aba Estilo, então a bandeja fica rústica sem perder a
   * customização: o marrom padrão vira madeira escura, um preset claro vira madeira clara. Um
   * ladrilho por LADO do polígono, pras tábuas acompanharem as faces em vez de cruzarem as quinas.
   */
  const wood = createWoodTextures(WOOD_WALL_REPEAT)
  /**
   * Um material de madeira só pra bandeja inteira: caixa, aba e parede. A parede tinha o seu, com
   * `side: BackSide`, enquanto era uma casca vazada; virando anel maciço, os dois viraram um.
   */
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: woodTint(wallColor),
    map: wood.map,
    normalMap: wood.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    // Madeira encerada: pega um brilho suave nas tábuas e deixa o veio aparecer.
    roughness: 0.68,
    metalness: 0
  })
  scene.add(createArenaPlatform(platformMaterial, sides))

  for (const light of createLights()) scene.add(light)

  return {
    scene,
    updateColors(newWallColor, newBackgroundColor, newFloorColor, newBackgroundImage) {
      platformMaterial.color.copy(woodTint(newWallColor))
      applySceneBackground(scene, newBackgroundColor, newBackgroundImage)
      floorMaterial.color.set(newFloorColor)
      floorMaterial.sheenColor.set(newFloorColor).lerp(new THREE.Color(0xffffff), 0.4)
      // Só a madeira da borda da mesa; a grama do tampo é fixa (ver `createGroundPlane`).
      table.updateEdgeColor(newWallColor)
    }
  }
}
