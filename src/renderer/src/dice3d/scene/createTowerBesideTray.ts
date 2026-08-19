import * as THREE from 'three'
import { buildTowerShellGeometry } from '../geometry/buildTowerShellGeometry'
import {
  TOWER_BESIDE_CONFIG,
  TOWER_BESIDE_GATE_ANGLE,
  computeTowerBesideLayout
} from '../geometry/towerBesideTrayLayout'
import { createBrickTexture } from './createBrickTexture'
import { STONE_ROUGHNESS } from './createTowerScene'
import { TABLE_SURFACE_Y } from './createScene'

/**
 * Torre AO LADO da bandeja hexagonal — arranjo pedido pelo usuário, diferente da torre antiga
 * (`createTowerScene.ts`), que ficava sozinha no centro de uma praça de pedra, sem hexágono nenhum,
 * e por dentro da qual o dado realmente caía.
 *
 * Aqui a torre é CENÁRIO: o dado nasce na BOCA (o portão, ver `tossDieFromMouth.ts`) e sai rolando
 * pra dentro do hexágono, sem nunca passar pelo miolo. Duas consequências diretas disso, as duas
 * pedidas: a torre é FECHADA em cima (telhado cônico + tampa), e não há prateleiras nem colliders
 * internos — nada as veria nem tocaria.
 *
 * DIMENSÕES PRÓPRIAS, não `TOWER_CONFIG` escalado: aquela torre tem 10.3 de altura pra 2.2 de raio
 * porque a altura era DERIVADA do mecanismo (`baffleCount` × `baffleVerticalSpacing`). Escalada pra
 * caber ao lado da bandeja, lia como chaminé — conferido renderizado. Como peça de cenário a altura
 * é livre, e perto de 3:1 dá a silhueta de torre.
 *
 * Vocabulário de fantasia (torre de D&D, pedido do usuário): telhado cônico em fiadas, frestas de
 * arqueiro em espiral, arco de aduelas sobre o portão, três tochas acesas em volta e flâmula de
 * rabo de andorinha no topo. Tudo procedural, sem asset externo — mesma restrição do resto da cena.
 *
 * CONTRAFORTES REMOVIDOS a pedido do usuário ("tira essas coisas atrás"). Ficavam na metade oposta
 * ao portão pra não atrapalhar a saída do dado, e era justamente lá que apareciam: da câmera padrão,
 * três blocos espetados no fundo da torre.
 */

/** Ardósia do telhado — azulada e bem escura, pra separar da pedra por MATIZ, não só por tom. */
export const DEFAULT_TOWER_ROOF_COLOR = 0x2f3542
export const DEFAULT_TOWER_FLAG_COLOR = 0xb03030
export const DEFAULT_TOWER_DOOR_COLOR = 0x4a3520
/**
 * Pedra da torre. Um pouco mais clara que a `STONE_COLOR` da torre antiga (0x3a382f) porque aqui ela
 * TINGE uma textura neutra em vez de estar assada nela (ver `createBrickMaterialFactory`), e
 * multiplicação sempre escurece: o tijolo médio da textura fica em ~0.85 de luminosidade, então a
 * cor precisa subir na mesma medida pra chegar no mesmo cinza-oliva na tela.
 */
export const DEFAULT_TOWER_STONE_COLOR = 0x45423a

const POLE_COLOR = 0x3a3a3a
const TORCH_FLAME_COLOR = 0xff9a3c
const TORCH_LIGHT_COLOR = 0xffb055
/** Preto quase puro: a fresta é um vão na parede, não uma peça pintada de escuro. */
const SLIT_COLOR = 0x0a0908

/**
 * Cinzas NEUTROS assados na textura de tijolo, pra cor real vir do `material.color` por cima.
 *
 * É o mesmo mecanismo que o chão da bandeja já usa (textura de pedra multiplicada pela cor
 * escolhida) e o que torna a cor da torre editável AO VIVO. Assar a cor do usuário na textura
 * obrigaria a redesenhar canvas e mapa de normais a cada quadro de arrasto na roda de cor.
 *
 * O tijolo é claro mas NÃO branco, de propósito: `seededShade` varia ±20% de luminosidade por
 * tijolo, e partindo do branco a metade positiva satura e some — a variação viraria só "escurece ou
 * não", e a alvenaria perderia metade do contraste entre pedras.
 */
const NEUTRAL_BRICK = 0xd8d8d8
const NEUTRAL_MORTAR = 0x2b2b2b

