import * as THREE from 'three'
import { TRAY_CONFIG } from '../config/physicsConfig'
import { trayApothem, trayRotation } from '../geometry/trayShape'
import { LIGHT_CONFIG } from '../config/sceneConfig'
import { regularPolygonCircumradius } from '../physics/regularPolygon'
import { createVelvetTextures } from './createVelvetNormalMap'
import { createGrassTextures, GRASS_TILE_WORLD_SIZE } from './createGrassTexture'
import { createWoodTextures, WOOD_TABLE_REPEAT, WOOD_WALL_REPEAT } from './createWoodTexture'
import { applySceneBackground } from './applySceneBackground'

/** Cor padrão de parede/fundo/chão quando nenhuma cor customizada é passada — exportados pra quem monta a cena (`DiceCanvasMulti.tsx`) usar o mesmo padrão ao aplicar `updateColors` sem duplicar o número mágico. */
/**
 * A parede padrão era `0x1c3f2a` (verde escuro), de quando ela era uma chapa de cor lisa. Virou
 * marrom de madeira agora que a cor escolhida MANDA de verdade no tom (ver `woodTint` e
 * `createWoodTexture.ts`): antes o mapa castanho pintava qualquer escolha de madeira, então o
 * verde do padrão nunca chegava a aparecer. Com o mapa neutro ele apareceria — e uma bandeja verde
 * de fábrica não é o que ninguém escolheu, é um resto de configuração antiga vazando na tela.
 */
export const DEFAULT_WALL_COLOR = 0x6b4a2a
export const DEFAULT_BACKGROUND_COLOR = 0x000000
export const DEFAULT_FLOOR_COLOR = 0x243b6b

/**
 * Chão da bandeja com acabamento de VELUDO (pedido do usuário, referência era uma bandeja de
 * mesa forrada) — `MeshPhysicalMaterial.sheen*` é o par certo pra isso: é a extensão
 * fisicamente baseada do three.js especificamente pra tecido (a "auréola" de brilho suave nas
 * bordas contra a luz que reflexo especular comum de `MeshStandardMaterial` não reproduz).
 * `sheenColor` um pouco mais claro que `floorColor` simula fibra clara pegando luz por cima da
 * cor de base, igual veludo de verdade.
 */
/**
 * Aumentado depois do usuário testar e dizer "ainda não parece veludo" com só `sheen` (efeito
 * de fresnel — só aparece claramente em ângulo rasante contra a luz, quase invisível olhando de
 * cima). `sheen`/`sheenRoughness` subiram mais um pouco; o reforço de verdade são as duas
 * texturas de `createVelvetTextures()` (ver comentário grande lá — normal map sozinho ficou
 * bom de perto mas quase sumia no enquadramento padrão, mais afastado).
 */
const FLOOR_ROUGHNESS = 0.97
const FLOOR_SHEEN = 1
const FLOOR_SHEEN_ROUGHNESS = 0.35
const FLOOR_NORMAL_SCALE = 5

export interface TraySceneHandle {
  scene: THREE.Scene
  /**
   * Atualiza cor da parede/fundo/chão (e a imagem de fundo, se houver) SEM recriar a cena —
   * chamado a cada troca nas Preferências (ver `DiceCanvasMulti.tsx`, mesmo mecanismo já usado
   * pra cor dos dados). `backgroundImage` (data URL ou `null`) tem prioridade sobre
   * `backgroundColor` quando presente — ver `applySceneBackground.ts`.
   */
  updateColors: (
    wallColor: number,
    backgroundColor: number,
    floorColor: number,
    backgroundImage: string | null
  ) => void
}

