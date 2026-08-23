import * as THREE from 'three'
import { buildTowerShellGeometry } from '../geometry/buildTowerShellGeometry'
import {
  TOWER_BESIDE_CONFIG,
  TOWER_BESIDE_GATE_ANGLE,
  computeTowerBesideLayout,
  type TowerBesideLayout
} from '../geometry/towerBesideTrayLayout'
import { TRAY_CONFIG } from '../config/physicsConfig'
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
  /**
   * Um quadro de animação da torre, com o tempo da cena em SEGUNDOS. Hoje só a bandeira usa.
   *
   * Fica no handle, e não num laço próprio dentro da torre: quem manda no tempo é a cena (ver o
   * `tick` em `DiceCanvasMulti`), que já para de desenhar com a aba escondida. Uma torre com
   * `requestAnimationFrame` próprio continuaria calculando pano invisível pra sempre.
   */
  update: (elapsedSeconds: number) => void
  /**
   * A PONTE LEVADIÇA, pra quem quiser abrir e fechar. A cena precisa de duas coisas dela: o alvo do
   * clique (`folha`) e o controle da animação (`definirAbertura`).
   */
  ponte: DrawbridgeHandle
}

interface BrickFactory {
  /**
   * Material de tijolo pra uma peça de `width` × `height` no mundo.
   *
   * `pedra` diz o tamanho DA PEDRA daquela peça, e existe pras peças aparelhadas do portão. Sem
   * isso, todas herdavam o tijolo da casca e o encolhimento automático transformava a ombreira em
   * vinte fiadas de pedrinha — que é alvenaria de parede, não a cantaria que emoldura um vão.
   */
  (width: number, height: number, pedra?: { largura: number; altura: number }): THREE.MeshStandardMaterial
  /** Todos os materiais já criados — pra tingir todos de uma vez em `updateColors`. */
  materials: THREE.MeshStandardMaterial[]
}

/**
 * Material de tijolo, com cache. O tamanho do tijolo é O MESMO pra torre inteira — quem o escolhe é
 * quem cria a fábrica, a partir da casca.
 *
 * Ele já foi derivado de cada PEÇA ("~3 tijolos na largura, ~4 fiadas na altura"), e o usuário viu
 * o resultado: "os tijolos do portão estão mt feios, tem uma linha para 7 tijolos, e os tijolos dos
 * bicos da torre lá em cima também". A conta por peça fazia uma ameia de 35cm receber quatro
 * fiadas de tijolo minúsculo enquanto a casca de 3.6 recebia quatro fiadas de tijolo grande — duas
 * alvenarias diferentes na mesma construção, e a menor lia como listra.
 *
 * Alvenaria de verdade tem um tijolo só pro prédio inteiro: numa ameia cabe menos de um, e é assim
 * que tem que ser. É a primeira das duas saídas que ele ofereceu ("faz eles igual a torre padrão ou
 * então apenas um tijolo grande"), e a que mantém a torre parecendo de pedra.
 *
 * O `repeat` da textura sai das medidas reais da superfície (ver `createBrickTexture`), então uma
 * ameia e a casca inteira precisam de texturas diferentes pra mostrarem tijolos do mesmo tamanho no
 * mundo. Sem o cache seria um canvas 256×256 e um mapa de normais por peça — e só de ameias e
 * aduelas são quase vinte.
 */