export interface TowerColors {
  /** Pedra: casca, ameias, cornija, pilares do portão, aduelas, soleira e pedestal. */
  stone: number
  /** O "bico": o telhado cônico. */
  roof: number
  flag: number
  door: number
}

export const DEFAULT_TOWER_COLORS: TowerColors = {
  stone: DEFAULT_TOWER_STONE_COLOR,
  roof: DEFAULT_TOWER_ROOF_COLOR,
  flag: DEFAULT_TOWER_FLAG_COLOR,
  door: DEFAULT_TOWER_DOOR_COLOR
}

export interface TowerBesideTrayHandle {
  group: THREE.Group
  /** Ponto (mundo) de onde o dado sai — o mesmo que `tossDieFromMouth` usa. */
  mouth: THREE.Vector3
  /** Vetor unitário horizontal da boca em direção ao centro do hexágono. */
  mouthDirection: THREE.Vector3
  /**
   * Troca as cores SEM recriar a torre — mesmo contrato de `TraySceneHandle.updateColors`, e pelo
   * mesmo motivo: quem chama é a roda de cor da aba Estilo, que dispara a cada quadro de arrasto.
   */
  updateColors: (colors: TowerColors) => void
}

interface BrickFactory {
  /** Material de tijolo pra uma peça de `width` × `height` no mundo. */
  (width: number, height: number): THREE.MeshStandardMaterial
  /** Todos os materiais já criados — pra tingir todos de uma vez em `updateColors`. */
  materials: THREE.MeshStandardMaterial[]
}

/**
 * Material de tijolo dimensionado pra PEÇA, com cache.
 *
 * O `repeat` da textura sai das medidas reais da superfície (ver `createBrickTexture`), então uma
 * ameia e a casca inteira precisam de texturas diferentes pra mostrarem tijolos do mesmo tamanho no
 * mundo. Sem o cache seria um canvas 256×256 e um mapa de normais por peça — e só de ameias e
 * aduelas são quase vinte.
 */
function createBrickMaterialFactory(stoneColor: number): BrickFactory {
  const cache = new Map<string, THREE.MeshStandardMaterial>()
  const materials: THREE.MeshStandardMaterial[] = []

  const factory = ((width: number, height: number) => {
    const key = `${width.toFixed(2)}x${height.toFixed(2)}`
    const cached = cache.get(key)
    if (cached) return cached
    /**
     * Tamanho do tijolo DERIVADO da peça, com teto e piso — em vez de dois tamanhos fixos
     * ("grande"/"miúdo") escolhidos peça a peça.
     *
     * Foi assim que a primeira tentativa quebrou: marquei contraforte e cornija como "peças
     * pequenas", e tijolo miúdo (0.34 × 0.17) numa peça de 2 de altura pede DOZE fiadas. Doze
     * fiadas numa peça estreita não lê como alvenaria, lê como chapa corrugada — e na cornija, com
     * 10 de circunferência, deu 29 colunas de listras. O erro foi classificar em vez de calcular.
     *
     * A regra: ~3 tijolos na largura e ~4 fiadas na altura, presos entre um mínimo (pra peça grande
     * não virar um tijolo gigante) e o tamanho da casca (pra tudo parecer a mesma alvenaria).
     */
    const brickWidth = Math.min(1.1, Math.max(0.28, width / 3))
    const brickHeight = Math.min(0.55, Math.max(0.14, height / 4))
    const { map, normalMap } = createBrickTexture(
      NEUTRAL_BRICK,
      NEUTRAL_MORTAR,
      width,
      height,
      brickWidth,
      brickHeight
    )
    const material = new THREE.MeshStandardMaterial({
      color: stoneColor,
      map,
      normalMap,
      normalScale: new THREE.Vector2(1, 1),
      roughness: STONE_ROUGHNESS
    })
    cache.set(key, material)
    materials.push(material)
    return material
  }) as BrickFactory
  factory.materials = materials
  return factory
}