/**
 * Hexágono como `THREE.Shape` (não `CylinderGeometry`) especificamente pro chão: extrudar essa
 * forma dá UV PLANA nas tampas (mapeamento pela caixa delimitadora, ver
 * `ExtrudeGeometry`/`UVGenerator` do three.js), ao contrário da tampa de um `CylinderGeometry`
 * (UV polar/em leque) — o `normalMap` de veludo precisa de UV plana pra ladrilhar como uma
 * grade de verdade em vez de girar em espiral a partir do centro.
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
 * Reduzido de 40 pra 16 (~2.1× o circunraio do hexágono, ~7.5) — a versão original cobria quase
 * o enquadramento inteiro com um disco de cor sólida, o que o usuário reportou como "atrapalhar"
 * uma imagem de fundo escolhida (StyleTab → "Escolher imagem...": com o disco imenso, a imagem
 * mal aparecia, só uma faixa no horizonte). O ponto do chão-apron é só desfazer o efeito de
 * "ilha flutuando" bem ao redor da bandeja/torre — não precisa dominar o quadro pra isso, e um
 * raio bem menor deixa o resto da cena (cor sólida OU imagem) continuar sendo o "papel de
 * parede" de verdade, como o usuário pediu.
 */
/**
 * Exportado porque o LIMITE DE PASSEIO da câmera WASD é este mesmo número (ver `TABLE_PAN_LIMIT`
 * em `DiceCanvasMulti.tsx`): "andar pela mesa" tem que querer dizer a mesa inteira, e um limite
 * copiado à mão sairia de sincronia na primeira vez que o tampo mudasse de tamanho.
 */
export const GROUND_RADIUS = 16

/**
 * Chão "apron" (um disco moderadamente maior que a bandeja/base da torre) por BAIXO do chão de
 * verdade — pedido do usuário depois do chão hexagonal ficar plano (ver `createFloor`) e ele
 * ainda achar que "não conecta com o terreno": sem isso, fora do hexágono/círculo da bandeja/
 * torre não existe nada além da cor de fundo sólida (ou imagem), então de qualquer ângulo um
 * pouco mais baixo a bandeja lê como uma ilha flutuando no vazio, não como uma mesa/chão de
 * verdade com uma área de jogo em cima. Cor derivada da cor do piso (mais escura, como o resto
 * do cômodo/chão em sombra ao redor de um tapete iluminado) em vez de uma cor fixa, pra continuar
 * coerente com qualquer customização de cor do usuário sem precisar de mais um seletor de cor só
 * pra isso.
 */
/** Espessura do tampo da mesa (a borda de madeira que aparece em volta da grama). */
const TABLE_EDGE_HEIGHT = 0.55
/** Repetições da textura de grama ao longo do diâmetro do tampo — ver `GRASS_TILE_WORLD_SIZE` (ladrilho grande justamente pra repetição não saltar aos olhos). */
const GRASS_REPEAT = (GROUND_RADIUS * 2) / GRASS_TILE_WORLD_SIZE

/**
 * Cor escolhida na aba Estilo virada TINTURA de madeira: é ela, e só ela, que manda no tom da
 * bandeja, da borda da mesa e do estojo. A textura (`createWoodTexture.ts`) entra por cima, quase
 * branca, só desenhando veio e juntas.
 *
 * Piso de brilho (em LINEAR, que é como `THREE.Color` guarda) abaixo do qual a cor é clareada
 * PROPORCIONALMENTE. Equivale a uns 12% em sRGB — abaixo de qualquer preset (o mais escuro, Couro
 * `#241a12`, está em 0.0165), então na prática só pega quem escolhe quase-preto.
 */
const MIN_WOOD_LUMA = 0.012