function createBrickMaterialFactory(stoneColor: number, brickWidth: number, brickHeight: number): BrickFactory {
  const cache = new Map<string, THREE.MeshStandardMaterial>()
  const materials: THREE.MeshStandardMaterial[] = []

  const factory = ((width: number, height: number, pedra?: { largura: number; altura: number }) => {
    const key = `${width.toFixed(2)}x${height.toFixed(2)}x${pedra ? `${pedra.largura.toFixed(2)}x${pedra.altura.toFixed(2)}` : 'padrao'}`
    const cached = cache.get(key)
    if (cached) return cached
    const { map, normalMap } = createBrickTexture(
      NEUTRAL_BRICK,
      NEUTRAL_MORTAR,
      width,
      height,
      pedra?.largura ?? brickWidth,
      pedra?.altura ?? brickHeight,
      // Pedra escolhida a dedo não passa pelo encolhimento automático — ver o parâmetro lá.
      pedra === undefined
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

/**
 * As AMEIAS em volta do bico — os doze blocos de pedra no alto da casca, entre a cornija e o
 * telhado cônico.
 *
 * Desligadas a pedido do usuário ("vamos tirar esses tijolos ao redor do bico da torre para ver como
 * fica"). Ficam atrás de um interruptor, e não apagadas, porque o pedido é explicitamente um teste
 * de aparência: voltar é trocar `false` por `true`.
 */
const MOSTRA_AMEIAS_DO_TOPO = false

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
 * NÃO existem frestas de arqueiro nesta torre, e a ausência é deliberada — foram TENTADAS DUAS
 * VEZES e removidas nas duas.
 *
 * A primeira versão punha uma pedra de verga em cima de cada fresta: no tamanho delas a textura
 * entregava dois tijolos claros sobre argamassa escura, e o conjunto lia como uma etiqueta listrada
 * grudada na parede. A segunda tirou a verga e deixou só o vão escuro (`0x0a0908`), quatro caixinhas
 * chapadas assentadas 0.015 PRA FORA da casca — e o usuário as viu pelo que elas eram: "tira essas
 * barras pretas na torre". Numa parede curva, um retângulo preto colado por cima não lê como buraco;
 * lê como adesivo, porque não tem nem profundidade nem sombra própria.
 *
 * O que funcionaria é o que o PORTÃO faz: recorte de verdade na geometria da casca
 * (`buildTowerShellGeometry`), com espessura de parede aparecendo na borda. Enquanto isso não
 * existir pra mais de um vão, a torre fica sem frestas — a silhueta dela já vem das ameias, da
 * cornija, do arco e das tochas.
 */
/**
 * Arco de ADUELAS sobre o portão. O recorte da casca é retangular (`buildTowerShellGeometry`), e
 * portão reto é vocabulário de galpão; o arco é o que data a construção. Cada aduela é uma peça
 * independente girando ao longo da meia-volta, como numa abóbada de verdade, e não um desenho.
 */
/**
 * As sete ADUELAS que arqueavam por cima do vão. Desligadas junto com os mini tijolos: com as três
 * pedras grandes emoldurando a porta, elas voltavam a picar o contorno em bloquinhos, que é
 * exatamente o que o usuário mandou tirar.
 *
 * Atrás de interruptor, como as ameias do topo — os dois são teste de aparência, e voltar é trocar
 * `false` por `true`.
 */
const MOSTRA_ARCO_DE_ADUELAS = false

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
  /**
   * Cada aduela é UMA PEDRA, e por isso pede pedra do tamanho dela mesma.
   *
   * Sem isso ela herdava o tijolo da casca e o encolhimento automático punha uns seis tijolinhos
   * dentro de cada bloco do arco — o usuário viu e mandou tirar ("tira esses mini tijolos da
   * portinha"). E ele está certo pela construção, não só pelo gosto: arco de pedra é feito de
   * aduelas inteiras encaixadas, uma pedra por bloco. Alvenaria miúda dentro de uma aduela é uma
   * contradição.
   */
  const material = brick(blockWidth, blockHeight, { largura: blockWidth, altura: blockHeight })
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
/** Uma tocha viva: a chama e a luz dela, pra quem anima poder mexer nas duas juntas. */
interface TochaViva {
  chama: THREE.Mesh
  material: THREE.MeshStandardMaterial
  luz: THREE.PointLight
  /** Defasagem própria, pra as três não piscarem em uníssono. */
  fase: number
}

export interface TorchesHandle {
  group: THREE.Group
  update: (segundos: number) => void
}

function createTorches(radius: number, gateArcWidth: number, gateHeight: number): TorchesHandle {
  const group = new THREE.Group()
  const halfAngle = gateArcWidth / 2 / radius
  const baseAngle = TOWER_BESIDE_GATE_ANGLE + halfAngle * 1.75
  const y = gateHeight + radius * 0.28

  const metal = new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.55, metalness: 0.4 })
  const vivas: TochaViva[] = []

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

    /**
     * MATERIAL PRÓPRIO por tocha, e não um compartilhado pelas três.
     *
     * O brilho da chama entra na animação (`emissiveIntensity`), e material compartilhado faria as
     * três acenderem e apagarem exatamente juntas — que é o que denuncia fogo falso mais rápido que
     * qualquer outra coisa. Três materiais é barato; sincronia não tem conserto depois.
     *
     * A chama é emissiva porque a luz sai DELA: sem isso ela ficaria escura como qualquer objeto.
     */
    const material = new THREE.MeshStandardMaterial({
      color: TORCH_FLAME_COLOR,
      emissive: TORCH_FLAME_COLOR,
      emissiveIntensity: 1.6,
      roughness: 1
    })
    const chama = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.07, radius * 0.2, 10), material)
    chama.position.copy(basket.position).setY(y + radius * 0.17)
    group.add(chama)

    const luz = new THREE.PointLight(TORCH_LIGHT_COLOR, 4.5, radius * 4.5, 2)
    luz.position.copy(chama.position)
    group.add(luz)

    // Defasagem por índice, não aleatória: o fogo tem que ser o mesmo a cada montagem da cena.
    vivas.push({ chama, material, luz, fase: i * 2.399 })
  }

  const alturaDeRepouso = vivas[0]?.chama.position.y ?? 0
  return {
    group,
    /**
     * O TREMOR do fogo, por soma de duas ondas de frequências que não se dividem (7.3 e 11.7 por
     * segundo).
     *
     * Uma onda só dá pulso de sinaleiro — o olho pega a batida na hora. Duas incomensuráveis nunca
     * repetem o mesmo desenho, que é o que faz parecer chama e não pisca-pisca. É a mesma ideia que
     * a bandeira usa pra ondular (ver `createFlag`).
     *
     * Três coisas mexem juntas, e é a combinação que vende o fogo: a chama ESTICA e afina (volume
     * de fogo não muda, a forma sim), o brilho dela sobe e desce junto, e a LUZ no chão acompanha —
     * chama que cresce sem clarear a parede lê como enfeite de plástico.
     */
    update(segundos) {
      for (const { chama, material, luz, fase } of vivas) {
        const tremor =
          Math.sin(segundos * 7.3 + fase) * 0.6 + Math.sin(segundos * 11.7 + fase * 1.7) * 0.4
        const estica = 1 + tremor * 0.18
        chama.scale.set(1 - tremor * 0.09, estica, 1 - tremor * 0.09)
        // A base fica no cesto: crescer pra cima, e não pros dois lados, que é como fogo sobe.
        chama.position.y = alturaDeRepouso + (estica - 1) * 0.1
        material.emissiveIntensity = 1.6 + tremor * 0.28
        luz.intensity = 4.5 + tremor * 0.9
      }
    }
  }
}