function createShellMesh(
  radius: number,
  height: number,
  gateArcWidth: number,
  gateHeight: number,
  brick: BrickFactory
): THREE.Mesh {
  const material = brick(2 * Math.PI * radius, height)
  // A casca é a única peça vista pelos dois lados (por dentro do vão do portão).
  material.side = THREE.DoubleSide
  const mesh = new THREE.Mesh(
    buildTowerShellGeometry({
      radius,
      height,
      gateAngleRad: TOWER_BESIDE_GATE_ANGLE,
      gateArcWidth,
      gateHeight,
      radialSegments: 48
    }),
    material
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Tampa no topo da casca, por dentro do anel de ameias. É ela que garante o "não dá pra ver por
 * dentro": a casca não tem tampo nem fundo (ver `buildTowerShellGeometry`), e o telhado cônico
 * sozinho não fecha — nasce mais estreito que a parede, então de um ângulo rasante daria pra
 * enxergar o vão entre um e outro.
 */
function createRoofCap(radius: number, topY: number, brick: BrickFactory): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(radius, 48)
  geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, brick(radius * 2, radius * 2))
  mesh.position.y = topY
  mesh.receiveShadow = true
  return mesh
}

/**
 * Telhado cônico (o "bico") em FIADAS, saindo de dentro do anel de ameias — o elemento que mais
 * empurra a leitura de "torre de mago" em vez de "torreão de castelo".
 *
 * Fiadas empilhadas (cilindros truncados, cada um mais estreito e com uma saliência sobre o de
 * baixo) em vez de um `ConeGeometry` liso: cone perfeito lê como funil de plástico, e as saliências
 * pegam a luz direcional em degraus, que é como uma cobertura de ardósia se lê à distância.
 */
function createSpire(radius: number, baseY: number, material: THREE.Material): THREE.Group {
  const group = new THREE.Group()
  const courses = 6
  const spireHeight = radius * 1.9
  // Nasce mais estreito que a parede pra as ameias continuarem aparecendo em volta dele.
  const baseRadius = radius * 0.92

  for (let i = 0; i < courses; i++) {
    const bottom = baseRadius * (1 - i / courses)
    const top = baseRadius * (1 - (i + 1) / courses)
    const courseHeight = spireHeight / courses
    // Saliência: a fiada começa um pouco mais larga que o topo da anterior, criando o degrau.
    const course = new THREE.Mesh(
      new THREE.CylinderGeometry(top, bottom * 1.06, courseHeight, 24, 1, true),
      material
    )
    course.position.y = baseY + courseHeight * i + courseHeight / 2
    course.castShadow = true
    group.add(course)
  }

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.07, 12, 10),
    new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.5, metalness: 0.35 })
  )
  finial.position.y = baseY + spireHeight
  group.add(finial)

  return group
}

function createMerlonRing(radius: number, y: number, brick: BrickFactory): THREE.Group {
  const group = new THREE.Group()
  const count = 12
  const merlonHeight = radius * 0.34
  const merlonDepth = radius * 0.22
  const merlonWidth = ((2 * Math.PI * radius) / count) * 0.62
  const material = brick(merlonWidth, merlonHeight)

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

/**
 * Cordão saliente onde a casca encontra as ameias — a "cornija". Sem ela o anel de ameias parece
 * apoiado no nada; com ela a parede termina numa borda, que é como uma torre de verdade resolve
 * esse encontro.
 */
function createCornice(radius: number, y: number, brick: BrickFactory): THREE.Mesh {
  const height = radius * 0.1
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.1, radius * 1.04, height, 32),
    brick(2 * Math.PI * radius * 1.1, height)
  )
  mesh.position.y = y - height / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Frestas de arqueiro subindo em ESPIRAL pela casca — em espiral, e não empilhadas, porque é assim
 * que uma torre com escada em caracol as distribui, e porque alinhadas na vertical leriam como
 * janelas de prédio.
 *
 * Só o vão escuro, sem verga. A primeira versão punha uma pedra de verga em cima de cada fresta: no
 * tamanho dela a textura entregava dois tijolos claros sobre argamassa escura, e o conjunto lia como
 * uma etiqueta listrada grudada na parede — o oposto de um vão. A parede já tem fiadas em volta
 * dando o contorno; o que faltava era só o buraco.
 */
function createArrowSlits(radius: number, height: number, gateHeight: number): THREE.Group {
  const group = new THREE.Group()
  const count = 4
  const slitWidth = radius * 0.075
  const slitHeight = radius * 0.44
  const material = new THREE.MeshStandardMaterial({ color: SLIT_COLOR, roughness: 1 })
  const geometry = new THREE.BoxGeometry(slitWidth, slitHeight, 0.04)

  for (let i = 0; i < count; i++) {
    // Começa acima da verga do portão e sobe até pouco antes da cornija; gira 100° por fresta.
    const t = (i + 0.5) / count
    const y = gateHeight + radius * 0.55 + t * (height - gateHeight - radius * 1.2)
    const angle = TOWER_BESIDE_GATE_ANGLE + Math.PI * 0.35 + i * ((100 * Math.PI) / 180)
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))

    const slit = new THREE.Mesh(geometry, material)
    slit.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), radial)
    slit.position.copy(radial).multiplyScalar(radius + 0.015).setY(y)
    group.add(slit)
  }
  return group
}