export function woodTint(color: number): THREE.Color {
  const tinted = new THREE.Color(color)
  /**
   * Isto era `lerp(branco, 0.42)`, pra compensar um mapa de madeira castanho e escuro. Com o mapa
   * neutro o clareamento passou a só LAVAR a escolha do usuário — e misturar branco é justamente o
   * que não serve aqui, porque mexe nos três canais por igual e numa cor escura ele domina os três.
   * Medido no preset Couro: com 0.06 de branco a parede saía `#726c66`, um cinza; sem mistura
   * nenhuma sai `#33261f`, marrom de verdade. Com a cor quase preta do usuário (`#05061c`) a 0.03
   * ainda saía `#535256` — cinza também.
   *
   * O que ficou no lugar é um piso PROPORCIONAL: multiplicar os três canais mantém a proporção
   * entre eles, ou seja, mantém o matiz — só impede que uma escolha quase preta vire um vazio
   * chapado (o veio vem do `normalMap`, mas nem ele aparece sobre albedo zero).
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
 * A bandeja inteira (chão de veludo + caixa, aba e parede de madeira) num grupo só, pra servir de
 * PRÉVIA na aba Estilo — pedido do usuário, que até então só via o efeito das cores de parede/chão
 * voltando pra aba Rolagem.
 *
 * Monta com as MESMAS funções da cena de verdade (`createFloor`, `createArenaPlatform`, os mesmos
 * materiais e o mesmo `woodTint`), e não com uma imitação simplificada: uma prévia que erra o
 * material ou a proporção é pior que não ter prévia, porque ensina errado. O preço é a prévia
 * carregar as texturas procedurais de veludo e madeira — as mesmas que a cena principal já gera.
 *
 * Sem mesa, sem grama, sem luz própria e sem física: quem monta decide o enquadramento e a
 * iluminação (ver `TrayPreview.tsx`).
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
 * A "mesa" onde a bandeja fica apoiada — pedido do usuário: "uma mesinha bonitinha de grama
 * igual o tabletop rpg". Substitui o disco de cor sólida que existia aqui (uma versão escurecida
 * da cor do chão da bandeja), que era só um recurso pra bandeja não parecer uma ilha flutuando.
 *
 * Tampo de grama procedural (`createGrassTexture.ts`) + borda de madeira: é o par que faz ler
 * como mesa de jogo com tapete de terreno, e não como "o chão do cenário". A grama é verde FIXO,
 * não derivada da cor do chão da bandeja: grama tingida de mostarda ou roxo (cores que o usuário
 * usa na bandeja) não é grama. A borda, sim, acompanha a cor de parede — assim a mesa continua
 * combinando com a bandeja escolhida.
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
   * `ShapeGeometry` (chapa plana, sem profundidade) em vez do antigo `ExtrudeGeometry` — o
   * usuário reportou que o chão parecia um "tronco" (um bloco hexagonal baixo, com a lateral
   * da extrusão visível) em vez de um chão liso encostado no terreno/fundo da cena. O collider
   * FÍSICO do chão (`createBoundaryColliders.ts`) continua com espessura de verdade
   * (`floorThickness`) — só o mesh visual virou plano, mesma decoupling visual/física já usada
   * pra altura da parede (`wallHeight`/`wallColliderHeight`). `ShapeGeometry` gera UV também em
   * unidades de mundo (`uvs.push(vertex.x, vertex.y)`, confirmado lendo o código-fonte do
   * `three` instalado) — igual ao `WorldUVGenerator` do `ExtrudeGeometry` que motivou o cálculo
   * de `repeat` em `createVelvetNormalMap.ts`, então a textura de veludo não precisou de nenhum
   * ajuste de tiling.
   */
  /**
   * A rotação entra NEGADA aqui, e isso não é gosto: o `Shape` é desenhado no plano XY e depois
   * deitado com `geometry.rotateX(-π/2)` (linha abaixo), e essa rotação leva o Y da forma pro -Z do
   * mundo — ou seja, ESPELHA a figura em Z. A parede física (`createRingWall`) usa `(cos, sin)`
   * direto como `(x, z)`, sem espelho.
   *
   * Com o hexágono isso nunca apareceu por acaso: espelhar um polígono regular com vértice em 0°
   * devolve o mesmo conjunto de vértices. Girar quebra essa coincidência, e aí o triângulo desenhado
   * apontava para um lado enquanto a parede que segura os dados apontava pro outro.
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
 * Quanto a MESA fica abaixo do chão da bandeja — é isso que dá altura pra caixa da base existir,
 * já que o chão da bandeja não pode sair de y=0 (ver o comentário de `PLATFORM_BASE_Y`).
 *
 * Exportado porque tudo que se apoia na mesa tem que descer junto ou fica flutuando: o estojo de
 * dados e a pelúcia, os dois posicionados em `DiceCanvasMulti.tsx`. Só vale pro modo BANDEJA — a
 * torre monta a mesa por conta própria, com a base dela apoiada no chão.
 */
export const TABLE_DROP = 0.75

/**
 * Y de MUNDO da superfície de grama — o que se apoia na mesa (estojo, pelúcia) deve usar ISTO, e
 * não `-TABLE_DROP`. O tampo nasce 0.03 abaixo da origem do grupo da mesa, e essa diferença some
 * na conta se cada um resolver por fora.
 */
export const TABLE_SURFACE_Y = -TABLE_DROP - 0.03

/**
 * Plataforma copiada da referência que o usuário deixou em `ideias/plataforma ideia.webp`: uma
 * bandeja hexagonal de MDF cortada a laser (Forja Fantasy). A primeira tentativa aqui foi uma
 * escadaria de PEDRA, tipo base de coliseu, e ele reprovou — a referência não é de pedra nem tem
 * degraus. O que ela tem, e é o que define a peça:
 *
 * 1. uma CAIXA hexagonal baixa embaixo, de raio maior que a bandeja;
 * 2. um ABA/REBORDO plano correndo em volta do topo dessa caixa, SALTANDO pra fora dela — é essa
 *    sobra em balanço que faz a peça ler como "bandeja montada sobre uma base", e não como uma
 *    caixa só;
 * 3. o chão dos dados FUNDO em relação a esse rebordo (na foto, a superfície plana em volta está
 *    bem acima dos dados);
 * 4. os RASGOS escuros do corte a laser — os encaixes queimados nas bordas. É o detalhe que diz
 *    "MDF cortado a laser" em vez de "madeira maciça".
 *
 * SEGUNDA leitura da foto, depois de o usuário dizer que ainda não estava igual. A primeira punha
 * a aba ALTA e o chão de veludo FUNDO no meio, tipo poço — e ampliando a foto (`ideias/`, canto da
 * frente) dá pra ver que não é isso: o chão dos dados é a superfície de CIMA, e a aba é a sobra do
 * próprio painel do chão passando por fora das paredes, em balanço sobre a caixa. O chão fica no
 * máximo uma espessura de MDF abaixo do topo da aba, não meio palmo.
 *
 * A consequência é que a bandeja inteira tem que subir: a peça da foto é uma caixa ELEVADA sobre a
 * mesa, não um hexágono deitado na grama. Como o chão da bandeja está preso em y=0 (é onde mora o
 * collider físico, `createBoundaryColliders.ts`, e mexer nele mexeria na física de tudo), quem
 * desce é a MESA — `TABLE_DROP`. Aí sobra altura real embaixo do chão pra caixa existir.
 */
const PLATFORM_BASE_Y = -TABLE_DROP - 0.02
/** Topo da caixa de baixo, logo acima do chão da bandeja. */
const PLATFORM_BOX_TOP = 0.02
/**
 * Topo da aba. Baixa de propósito: é a espessura de um painel passando rente ao chão, e não um
 * murinho. Nessa altura ela nem chega perto de atrapalhar a vista dos dados encostados na parede
 * da frente — problema que a versão anterior, com a aba em 0.58, tinha que calcular pra evitar.
 */
const PLATFORM_RIM_TOP = 0.15
/** Quanto a caixa de baixo cresce além da bandeja. */
const PLATFORM_BOX_OFFSET = 0.78
/**
 * Quanto a aba cresce além da bandeja — maior que a caixa, e é essa diferença que vira o balanço.
 *
 * O balanço é PEQUENO (0.18) por causa do ângulo da câmera, não por gosto. Na foto ele é bem mais
 * generoso, mas a foto é tirada quase da altura da mesa; a nossa câmera chega no rebordo da frente
 * a ~60° de elevação, e nesse ângulo uma aba que avança `O` esconde `O·tan(60°) ≈ 1.7·O` de altura
 * da caixa embaixo. Com o balanço de 0.45 da primeira tentativa, a caixa inteira (0.77) ficava
 * tapada pela própria aba e a bandeja voltava a parecer um aro de madeira deitado na grama —
 * conferido numa captura, foi o que motivou o acerto. Com 0.18 sobra ~0.46 de caixa aparecendo.
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
 * Altura da parede VISÍVEL acima da aba. Nada a ver com `TRAY_CONFIG.wallHeight` (1.8), que era a
 * altura da casca vazada antiga, nem com `wallColliderHeight`, que é a contenção física e não muda.
 *
 * O número sai de um limite de visão, não de gosto. Uma parede maciça de altura `h` tapa uma faixa
 * do chão colada nela: a reta que sai da câmera (0, 13, 14.65) e raspa o topo interno da parede
 * chega ao chão a `6.5 - 8.15·h/(13-h)`. Com os 1.8 de antes isso esconderia 1.3 de bandeja na
 * frente — dado inteiro. Com 0.75 a faixa cai pra ~0.5, o bastante pra continuar vendo a face de
 * cima (que é a que se lê) de um dado encostado na parede da frente. Foi por não caber parede
 * maciça em 1.8 que a versão antiga precisava do truque do `BackSide`.
 */
const WALL_VISUAL_HEIGHT = 0.75

/**
 * Anel hexagonal maciço: o hexágono externo com um hexágono FURADO no meio, extrudado. Um prisma
 * cheio não serviria — ele taparia o chão de veludo da bandeja, já que os degraus são mais altos
 * que ele.
 *
 * O furo usa exatamente a mesma volta de `createHexShape` (primeiro vértice em `(raio, 0)`), então
 * as quinas do anel caem nas mesmas direções das quinas do chão e da parede. É o mesmo cuidado que
 * o `thetaStart` da parede documenta: em hexágono, um desalinhamento de ângulo não passa
 * despercebido como passaria num cilindro liso.
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
 * Base + rebordo de MDF em volta do hexágono, copiando `ideias/plataforma ideia.webp` (ver o
 * comentário grande em `PLATFORM_BASE_Y`).
 *
 * Só visual, sem collider nenhum — a contenção dos dados continua sendo a parede física de sempre
 * (`createBoundaryColliders.ts`), e nada aqui pode mudar o resultado de uma rolagem.
 *
 * Usa o MESMO material de madeira da parede da bandeja (só que `FrontSide`, já que a parede é
 * `BackSide` de propósito), então a peça toda lê como uma bandeja só e a cor escolhida na aba
 * Estilo continua mandando na madeira inteira, sem configuração nova.
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
   * A PAREDE, agora um anel MACIÇO (com espessura e topo de verdade) nascendo da aba, em vez da
   * casca vazada de antes.
   *
   * Isto foi o "o problema são as paredes": a parede era um cilindro renderizado só por dentro
   * (`BackSide`), o que fazia a da frente desaparecer por completo. Da câmera a bandeja ficava
   * torta — parede alta no fundo, nada na frente, só a aba plana — enquanto na foto a bandeja é
   * uma caixa rasa com parede visível dando a volta inteira.
   *
   * A cara interna fica no MESMO raio do collider físico (`TRAY_CONFIG.apothem`), então o dado
   * bate exatamente na superfície que se vê, não numa parede invisível deslocada.
   */
  ring(
    circumradius,
    circumradius + WALL_THICKNESS,
    PLATFORM_RIM_TOP - 0.04,
    PLATFORM_RIM_TOP + WALL_VISUAL_HEIGHT
  )

  /**
   * SEM os rasgos queimados do corte a laser (os retângulos escuros na aba) nem as juntas
   * verticais nas quinas da caixa: eram fiéis à foto, mas na escala da cena viravam um tracejado
   * preto em volta da bandeja, e o usuário pediu pra tirar. A madeira sustenta a leitura sozinha.
   */

  return group
}