/**
 * PONTE LEVADIÇA abaixada, saindo do vão do portão em direção ao hexágono — pedido do usuário, com
 * referências em `ideias/` (a ponte do Castillo Jagua e duas ilustrações de castelo). O que as três
 * têm em comum, e o que está desenhado aqui: tabuleiro de pranchas no comprimento, ferragem
 * atravessada, e corrente subindo de cada canto de fora até a parede acima da verga.
 *
 * Ela ocupa o lugar da SOLEIRA de pedra, e é isso que torna a mudança barata: a soleira já era uma
 * laje saindo da boca por cima da bandeja, e o dado já nascia em cima dela e a atravessava rolando
 * (ver `createMouthSill`, que continua embaixo da dobradiça como degrau curto). O tabuleiro fica no
 * MESMO plano em que a laje estava, então a relação entre o dado e o que ele pisa não mudou —
 * nenhum número de física foi tocado, e nenhum precisou ser.
 *
 * Sem collider, como todo o resto da torre: nada aqui participa da simulação. O dado nasce na boca
 * (`tossDieFromMouth`) e sobe em arco pra dentro do hexágono, passando ACIMA do tabuleiro.
 */
export interface DrawbridgeHandle {
  grupo: THREE.Group
  /**
   * Só a FOLHA que gira, e é ela o alvo do clique — não o grupo inteiro. As correntes ficam de
   * fora de propósito: elas são fios finos espalhados pelo vão, e aceitar clique nelas faria a
   * ponte abrir quando a pessoa mirou na torre atrás.
   */
  folha: THREE.Group
  /**
   * 1 = abaixada (passagem aberta, como a ponte sempre esteve), 0 = levantada (portão fechado).
   * Valores no meio são a animação.
   */
  definirAbertura: (abertura: number) => void
}