/**
 * Arco de ADUELAS sobre o portão. O recorte da casca é retangular (`buildTowerShellGeometry`), e
 * portão reto é vocabulário de galpão; o arco é o que data a construção. Cada aduela é uma peça
 * independente girando ao longo da meia-volta, como numa abóbada de verdade, e não um desenho.
 */
function createGateArch(
  radius: number,
  gateArcWidth: number,
  gateHeight: number,
  brick: BrickFactory
): THREE.Group {
  const group = new THREE.Group()
  const voussoirs = 7
  const blockWidth = radius * 0.15
  const blockHeight = radius * 0.2
  const material = brick(blockWidth, blockHeight)
  const halfSpan = gateArcWidth / 2
  const archRise = radius * 0.42
  const tangent = new THREE.Vector3(
    -Math.sin(TOWER_BESIDE_GATE_ANGLE),
    0,
    Math.cos(TOWER_BESIDE_GATE_ANGLE)
  )
  const radial = new THREE.Vector3(Math.cos(TOWER_BESIDE_GATE_ANGLE), 0, Math.sin(TOWER_BESIDE_GATE_ANGLE))

  for (let i = 0; i < voussoirs; i++) {
    const t = i / (voussoirs - 1)
    // Meia-elipse: largura cai como cosseno, altura sobe como seno — dá o perfil do arco, e a aduela
    // do topo (t = 0.5) vira a pedra-chave.
    const along = Math.cos(t * Math.PI) * halfSpan
    const rise = Math.sin(t * Math.PI) * archRise
    const block = new THREE.Mesh(new THREE.BoxGeometry(blockWidth, blockHeight, radius * 0.2), material)
    block.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), radial)
    // Gira cada bloco acompanhando a inclinação do arco naquele ponto, senão eles ficam todos em pé
    // e o arco lê como uma escada.
    block.rotateZ(-(t - 0.5) * Math.PI * 0.9)
    block.position
      .copy(radial)
      .multiplyScalar(radius + 0.04)
      .addScaledVector(tangent, along)
      .setY(gateHeight + rise)
    block.castShadow = true
    group.add(block)
  }
  return group
}

/**
 * TRÊS tochas acesas em volta da torre, a 120° uma da outra — pedido do usuário depois de gostar da
 * primeira ("coloca 3, uma em cada canto"). A de referência continua ao lado do portão, e é a que
 * importa: a luz dela cai justo na pedra de onde o dado sai. As outras duas ocupam, entre outras
 * coisas, o lado de trás que ficou vazio quando os contrafortes saíram.
 *
 * Cada uma tem uma `PointLight` de verdade, de alcance curto e SEM sombra: a cena já tem uma
 * direcional com mapa de 2048, e cada fonte sombreadora extra custa outro passe de render inteiro —
 * três deles, por um detalhe de canto, não se paga.
 */
function createTorches(radius: number, gateArcWidth: number, gateHeight: number): THREE.Group {
  const group = new THREE.Group()
  const halfAngle = gateArcWidth / 2 / radius
  const baseAngle = TOWER_BESIDE_GATE_ANGLE + halfAngle * 1.75
  const y = gateHeight + radius * 0.28

  const metal = new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.55, metalness: 0.4 })
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: TORCH_FLAME_COLOR,
    emissive: TORCH_FLAME_COLOR,
    emissiveIntensity: 1.6,
    roughness: 1
  })

  for (let i = 0; i < 3; i++) {
    const angle = baseAngle + i * ((Math.PI * 2) / 3)
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))

    const bracket = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.025, radius * 0.025, radius * 0.3, 8),
      metal
    )
    bracket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial)
    bracket.position.copy(radial).multiplyScalar(radius + radius * 0.13).setY(y)
    group.add(bracket)

    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.08, radius * 0.05, radius * 0.12, 10),
      metal
    )
    basket.position.copy(radial).multiplyScalar(radius + radius * 0.28).setY(y + radius * 0.04)
    group.add(basket)

    // A chama é emissiva: sem isso ela ficaria escura como qualquer outro objeto, já que a luz sai
    // DELA e não a ilumina.
    const flame = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.07, radius * 0.2, 10), flameMaterial)
    flame.position.copy(basket.position).setY(y + radius * 0.17)
    group.add(flame)

    const light = new THREE.PointLight(TORCH_LIGHT_COLOR, 4.5, radius * 4.5, 2)
    light.position.copy(flame.position)
    group.add(light)
  }
  return group
}