/**
 * A parede hexagonal era um `CylinderGeometry` aberto, renderizado só por dentro (`BackSide`), e
 * foi removida daqui — hoje ela é o anel maciço montado em `createArenaPlatform`, junto com a
 * caixa e a aba, porque a referência de MDF pede parede com espessura e topo visíveis dando a
 * volta inteira.
 *
 * Fica registrado o que aquela versão tinha de sutil, porque vale pra QUALQUER hexágono novo aqui:
 * ela precisava de `thetaStart: -Math.PI / 2`. `CylinderGeometry` sem isso põe o primeiro vértice
 * em `(0, raio)` (eixo +Z), enquanto `createHexShape`/`createRingWall` (chão e collider físico, que
 * já concordavam entre si) põem o deles em `(raio, 0)` (eixo +X). Num polígono de 6 lados essa
 * diferença de 90° não é múltiplo dos 60° entre vértices, então os hexágonos ficam visivelmente
 * desencontrados — foi bug relatado pelo usuário ("hexágono, parede e veludo em vértices
 * diferentes") e confirmado comparando os vértices das duas geometrias num script isolado. O anel
 * atual nasce do próprio `createHexShape`, então já concorda com o chão por construção.
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
 * `wallColor`/`backgroundColor` (Preferências ⚙️/aba de estilo) são as duas únicas coisas
 * customizáveis na cena além dos dados — pedido explícito do usuário depois de temas prontos
 * (cerca/floresta) terem saído feios: em vez de temas fixos, cor livre pra parede e fundo,
 * igual já funciona pra cor do dado.
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
   * Parede OPACA, renderizando só a face de dentro (`BackSide`) — BUG REAL relatado pelo
   * usuário como "as cores não funcionam": antes era `transparent: true, opacity: 0.35` +
   * `DoubleSide`, ou seja, a cor escolhida em "Cor da parede" aparecia diluída a 35% por cima
   * do chão/apron (bem mais claros), então escolher um marrom-couro escuro (`TRAY_PRESETS`,
   * `#241a12`) resultava numa faixa bege clara na tela — nada parecido com o que o seletor de
   * cor mostrava. Confirmado ao vivo comparando o swatch da aba Estilo com a bandeja
   * renderizada, não deduzido.
   *
   * A transparência existia pra parede da frente não tampar os dados. `BackSide` resolve o
   * mesmo problema SEM mexer na cor: as normais do cilindro apontam pra fora, então os
   * segmentos da frente (normal virada pra câmera) são descartados e os do fundo (normal
   * virada pra longe) aparecem — é exatamente o "olhar pra dentro de uma bandeja aberta", com
   * a cor exata escolhida.
   */
  /**
   * Veio de madeira na parede — pedido do usuário ("o hexágono deixa mais rústico, algo como
   * madeira"). O mapa é neutro e MULTIPLICA a cor escolhida na aba Estilo (ver
   * `createWoodTexture.ts`), então a bandeja fica rústica sem perder a customização de cor: o
   * marrom padrão vira madeira escura, um preset claro vira madeira clara.
   *
   * Um ladrilho por LADO do hexágono (`WOOD_WALL_REPEAT` = `wallSegments`), pras tábuas
   * acompanharem as faces em vez de atravessarem as quinas na diagonal.
   */
  const wood = createWoodTextures(WOOD_WALL_REPEAT)
  /**
   * UM material de madeira só pra bandeja inteira — caixa, aba e parede. A parede tinha o seu
   * próprio, com `side: BackSide`, porque ela era uma casca vazada e precisava sumir do lado da
   * câmera; agora que ela é um anel maciço (ver `createArenaPlatform`), esse truque não é mais
   * necessário e os dois materiais viraram um.
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