function createDrawbridge(layout: TowerBesideLayout, deckMaterial: THREE.Material): DrawbridgeHandle {
  const { radius, gateArcWidth, gateHeight, seatDistance, apothem } = layout
  const grupo = new THREE.Group()

  /**
   * A DOBRADIÇA fica na face da casca (`radius`), e o tabuleiro é cortado ali em dois: o pedaço de
   * dentro (que está enfiado sob o arco) fica parado como soleira, e o de fora é a folha que
   * levanta.
   *
   * Cortar é o que evita o defeito de girar o tabuleiro inteiro em torno de um ponto no meio dele:
   * o pedaço de dentro desceria por baixo do piso do arco e apareceria pendurado no vão embaixo do
   * portão, porque o plinto da torre tem o raio da casca (`plinthOverhang` é 0) e não esconderia
   * nada. Com o corte, o que gira começa exatamente onde a torre acaba.
   *
   * Levantada, a folha fica no plano `x = radius`, que é justamente o VÃO do portão: os pilares da
   * ombreira flanqueiam o vão em ±`gateArcWidth/2` e o tabuleiro tem 0.85 dessa largura, então ela
   * sobe ENTRE eles, sem raspar em pedra nenhuma. Medido: a folha tem 1.41 de comprimento contra um
   * vão de 1.49 de altura, ou seja, tampa o portão quase inteiro, como uma ponte levadiça fechada.
   */
  const folha = new THREE.Group()
  folha.position.x = radius
  grupo.add(folha)

  /**
   * Onde o tabuleiro COMEÇA e ONDE TERMINA, em distância do eixo da torre.
   *
   * Começa colado na casca e termina em cima do MEIO da parede do hexágono — as duas pontas são
   * medidas, não escolhidas. A de fora sai de `seatDistance - (apótema + espessura/2)`: é
   * exatamente a borda que a ponte precisa alcançar pra parecer que liga a torre à bandeja, e é o
   * ponto onde ela para de avançar sobre a área de jogo.
   *
   * O comprimento, então, é consequência de `shellGap`: quanto mais longe a torre senta, mais
   * comprida a ponte fica. Com a folga de 0.75 dá 0.9 de vão — uma ponte, e não o degrau quadrado
   * que era com 0.15.
   */
  /**
   * Entra 0.3 pra DENTRO da casca, e não 0.05.
   *
   * Com 0.05 o tabuleiro parava rente à face externa e sobrava um vão entre ele e o piso do arco —
   * visível de cima, e é por ele que o dado sairia pisando no vazio. Enfiado sob o arco, o tampo da
   * ponte vira a continuação do piso da boca, que é o que este comentário sempre disse que ela era.
   */
  const inicio = radius - 0.3
  /**
   * DOIS CENTÍMETROS a mais de alcance, a pedido do usuário ("aumenta 2cm o tamanho dela").
   *
   * A unidade sai da mesma âncora que o resto do projeto usa: um d20 aqui tem 0.56 de lado e um d20
   * de verdade mede uns 2cm de face a face, então 2cm = 0.56 de mundo. Não é um decimal escolhido —
   * é a conversão.
   *
   * O acréscimo é pra FORA, então a ponte passa a avançar meio palmo além do meio da parede do
   * hexágono, pairando 0.6 acima da borda. Ela é decorativa (não tem collider), então isso não muda
   * rolagem nenhuma: o que muda é que agora ela LIGA a torre à bandeja em vez de parar antes.
   */
  const DOIS_CENTIMETROS = 0.56
  const fim = seatDistance - (apothem + TRAY_CONFIG.wallThickness / 2) + DOIS_CENTIMETROS
  const comprimento = fim - inicio
  const largura = gateArcWidth * 0.85
  const espessura = 0.08

  /**
   * O tampo fica em y=0 LOCAL, que é o piso do arco (a base da torre, ver `baseY` no layout) — a
   * ponte é a continuação do chão da boca saindo pra fora, e é sobre ela que o dado nasce apoiado.
   *
   * Ela não desce até encostar na borda da bandeja, que está 0.6 abaixo: o dado sai da boca na
   * HORIZONTAL, então qualquer rampa descendo ficaria no caminho dele e o dado voltaria a atravessar
   * madeira. Ponte levadiça pendurada nas correntes, sem tocar o outro lado, é o que a foto de
   * referência (`ideias/ponte-levadiça...`) mostra também.
   */
  /**
   * Os dois pedaços em que o tabuleiro é cortado pela dobradiça. A SOLEIRA é o que fica sob o arco
   * e não se mexe; a FOLHA é o que levanta. Somados, dão o mesmo tabuleiro de antes, e com a ponte
   * abaixada as peças caem exatamente onde sempre estiveram — o corte não é visível, é a emenda
   * onde a dobradiça está.
   */
  const soleiraComprimento = radius - inicio
  const folhaComprimento = fim - radius

  const quantas = 6
  const fatia = largura / quantas
  for (let i = 0; i < quantas; i++) {
    /**
     * As LISTRAS entre as tábuas voltaram (0.88 de fatia), mas agora elas não VAZAM: existe um
     * estrado por baixo (logo acima) fechando o tabuleiro.
     *
     * A primeira versão tinha a fresta e nada atrás dela — de cima dava pra ver o chão entre as
     * tábuas, e o tabuleiro lia como grade. Fechei encostando as tábuas, e aí o usuário sentiu falta
     * do desenho ("coloca as listras da ponte de volta"): as duas coisas eram separáveis, e a peça
     * que faltava era o estrado, não a fresta.
     */
    const z = (i + 0.5) * fatia - largura / 2
    /**
     * O tampo fica 0.004 ACIMA do piso do arco, não exatamente nele.
     *
     * Com a ponte entrando por baixo do arco, as duas superfícies ficaram coplanares em y=0 e o
     * z-fighting apareceu como um chuvisco na emenda (visto de cima na renderização). Quatro
     * milésimos separam as duas sem criar degrau: o dado tem 0.56, ele não sente isso.
     */
    const y = -espessura / 2 + 0.004

    const soleira = new THREE.Mesh(
      new THREE.BoxGeometry(soleiraComprimento, espessura, fatia * 0.88),
      deckMaterial
    )
    soleira.position.set(inicio + soleiraComprimento / 2, y, z)
    soleira.castShadow = true
    soleira.receiveShadow = true
    grupo.add(soleira)

    // Na folha o x é relativo à dobradiça, que já está em `radius`.
    const prancha = new THREE.Mesh(
      new THREE.BoxGeometry(folhaComprimento, espessura, fatia * 0.88),
      deckMaterial
    )
    prancha.position.set(folhaComprimento / 2, y, z)
    prancha.castShadow = true
    prancha.receiveShadow = true
    folha.add(prancha)
  }

  /**
   * ESTRADO: uma tábua inteira por baixo das seis, que é o que uma ponte de verdade tem — as tábuas
   * do tampo são pregadas em cima de um estrado, não flutuam lado a lado.
   *
   * É ele que deixa as listras serem listras: sem o estrado, a fresta entre as tábuas é um buraco
   * até o chão; com ele, é uma linha escura de sombra.
   */
  const estradoY = -espessura - espessura * 0.2
  const estradoSoleira = new THREE.Mesh(
    new THREE.BoxGeometry(soleiraComprimento, espessura * 0.55, largura),
    deckMaterial
  )
  estradoSoleira.position.set(inicio + soleiraComprimento / 2, estradoY, 0)
  estradoSoleira.castShadow = true
  estradoSoleira.receiveShadow = true
  grupo.add(estradoSoleira)

  const estrado = new THREE.Mesh(
    new THREE.BoxGeometry(folhaComprimento, espessura * 0.55, largura),
    deckMaterial
  )
  estrado.position.set(folhaComprimento / 2, estradoY, 0)
  estrado.castShadow = true
  estrado.receiveShadow = true
  folha.add(estrado)

  /**
   * Ferragem FOSCA (metalness 0.2), não polida. Com 0.45, que é o valor da ferragem da torre, as
   * cintas pegavam o ambiente inteiro e saíam cinza-claras — duas barras brilhantes atravessadas
   * numa ponte de madeira escura, que foi o que a primeira renderização mostrou.
   */
  const ferro = new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.72, metalness: 0.2 })

  // Cintas atravessando as pranchas: é o que amarra seis tábuas soltas num tabuleiro só. Rentes ao
  // tampo (sobressaem 0.01), porque cinta de ponte é chapa pregada, não viga por cima.
  for (const fracao of [0.18, 0.86]) {
    const cinta = new THREE.Mesh(new THREE.BoxGeometry(0.09, espessura * 0.5, largura * 0.99), ferro)
    // As duas caem do lado de FORA da dobradiça (0.18 do comprimento já passa dela), então as duas
    // sobem com a folha — daí o x descontado de `radius`, como o resto do que está aqui dentro.
    cinta.position.set(inicio + comprimento * fracao - radius, -espessura * 0.5 + 0.01, 0)
    cinta.castShadow = true
    folha.add(cinta)
  }

  /**
   * CORRENTES, uma de cada canto de fora até a parede acima da verga. São elas que dizem
   * "levadiça" — sem elas o tabuleiro é só uma prateleira de madeira, e aqui, com a ponte
   * pendurada sobre o vão sem tocar o outro lado, são elas que explicam o que a segura.
   *
   * A quantidade de elos sai do COMPRIMENTO do vão, não de um número escolhido: com oito elos fixos
   * (a primeira tentativa) eles ficavam a meio palmo um do outro e liam como rebites espalhados
   * pelo pilar, não como corrente. O passo é 1.6 raio de elo, que é o encaixe de uma corrente real.
   */
  const raioElo = 0.045
  const passoDoElo = raioElo * 1.6
  const elo = new THREE.TorusGeometry(raioElo, 0.013, 6, 10)
  /**
   * As correntes ficam FORA da folha, e é isso que faz elas funcionarem: uma corrente presa na
   * parede e na quina do tabuleiro tem uma ponta parada e outra que se move. Se fossem filhas da
   * folha, girariam junto e a ponta de cima descolaria da parede.
   */
  const correntes: { ancora: THREE.Vector3; elos: THREE.Mesh[] }[] = []
  for (const lado of [-1, 1] as const) {
    /**
     * Um pouco PARA DENTRO da quina do tabuleiro (0.40 da largura, e não 0.46): nos 0.46 a corrente
     * caindo passava rente aos pilares do portão, que ficam a `gateArcWidth / 2`, e as duas coisas
     * se enterravam uma na outra. Puxada pra dentro, ela desce livre na frente do vão.
     */
    /**
     * Na QUINA do tabuleiro, e um fio pra fora dele (0.52 da largura, contra os 0.40 de antes).
     *
     * Em 0.40 a corrente descia por DENTRO da largura da ponte: de cima ela aparecia deitada em cima
     * das tábuas, e de três-quartos parecia atravessar a madeira. Corrente de ponte levadiça prende
     * na quina, por fora — e aqui cabe: a quina está em 0.801 e o pilar do portão em 0.943, então
     * sobra folga de 0.11 pra ela descer livre sem raspar em nada.
     */
    const z = lado * largura * 0.52
    const ancora = new THREE.Vector3(radius * 0.98, gateHeight + radius * 0.3, z)
    // Ponta na BORDA de fora do tampo (o `fim`), que é onde a corrente de verdade se prende.
    const pontaAbaixada = new THREE.Vector3(fim, 0, z)
    /**
     * A quantidade de elos sai do MAIOR vão possível, que é com a ponte abaixada — levantar só
     * aproxima a ponta da âncora. Levantando, os elos que sobram são escondidos e o passo entre os
     * que ficam continua o mesmo: a corrente ENCURTA, que é o que uma corrente de verdade faz, em
     * vez de esticar os mesmos elos até virarem uma sanfona.
     */
    const maximoDeElos = Math.max(6, Math.round(ancora.distanceTo(pontaAbaixada) / passoDoElo))
    const elos: THREE.Mesh[] = []
    for (let i = 0; i < maximoDeElos; i++) {
      const malha = new THREE.Mesh(elo, ferro)
      grupo.add(malha)
      elos.push(malha)
    }
    correntes.push({ ancora, elos })
  }

  /**
   * Põe as correntes onde a ponta da folha está no ângulo `anguloRad` (0 = abaixada).
   *
   * A ponta se move num arco em volta da dobradiça, e é só isso que a conta faz — a mesma rotação
   * que a folha sofre, aplicada ao ponto de amarração. Não há como as duas saírem de sincronia
   * porque as duas leem o mesmo ângulo.
   */
  const EIXO_X = new THREE.Vector3(1, 0, 0)
  const pontaMovel = new THREE.Vector3()
  const direcaoDaCorrente = new THREE.Vector3()
  function posicionarCorrentes(anguloRad: number): void {
    const alcance = fim - radius
    for (const { ancora, elos } of correntes) {
      pontaMovel.set(
        radius + alcance * Math.cos(anguloRad),
        alcance * Math.sin(anguloRad),
        ancora.z
      )
      direcaoDaCorrente.copy(pontaMovel).sub(ancora)
      const distancia = direcaoDaCorrente.length()
      if (distancia < 1e-6) continue
      direcaoDaCorrente.divideScalar(distancia)

      const visiveis = Math.max(2, Math.min(elos.length, Math.round(distancia / passoDoElo)))
      elos.forEach((malha, i) => {
        malha.visible = i < visiveis
        if (!malha.visible) return
        malha.position.lerpVectors(ancora, pontaMovel, (i + 0.5) / visiveis)
        /**
         * O plano de cada elo CONTÉM a direção da corrente, e os ímpares giram 90° em torno dela — é
         * assim que uma corrente é feita.
         *
         * A primeira versão fazia `lookAt(para)` e `rotateZ`, e saiu uma MOLA: `lookAt` aponta o +Z
         * do toro pra direção da corrente, o que deixa o anel PERPENDICULAR a ela (um disco visto de
         * lado), e girar em Z um toro cujo eixo é Z não muda absolutamente nada. Mapeando o +X (que
         * está no plano do anel) pra direção, o eixo do toro cai perpendicular a ela, que é o certo,
         * e aí girar em X — agora o eixo da corrente — alterna de verdade.
         */
        malha.quaternion.setFromUnitVectors(EIXO_X, direcaoDaCorrente)
        if (i % 2 === 1) malha.rotateX(Math.PI / 2)
      })
    }
  }

  /**
   * O grupo nasce com +X apontando PRA FORA do portão e +Z na largura dele, e só depois é girado
   * pro ângulo do vão. Escrever direto no eixo do mundo funcionaria hoje (o portão está em π, onde
   * o radial é exatamente -X), mas amarraria a ponte a esse valor.
   */
  const radial = new THREE.Vector3(Math.cos(TOWER_BESIDE_GATE_ANGLE), 0, Math.sin(TOWER_BESIDE_GATE_ANGLE))
  grupo.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), radial)

  /** Meia volta: a folha em pé fecha o vão. Passar disso a jogaria pra dentro do arco. */
  const ANGULO_LEVANTADA = Math.PI / 2

  function definirAbertura(abertura: number): void {
    const angulo = (1 - Math.min(1, Math.max(0, abertura))) * ANGULO_LEVANTADA
    folha.rotation.z = angulo
    posicionarCorrentes(angulo)
  }

  // Nasce abaixada, que é como a ponte sempre esteve — e é o que põe as correntes no lugar.
  definirAbertura(1)

  return { grupo, folha, definirAbertura }
}