/**
 * Soleira: degrau curto saindo da boca em direção ao hexágono. Não é enfeite — é o que impede o dado
 * de nascer sobre o vazio e despencar colado na casca. Ele nasce EM CIMA dela e a atravessa rolando.
 */
function createMouthSill(radius: number, sillY: number, gateArcWidth: number, brick: BrickFactory): THREE.Mesh {
  const depth = radius * 0.7
  const thickness = 0.1
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(depth, thickness, gateArcWidth), brick(depth, gateArcWidth))
  const radial = new THREE.Vector3(Math.cos(TOWER_BESIDE_GATE_ANGLE), 0, Math.sin(TOWER_BESIDE_GATE_ANGLE))
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), radial)
  mesh.position.copy(radial).multiplyScalar(radius + depth / 2 - 0.12)
  mesh.position.y = sillY - thickness / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Moldura do portão (2 pilares + verga) e a folha de madeira ABERTA, encostada por fora ao lado do
 * vão. A folha gira 180° a partir da dobradiça — o único ângulo que garante geometricamente que ela
 * nunca cruza a abertura, qualquer que seja a largura do portão (a primeira versão usava um ângulo
 * escolhido no olho e a porta ficava atravessada no meio do vão).
 */
function createGateStructure(
  radius: number,
  gateArcWidth: number,
  gateHeight: number,
  brick: BrickFactory,
  doorMaterial: THREE.Material
): THREE.Group {
  const group = new THREE.Group()
  const halfAngle = gateArcWidth / 2 / radius
  const radialAt = (a: number) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
  const tangentAt = (a: number) => new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))

  const pillarWidth = radius * 0.2
  const pillarDepth = radius * 0.26
  const pillarHeight = gateHeight + radius * 0.18
  const pillarMaterial = brick(pillarWidth, pillarHeight)

  for (const side of [-1, 1] as const) {
    const pillarAngle = TOWER_BESIDE_GATE_ANGLE + side * halfAngle
    const radialDir = radialAt(pillarAngle)
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarWidth, pillarHeight, pillarDepth), pillarMaterial)
    pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), radialDir)
    pillar.position.copy(radialDir).multiplyScalar(radius).setY(pillarHeight / 2)
    pillar.castShadow = true
    group.add(pillar)
  }

  const lintelWidth = gateArcWidth + pillarWidth * 2
  const lintelHeight = radius * 0.22
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(lintelWidth, lintelHeight, pillarDepth),
    brick(lintelWidth, lintelHeight)
  )
  lintel.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangentAt(TOWER_BESIDE_GATE_ANGLE))
  lintel.position
    .copy(radialAt(TOWER_BESIDE_GATE_ANGLE))
    .multiplyScalar(radius)
    .setY(pillarHeight + radius * 0.11)
  lintel.castShadow = true
  group.add(lintel)

  const doorWidth = gateArcWidth * 0.85
  const doorHeight = gateHeight - 0.1
  const doorGroup = new THREE.Group()
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.08), doorMaterial)
  doorLeaf.position.x = doorWidth / 2
  doorLeaf.castShadow = true
  doorGroup.add(doorLeaf)

  // Ferragens: duas cintas de ferro atravessando a folha, que é o que impede a porta de ler como uma
  // tábua lisa. Ficam de FERRO fixo, sem acompanhar a cor da porta — ferragem não se pinta junto.
  const strapMaterial = new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.55, metalness: 0.45 })
  for (const fy of [0.28, 0.72]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(doorWidth * 0.94, doorHeight * 0.1, 0.03), strapMaterial)
    strap.position.set(doorWidth / 2, (fy - 0.5) * doorHeight, 0.055)
    doorGroup.add(strap)
  }

  const hingeAngle = TOWER_BESIDE_GATE_ANGLE - halfAngle
  doorGroup.position.copy(radialAt(hingeAngle)).multiplyScalar(radius).setY(doorHeight / 2 + 0.04)
  doorGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangentAt(hingeAngle).multiplyScalar(-1))
  group.add(doorGroup)

  return group
}