/**
 * Moldura do portão: dois pilares e a verga. A folha de madeira que ficava ABERTA ao lado do vão
 * saiu quando a ponte levadiça entrou — ver o comentário no fim desta função.
 */
function createGateStructure(
  radius: number,
  gateArcWidth: number,
  gateHeight: number,
  brick: BrickFactory
): THREE.Group {
  const group = new THREE.Group()
  const halfAngle = gateArcWidth / 2 / radius
  const radialAt = (a: number) => new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
  const tangentAt = (a: number) => new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))

  const pillarWidth = radius * 0.2
  const pillarDepth = radius * 0.26
  const pillarHeight = gateHeight + radius * 0.18
  /**
   * CANTARIA da ombreira: UMA pedra, do tamanho do pilar inteiro.
   *
   * Começou como a alvenaria da casca encolhida (vinte fiadas de pedrinha), virou quatro blocos
   * empilhados, e agora é um monólito — o usuário foi cortando a cada rodada até sobrar o essencial
   * ("deixa só o grande da direita, o grande da esquerda e o grande de cima"). O vão passa a ser
   * emoldurado por três pedras, e nada mais.
   */
  const pillarMaterial = brick(pillarWidth, pillarHeight, {
    largura: pillarWidth,
    altura: pillarHeight
  })

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
    // UMA pedra atravessando o vão inteiro — a terceira das três que emolduram a porta.
    brick(lintelWidth, lintelHeight, { largura: lintelWidth, altura: lintelHeight })
  )
  lintel.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangentAt(TOWER_BESIDE_GATE_ANGLE))
  lintel.position
    .copy(radialAt(TOWER_BESIDE_GATE_ANGLE))
    .multiplyScalar(radius)
    .setY(pillarHeight + radius * 0.11)
  lintel.castShadow = true
  group.add(lintel)

  /**
   * A FOLHA de porta saiu daqui. Era uma tábua com duas cintas de ferro, girada 180° na dobradiça
   * lateral, encostada por fora ao lado do vão — uma porta aberta. Quem faz esse papel agora é a
   * PONTE LEVADIÇA (`createDrawbridge`), a pedido do usuário, e as duas juntas eram excesso: uma
   * folha em pé do lado de uma ponte deitada, as duas em madeira, no mesmo vão de 1.89 de largura.
   * A cor `door` da torre passou pro tabuleiro da ponte, então ela continua pintando o que é de
   * madeira no portão.
   */
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