/**
 * Pedestal, da mesa até a base da torre (ver `mouthClearance` no layout) — na prática, o pedaço da
 * torre que fica abaixo da boca.
 *
 * RETO e com a MESMA contagem de segmentos da casca (48). Antes era um cilindro levemente cônico
 * (base 7% mais larga) com 32 segmentos e raio maior que o da casca: três diferenças ao mesmo tempo,
 * e o resultado foi o usuário ver "dois cilindros diferentes". Raio, conicidade e facetamento
 * precisam bater com a casca — qualquer um dos três sozinho já denuncia a emenda.
 */
function createPlinth(baseY: number, radius: number, brick: BrickFactory): THREE.Mesh {
  const height = baseY - TABLE_SURFACE_Y
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 48),
    brick(2 * Math.PI * radius, height)
  )
  mesh.position.y = TABLE_SURFACE_Y + height / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Flâmula de RABO DE ANDORINHA (o entalhe em V na ponta) — forma de estandarte, não triângulo. */
function createFlag(tipY: number, radius: number, material: THREE.Material): THREE.Group {
  const group = new THREE.Group()
  const poleHeight = radius * 0.85

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, poleHeight, 8),
    new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.6 })
  )
  pole.position.y = tipY + poleHeight / 2
  group.add(pole)

  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(radius * 0.5, -radius * 0.07)
  shape.lineTo(radius * 0.34, -radius * 0.15)
  shape.lineTo(radius * 0.5, -radius * 0.23)
  shape.lineTo(0, -radius * 0.3)
  shape.closePath()
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), material)
  flag.position.y = tipY + poleHeight - 0.05
  group.add(flag)

  return group
}

export function createTowerBesideTray(
  colors: TowerColors = DEFAULT_TOWER_COLORS,
  overrides: Partial<typeof TOWER_BESIDE_CONFIG> = {}
): TowerBesideTrayHandle {
  const config = { ...TOWER_BESIDE_CONFIG, ...overrides }
  const layout = computeTowerBesideLayout(overrides)
  const { radius, height, gateArcWidth, gateHeight, sillY, seatDistance, baseY } = layout

  const brick = createBrickMaterialFactory(colors.stone)
  const roofMaterial = new THREE.MeshStandardMaterial({ color: colors.roof, roughness: 0.72 })
  const flagMaterial = new THREE.MeshStandardMaterial({
    color: colors.flag,
    roughness: 0.6,
    side: THREE.DoubleSide
  })
  const doorMaterial = new THREE.MeshStandardMaterial({ color: colors.door, roughness: 0.85 })

  const tower = new THREE.Group()
  tower.add(createShellMesh(radius, height, gateArcWidth, gateHeight, brick))
  tower.add(createRoofCap(radius, height, brick))
  tower.add(createCornice(radius, height, brick))
  tower.add(createMerlonRing(radius, height, brick))
  tower.add(createSpire(radius, height, roofMaterial))
  tower.add(createArrowSlits(radius, height, gateHeight))
  tower.add(createGateStructure(radius, gateArcWidth, gateHeight, brick, doorMaterial))
  tower.add(createGateArch(radius, gateArcWidth, gateHeight, brick))
  tower.add(createTorches(radius, gateArcWidth, gateHeight))
  tower.add(createMouthSill(radius, sillY, gateArcWidth, brick))
  tower.add(createFlag(height + radius * 1.9, radius, flagMaterial))

  tower.position.set(layout.outward.x * seatDistance, baseY, layout.outward.z * seatDistance)
  /**
   * Girando o grupo em `-angleRad`, o -X local (o portão) passa a apontar exatamente pra
   * `-(cos θ, sin θ)` — de volta pro centro do hexágono. Conta feita, não ângulo tentado: com
   * `rotation.y = α`, um vetor local `(-1, 0, 0)` vira `(-cos α, 0, sin α)`, que só é igual a
   * `(-cos θ, 0, -sin θ)` quando `α = -θ`.
   */
  tower.rotation.y = -config.angleRad

  const plinth = createPlinth(baseY, radius + config.plinthOverhang, brick)
  plinth.position.x = tower.position.x
  plinth.position.z = tower.position.z

  const group = new THREE.Group()
  group.add(plinth)
  group.add(tower)

  return {
    group,
    mouth: new THREE.Vector3(layout.mouth.x, layout.mouth.y, layout.mouth.z),
    mouthDirection: new THREE.Vector3(layout.mouthDirection.x, 0, layout.mouthDirection.z),
    updateColors(next) {
      for (const material of brick.materials) material.color.set(next.stone)
      roofMaterial.color.set(next.roof)
      flagMaterial.color.set(next.flag)
      doorMaterial.color.set(next.door)
    }
  }
}