/**
 * Flâmula de RABO DE ANDORINHA (o entalhe em V na ponta) — forma de estandarte, não triângulo.
 *
 * Ela é uma MALHA de pano, não um recorte chapado, e essa foi a mudança que a fez tremular. Antes
 * era um `ShapeGeometry` a partir de um contorno de cinco pontos: bonito parado e impossível de
 * animar, porque `ShapeGeometry` só cria vértices NO CONTORNO — não há nada no meio do pano pra
 * deslocar, e empurrar os cantos só entortaria o recorte inteiro como uma placa.
 *
 * Agora o contorno é gerado por conta: uma grade `(u, v)` onde `u` vai do mastro à ponta e `v` do
 * topo à base, com a borda livre calculada por fórmula. O entalhe em V sai de `xLivre(v)`, que
 * encurta o pano no meio da altura — a mesma silhueta de antes, agora com miolo pra ondular.
 */
const FLAG_COLUNAS = 14
const FLAG_LINHAS = 8

interface FlagHandle {
  group: THREE.Group
  /** Chamado a cada quadro com o tempo da cena em SEGUNDOS. */
  update: (segundos: number) => void
}

function createFlag(tipY: number, radius: number, material: THREE.Material): FlagHandle {
  const group = new THREE.Group()
  const poleHeight = radius * 0.85

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, poleHeight, 8),
    new THREE.MeshStandardMaterial({ color: POLE_COLOR, roughness: 0.6 })
  )
  pole.position.y = tipY + poleHeight / 2
  group.add(pole)

  /**
   * As três medidas do contorno, iguais às do recorte antigo: o pano tem 0.5 de comprimento e 0.3
   * de altura (em frações do raio da torre), e o entalhe recua 0.16 no meio da altura.
   */
  const comprimento = radius * 0.5
  const altura = radius * 0.3
  const entalhe = radius * 0.16

  /** Onde a borda LIVRE está, por altura. O `1 - |2v-1|` é o V: vale 1 no meio e 0 nas pontas. */
  const xLivre = (v: number): number => comprimento - entalhe * (1 - Math.abs(2 * v - 1))
  /** Altura da borda presa ao mastro (topo a base) e da borda livre, que é mais curta — o pano afina. */
  const yMastro = (v: number): number => -altura * v
  const yLivre = (v: number): number => -altura * 0.23 - altura * 0.53 * v

  const geometry = new THREE.BufferGeometry()
  const totalVertices = FLAG_COLUNAS * FLAG_LINHAS
  const posicoes = new Float32Array(totalVertices * 3)
  /** Cópia intocada da malha em repouso: a onda é escrita SOBRE ela a cada quadro, nunca sobre o quadro anterior. */
  const repouso = new Float32Array(totalVertices * 3)
  const uvs = new Float32Array(totalVertices * 2)

  for (let linha = 0; linha < FLAG_LINHAS; linha++) {
    const v = linha / (FLAG_LINHAS - 1)
    for (let coluna = 0; coluna < FLAG_COLUNAS; coluna++) {
      const u = coluna / (FLAG_COLUNAS - 1)
      const i = linha * FLAG_COLUNAS + coluna
      repouso[i * 3] = u * xLivre(v)
      repouso[i * 3 + 1] = yMastro(v) + (yLivre(v) - yMastro(v)) * u
      repouso[i * 3 + 2] = 0
      uvs[i * 2] = u
      uvs[i * 2 + 1] = 1 - v
    }
  }
  posicoes.set(repouso)

  const indices: number[] = []
  for (let linha = 0; linha < FLAG_LINHAS - 1; linha++) {
    for (let coluna = 0; coluna < FLAG_COLUNAS - 1; coluna++) {
      const a = linha * FLAG_COLUNAS + coluna
      const b = a + 1
      const c = a + FLAG_COLUNAS
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(posicoes, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const flag = new THREE.Mesh(geometry, material)
  flag.position.y = tipY + poleHeight - 0.05
  flag.castShadow = true
  group.add(flag)

  const atributo = geometry.getAttribute('position') as THREE.BufferAttribute

  return {
    group,
    /**
     * A ONDA. Três decisões, todas visíveis se erradas:
     *
     * 1. amplitude cresce com `u²`, não linear — pano preso no mastro não se move ali, e a
     *    aceleração quadrática é o que dá o estalo característico da ponta solta. Linear faz a
     *    bandeira inteira oscilar em bloco, como uma placa numa dobradiça.
     * 2. a fase depende de `u`, então a onda VIAJA do mastro pra ponta em vez de a bandeira
     *    inteira subir e descer junto. É a diferença entre pano ao vento e um aceno.
     * 3. duas frequências somadas, uma quase o dobro da outra e mais fraca. Uma só é regular
     *    demais e lê como animação; a segunda quebra a repetição sem custar nada.
     *
     * A leve variação por `v` (a segunda onda usa a altura na fase) evita que todas as linhas
     * horizontais façam exatamente o mesmo, que é o que denuncia uma malha animada por fórmula.
     */
    update: (segundos) => {
      for (let linha = 0; linha < FLAG_LINHAS; linha++) {
        const v = linha / (FLAG_LINHAS - 1)
        for (let coluna = 0; coluna < FLAG_COLUNAS; coluna++) {
          const u = coluna / (FLAG_COLUNAS - 1)
          const i = linha * FLAG_COLUNAS + coluna
          const amplitude = u * u * altura * 0.55
          const onda =
            Math.sin(u * 7.5 - segundos * 5.5) + Math.sin(u * 4.1 + v * 2.2 - segundos * 3.1) * 0.45
          atributo.setZ(i, repouso[i * 3 + 2] + onda * amplitude)
          /**
           * O pano também ENCURTA quando ondula: um tecido que só se desloca em Z estica, e a ponta
           * some pra fora do lugar onde deveria estar. Puxar `x` por uma fração do deslocamento é a
           * aproximação barata disso — não é simulação, é o suficiente pra ponta não crescer.
           */
          atributo.setX(i, repouso[i * 3] - Math.abs(onda) * amplitude * 0.25)
        }
      }
      atributo.needsUpdate = true
      // Sem isto a luz não acompanha a ondulação e o pano fica com aparência de papel liso mexendo.
      geometry.computeVertexNormals()
    }
  }
}

export function createTowerBesideTray(
  colors: TowerColors = DEFAULT_TOWER_COLORS,
  overrides: Partial<typeof TOWER_BESIDE_CONFIG> = {},
  /** Lados da bandeja: a torre encosta no meio de uma FACE, e onde elas ficam depende da forma. */
  sides = TRAY_CONFIG.wallSegments
): TowerBesideTrayHandle {
  const config = { ...TOWER_BESIDE_CONFIG, ...overrides }
  const layout = computeTowerBesideLayout(overrides, sides)
  const { radius, height, gateArcWidth, gateHeight, seatDistance, baseY } = layout

  /**
   * O tijolo da CASCA vale pra torre inteira. Os números são os que a casca vinha recebendo pela
   * conta antiga (teto de 1.1 de largura e 0.55 de altura), agora aplicados a tudo.
   */
  const brick = createBrickMaterialFactory(colors.stone, 1.1, 0.55)
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
  if (MOSTRA_AMEIAS_DO_TOPO) tower.add(createMerlonRing(radius, height, brick))
  tower.add(createSpire(radius, height, roofMaterial))
  tower.add(createGateStructure(radius, gateArcWidth, gateHeight, brick))
  if (MOSTRA_ARCO_DE_ADUELAS) tower.add(createGateArch(radius, gateArcWidth, gateHeight, brick))
  const tochas = createTorches(radius, gateArcWidth, gateHeight)
  tower.add(tochas.group)
  const ponte = createDrawbridge(layout, doorMaterial)
  tower.add(ponte.grupo)
  const flag = createFlag(height + radius * 1.9, radius, flagMaterial)
  tower.add(flag.group)

  tower.position.set(layout.outward.x * seatDistance, baseY, layout.outward.z * seatDistance)
  /**
   * Girando o grupo em `-angleRad`, o -X local (o portão) passa a apontar exatamente pra
   * `-(cos θ, sin θ)` — de volta pro centro do hexágono. Conta feita, não ângulo tentado: com
   * `rotation.y = α`, um vetor local `(-1, 0, 0)` vira `(-cos α, 0, sin α)`, que só é igual a
   * `(-cos θ, 0, -sin θ)` quando `α = -θ`.
   */
  tower.rotation.y = -Math.atan2(layout.outward.z, layout.outward.x)

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
    },
    update(segundos) {
      flag.update(segundos)
      tochas.update(segundos)
    },
    ponte
  }
}
