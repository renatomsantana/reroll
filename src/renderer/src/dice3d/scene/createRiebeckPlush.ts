import * as THREE from 'three'
import { createVelvetTextures } from './createVelvetNormalMap'

/**
 * Mini pelúcia do Riebeck (Outer Wilds), modelada só com primitivas do three.
 *
 * A referência são as fotos do produto em `riebeck/`, e não a memória do personagem: corpo PÊSSEGO,
 * cabeça AMARELA com os quatro olhos BORDADOS na cúpula (um do lado direito dele e três do esquerdo,
 * ver `EYES`), tricô rosa na base da cabeça, calota creme com antena, punho verde, botas marrons,
 * faixa rosa na cintura e o banjo na correia. É ASTRONAUTA: tanque de oxigênio, lanterna no ombro
 * direito e o triângulo da Outer Wilds Ventures no peito.
 *
 * Duas decisões de técnica sustentam o resto:
 *
 * 1. tecido de verdade, não plástico fosco: `sheen` (a extensão do three feita pra tecido) com as
 *    texturas de pelo do veludo da bandeja, em repetição bem mais fina;
 * 2. rosto em TEXTURA, não em geometria: bolinha 3D de olho vira borrão cinza num boneco de ~30px na
 *    tela. Os olhos são pintados no `map` da própria esfera, e não num disco colado na frente — o
 *    disco obrigaria a cabeça a ter uma placa de rosto, que a pelúcia real não tem.
 *
 * Decorativa: nunca ganha corpo físico nem collider.
 */

/**
 * Cores escolhidas já descontando a luz da cena (ambiente 0.55 + direcional 1.3 + `environment`).
 *
 * O fator foi MEDIDO: renderizando com a luz da cena e amostrando o pixel da barriga, a cor do
 * material saía multiplicada por ~2.7 e chegava perto do teto (238 de 255), onde a faixa já está
 * comprimida — ali tirar 20% da cor quase não move o pixel, e foi por isso que duas tentativas de
 * escurecer passaram despercebidas. Invertendo a conta pra um alvo de ~190, cada cor precisou de
 * mais um ~0.55 sobre o valor lido na foto.
 *
 * O fator é o MESMO pra todas as peças: escurecer cada cor no olho desmancharia as relações entre
 * elas, e é a relação que faz o boneco ler, não o valor absoluto. A cúpula é a exceção: virou metal.
 */
const COLORS = {
  /** Corpo/traje — o pêssego da pelúcia (foto: ~#f0be94). */
  suit: 0x6c543f,
  /** Painel da barriga, um tom acima: dá volume sem geometria nova. */
  suitLight: 0x77614c,
  suitDark: 0x543e2c,
  /**
   * Cúpula da cabeça. Entra no canvas dos olhos, não no `color` do material, e não levou o mesmo
   * escurecimento do resto: o material dela é metálico (ver `skull`), e em metal esta cor deixa de
   * ser a que se vê e passa a ser o tom do REFLEXO — escurecida, a cabeça saía bronze quase preto.
   */
  head: '#c69a15',
  headShade: '#8a6a0a',
  /** Faixa de tricô na base da cabeça (foto: ~#d08497). */
  brim: 0x5c3942,
  /** Cabelo/tufos escuros atrás da cabeça. */
  hair: 0x1f140c,
  /** Punho verde do braço + anel creme antes da mão. */
  cuff: 0x30441b,
  cuffRing: 0x6d685d,
  /**
   * Botas, no marrom escuro da referência. Chegaram a ser clareadas por uma suspeita de que a faixa
   * escura embaixo do corpo estivesse lendo como vão; a hipótese estava errada (o "flutuando" era a
   * respiração sobrescrevendo a altura) e a mudança foi desfeita.
   */
  boot: 0x291a0f,
  strap: 0x332215,
  /** Cintura, mesmo rosa da faixa da cabeça. */
  waist: 0x5c3942,
  /**
   * Calota no alto da cabeça + arames pretos da antena. Creme, não cinza-metal: ampliada, a peça
   * da foto é um vinil branco acolchoado com costura, e o cinza escuro lia como um parafuso.
   */
  cap: 0x6f6a62,
  antenna: 0x151412,
  /**
   * O emblema da Outer Wilds Ventures não tem cor chapada aqui: virou uma pintura em canvas
   * (`createVenturesPatchTexture`), com as cores dentro da própria função.
   */
  /** Tanque de oxigênio nas costas e lanterna no ombro: o mesmo vinil creme, meio brilhante. */
  gear: 0x656158,
  gearDark: 0x292521,
  banjoSkin: 0x63543e,
  banjoRim: 0x3e2a17,
  banjoNeck: 0x2d1e11
} as const

/**
 * 2:1 de propósito: a UV da esfera do three é equirretangular, `u` cobre 360° de volta e `v` cobre
 * 180° de polo a polo, então um pixel só fica quadrado na superfície se a textura for duas vezes
 * mais larga que alta. Num canvas quadrado, cada olho desenhado como círculo sairia espremido.
 */
const HEAD_TEXTURE_WIDTH = 1024
const HEAD_TEXTURE_HEIGHT = 512

/**
 * Onde cada coisa cai na UV da esfera (`SphereGeometry` do three): `u = 0.25` é exatamente a
 * frente (+Z) e `uv.y = 0.5` é o equador; com `flipY` (padrão do `CanvasTexture`), o topo do
 * canvas é o polo de cima. Daí a conta de pixel: frente = x 256, equador = y 256.
 */
const FRONT_X = HEAD_TEXTURE_WIDTH * 0.25

/**
 * Os quatro olhos, em pixels do canvas. Tamanhos e posições DESIGUAIS de propósito: na foto eles não
 * formam par nenhum, e o arranjo simétrico lê como bichinho genérico. São 1 + 3: um grande do lado
 * direito dele e três do esquerdo.
 *
 * Os `x` saem de medir a foto — num rosto esférico visto de frente, um olho a α graus do centro
 * aparece a `sin(α)` da metade da largura, e invertendo o seno dá α ≈ -35°, +14°, +26° e +40°, que
 * viram pixel por `Δx = α/360 · largura`. Como o +X é o lado ESQUERDO dele, os três ficam acima de
 * `FRONT_X`.
 *
 * As alturas subiram depois da primeira renderização: o tricô é um toro que SOBRESSAI da cúpula, e
 * com a câmera de cima ele tapava um pedaço da cabeça acima da linha onde cruza, cortando o olho de
 * baixo ao meio.
 */
const EYES: ReadonlyArray<{ x: number; y: number; radius: number; stretchY?: number }> = [
  { x: FRONT_X - 101, y: 214, radius: 44 },
  { x: FRONT_X + 40, y: 252, radius: 22 },
  { x: FRONT_X + 74, y: 210, radius: 26 },
  { x: FRONT_X + 115, y: 202, radius: 38, stretchY: 1.25 }
]

/**
 * Textura da cabeça inteira: amarelo de base + costuras de gomo + os quatro olhos bordados.
 * Vira o `map` da esfera (com o material em branco), então tudo aqui já é a cor final.
 */
function createHeadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = HEAD_TEXTURE_WIDTH
  canvas.height = HEAD_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para a cabeça da pelúcia')

  ctx.fillStyle = COLORS.head
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Escurecida na parte de baixo da cúpula: é onde a cabeça encosta na faixa e no corpo, e sem
  // isso a bola amarela fica com iluminação chapada de bola de plástico.
  const shade = ctx.createLinearGradient(0, canvas.height * 0.35, 0, canvas.height)
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)')
  shade.addColorStop(1, 'rgba(60, 40, 0, 0.35)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  /**
   * Costuras de gomo: linhas verticais na UV viram MERIDIANOS na esfera, que é exatamente como as
   * peças de uma pelúcia são costuradas (todas convergindo no topo). Bem fracas — na escala da
   * cena elas somam textura, não devem virar listra.
   */
  ctx.strokeStyle = COLORS.headShade
  ctx.lineWidth = 3
  for (let i = 0; i < 6; i++) {
    const x = (canvas.width / 6) * (i + 0.5)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }

  for (const { x, y, radius, stretchY } of EYES) {
    /**
     * O olho ovalado sai de um círculo desenhado num sistema de coordenadas esticado em Y, e não de
     * uma elipse montada peça por peça: assim sombra, contorno e pupila esticam na mesma proporção,
     * que é como o bordado da foto se deforma.
     */
    ctx.save()
    ctx.translate(x, y)
    if (stretchY) ctx.scale(1, stretchY)

    // Sombra por baixo: sem ela o olho fica "colado" na superfície, como adesivo; com ela lê como
    // bordado afundado no tecido.
    ctx.fillStyle = 'rgba(80, 52, 12, 0.3)'
    ctx.beginPath()
    ctx.arc(0, radius * 0.14, radius * 1.14, 0, Math.PI * 2)
    ctx.fill()

    // Miolo marrom com contorno quase preto: é assim que o bordado da pelúcia é feito, e o
    // contorno é o que segura a leitura do olho quando o boneco fica pequeno na tela.
    ctx.fillStyle = '#5a3620'
    ctx.strokeStyle = '#241610'
    ctx.lineWidth = radius * 0.2
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Pupila clara grande (não um brilhinho): na foto o miolo claro ocupa quase metade do olho.
    ctx.fillStyle = '#efe7d6'
    ctx.beginPath()
    ctx.arc(-radius * 0.06, -radius * 0.04, radius * 0.4, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * Sombra de contato: uma mancha escura no chão, debaixo da pelúcia. Não é enfeite, é a correção do
 * "o Riebeck está flutuando": a câmera de sombra da cena cobre um raio de `circumradius + 2` (~9.5),
 * dimensionado pra bandeja, e a pelúcia mora a ~13 do centro — fora desse alcance ela não projeta
 * sombra nenhuma. Alargar o frustum faria o mesmo mapa de 2048 cobrir mais que o dobro de área,
 * perdendo resolução nas sombras dos DADOS; a mancha custa um draw call.
 */
function createContactShadow(): THREE.Mesh {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para a sombra da pelúcia')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.62)')
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.34)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  // Raio maior que a metade da largura do corpo (0.605): a mancha precisa SOBRAR pra fora da
  // silhueta, senão fica inteira escondida embaixo do boneco e não ancora nada.
  const geometry = new THREE.CircleGeometry(1.05, 24)
  geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      /**
       * Sem escrever profundidade: é uma mancha colada no chão, não um objeto que possa tapar
       * outro. Escrevendo, ela brigaria com a grama e com os próprios pés da pelúcia.
       */
      depthWrite: false
    })
  )
  // Um tico acima do chão pelo motivo de sempre: coplanar pisca.
  mesh.position.y = 0.012
  mesh.scale.set(1, 1, 0.85)
  return mesh
}

/**
 * Emblema triangular da Outer Wilds Ventures, desenhado em canvas: céu estrelado, foguete decolando,
 * fogueira e dois pinheiros — é o que está na referência ampliada.
 *
 * Desenhado e não modelado: são sete elementos dentro de um triângulo de 0.17 de lado, que como
 * peças 3D seriam uma dúzia de malhas no mesmo milímetro de barriga. Fora do triângulo o canvas fica
 * transparente, e o material recorta por `alphaTest`.
 */
function createVenturesPatchTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para o emblema')

  // Triângulo apontando pra cima, com folga nas bordas pro traço da borda caber sem vazar do canvas.
  const margin = 22
  const apex: [number, number] = [size / 2, margin]
  const left: [number, number] = [margin, size - margin]
  const right: [number, number] = [size - margin, size - margin]

  function trianglePath(): void {
    ctx!.beginPath()
    ctx!.moveTo(apex[0], apex[1])
    ctx!.lineTo(right[0], right[1])
    ctx!.lineTo(left[0], left[1])
    ctx!.closePath()
  }

  /**
   * As pontas ARREDONDADAS saem do próprio traço da borda: um `stroke` grosso com `lineJoin`
   * redondo transborda o vértice como um arco. Desenhar três arcos à mão daria o mesmo resultado
   * com muito mais conta.
   */
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  trianglePath()
  ctx.lineWidth = 26
  ctx.strokeStyle = '#2f6fae'
  ctx.stroke()
  ctx.fillStyle = '#0b1424'
  ctx.fill()

  // Tudo daqui pra baixo fica preso ao miolo do triângulo — sem o recorte, a chama e as copas dos
  // pinheiros passariam por cima da borda azul.
  ctx.save()
  trianglePath()
  ctx.clip()

  // Céu: estrelinhas espalhadas, mais densas em cima, onde o triângulo é estreito e sobra céu.
  ctx.fillStyle = '#ffffff'
  for (const [x, y, r] of [
    [96, 74, 2.4],
    [128, 52, 1.8],
    [150, 92, 2.0],
    [80, 118, 1.7],
    [176, 128, 2.2],
    [112, 148, 1.6],
    [64, 156, 2.0],
    [196, 166, 1.8],
    [142, 118, 1.5]
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Chão claro: uma lombada cinza cruzando a base, com duas crateras. É o que dá "planeta" ao céu.
  ctx.fillStyle = '#cfcabd'
  ctx.beginPath()
  ctx.arc(size / 2, 268, 74, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#b3aea1'
  for (const [x, y, r] of [
    [88, 208, 9],
    [172, 214, 6]
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  /** Pinheiro: tronco curto e duas saias de agulha, a de baixo mais larga. */
  function pine(x: number, baseY: number, scale: number): void {
    ctx!.fillStyle = '#5b3a22'
    ctx!.fillRect(x - 2 * scale, baseY - 8 * scale, 4 * scale, 8 * scale)
    ctx!.fillStyle = '#2f7a3f'
    for (const [top, half, bottom] of [
      [30, 16, 8],
      [20, 11, 20]
    ] as const) {
      ctx!.beginPath()
      ctx!.moveTo(x, baseY - top * scale)
      ctx!.lineTo(x + half * scale, baseY - bottom * scale)
      ctx!.lineTo(x - half * scale, baseY - bottom * scale)
      ctx!.closePath()
      ctx!.fill()
    }
  }
  pine(74, 202, 1.15)
  pine(186, 206, 1.0)

  // Fogueira no centro: as achas cruzadas primeiro, a chama por cima delas.
  ctx.strokeStyle = '#6b4425'
  ctx.lineWidth = 7
  for (const direction of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(size / 2 - direction * 17, 206)
    ctx.lineTo(size / 2 + direction * 15, 190)
    ctx.stroke()
  }
  for (const [color, height, width] of [
    ['#e8541f', 44, 15],
    ['#ffc23c', 27, 8]
  ] as const) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(size / 2, 196 - height)
    ctx.quadraticCurveTo(size / 2 + width, 196 - height * 0.35, size / 2, 197)
    ctx.quadraticCurveTo(size / 2 - width, 196 - height * 0.35, size / 2, 196 - height)
    ctx.closePath()
    ctx.fill()
  }

  /**
   * O foguete, subindo em diagonal pra direita, desenhado num sistema de coordenadas girado pra que
   * corpo, janela e rastro sigam o mesmo eixo: inclinar cada peça por conta é onde um desenho assim
   * entorta.
   */
  // x = 145 e não mais à direita: nesta altura o triângulo só vai até x ≈ 169, e o foguete tem ~17
  // de meia-largura depois de inclinado — encostado na borda, o recorte comeria uma aleta.
  ctx.save()
  ctx.translate(145, 104)
  ctx.rotate(0.5)
  // Rastro de fogo primeiro, pra sair POR BAIXO da traseira em vez de vazar por cima dela.
  ctx.fillStyle = '#ff8a2b'
  ctx.beginPath()
  ctx.moveTo(-7, 16)
  ctx.quadraticCurveTo(0, 44, 7, 16)
  ctx.closePath()
  ctx.fill()
  // Corpo claro com o nariz redondo, no creme do traje.
  ctx.fillStyle = '#e8e2d2'
  ctx.beginPath()
  ctx.moveTo(0, -22)
  ctx.quadraticCurveTo(9, -6, 9, 16)
  ctx.lineTo(-9, 16)
  ctx.quadraticCurveTo(-9, -6, 0, -22)
  ctx.closePath()
  ctx.fill()
  // Aletas e escotilha: sem elas o corpo lê como uma gota, não como uma nave.
  ctx.fillStyle = '#c2452c'
  for (const direction of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(direction * 9, 2)
    ctx.lineTo(direction * 17, 18)
    ctx.lineTo(direction * 9, 16)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#7fc4e8'
  ctx.beginPath()
  ctx.arc(0, -4, 4.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.restore()

  // Borda por cima de tudo: fecha o contorno azul depois do recorte, que come a metade interna do
  // traço largo do começo.
  trianglePath()
  ctx.lineWidth = 11
  ctx.strokeStyle = '#3f86c9'
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number]
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Raio da cúpula da cabeça. Grande em relação ao corpo de propósito (proporção "chibi"). */
const HEAD_RADIUS = 0.4

/**
 * Nomes das peças que o teste precisa achar dentro do grupo pronto. Exportado porque um teste que
 * procurasse por string solta passaria a valer nada no dia em que o nome mudasse aqui — e é
 * justamente sobre essas peças que estão as invariantes que já quebraram de verdade.
 */
export const PART_NAMES = {
  body: 'corpo',
  boot: 'bota',
  patch: 'emblema',
  brim: 'faixa-cabeca',
  tank: 'tanque',
  lanternGlass: 'lanterna-vidro',
  lanternShell: 'lanterna-casco'
} as const

/**
 * Altura local da faixa de tricô, em relação ao centro da cabeça. Vale a constante nomeada por causa
 * da dependência com `EYES`: é ela que define até onde os olhos podem descer sem sumir atrás do
 * tricô. Subiu de -0.17 junto com a cabeça — lá embaixo a faixa cruzava a cabeça já dentro do corpo
 * e lia como uma gola no pescoço, não como um gorro.
 */
const BRIM_Y = -0.1

/**
 * Devolve a pelúcia com a origem no ASSENTO (base, y=0) e olhando pro seu +Z local — assim quem
 * posiciona só precisa pôr o grupo na altura da superfície e girar em Y, sem compensar meia
 * altura de corpo. Altura total ~1.5 até o alto da cabeça, ~1.8 contando a antena.
 */
export function createRiebeckPlush(): THREE.Group {
  const group = new THREE.Group()

  /**
   * Texturas de pelo compartilhadas por todas as peças de tecido. `repeat` bem mais alto que o do
   * chão de veludo: aqui a UV é a de uma esfera (normalizada [0,1]) e o boneco tem menos de uma
   * unidade de mundo — sem repetir bastante, um "tile" cobriria o corpo inteiro e viraria mancha.
   */
  const fuzz = createVelvetTextures()
  for (const texture of [fuzz.normalMap, fuzz.shadingMap]) texture.repeat.set(5, 5)

  /**
   * `sheen` moderado (0.45) e `sheenColor` só 20% clareado — com `sheen: 1` e 45% de branco, que
   * foi a primeira tentativa, a iluminação forte da cena somava tanta luz difusa por cima que
   * TODAS as cores lavavam. O ponto do sheen aqui é o halo de tecido, não iluminar.
   */
  function fabric(color: number, options: { fuzzy?: boolean } = {}): THREE.MeshPhysicalMaterial {
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 1,
      metalness: 0,
      sheen: 0.45,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.2)
    })
    // Peças pequenas (anel do punho, alça, emblema) ficam sem o pelo: na escala delas a textura
    // vira ruído, não tecido.
    if (options.fuzzy !== false) {
      material.map = fuzz.shadingMap
      material.normalMap = fuzz.normalMap
      material.normalScale = new THREE.Vector2(0.45, 0.45)
    }
    return material
  }

  /** Peças rígidas (banjo, antena, calota): madeira/metal costurados por cima do tecido. */
  function prop(color: number, roughness = 0.55, metalness = 0.08): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness })
  }

  const suitMaterial = fabric(COLORS.suit)
  const bootMaterial = fabric(COLORS.boot)
  const brimMaterial = fabric(COLORS.brim)

  // ── Corpo ────────────────────────────────────────────────────────────────────────────────────
  // Bola LARGA e baixa: a pelúcia da referência é bem mais larga que alta, e era isso que fazia a
  // primeira versão parecer boneco de neve.
  const body = part(new THREE.SphereGeometry(0.56, 32, 24), suitMaterial, [0, 0.6, 0])
  body.scale.set(1.08, 0.92, 0.98)
  body.name = PART_NAMES.body
  group.add(body)

  // Painel da barriga, um tom mais claro e SALTANDO um pouco pra frente da silhueta do corpo
  // (0.60 contra 0.55): é uma peça costurada por fora, não uma mancha de cor.
  const belly = part(new THREE.SphereGeometry(0.46, 24, 18), fabric(COLORS.suitLight), [0, 0.55, 0.26])
  belly.scale.set(0.96, 0.88, 0.74)
  group.add(belly)

  // Costuras laterais: dois arcos escuros descendo pelos lados, o que mais diz "isto é costurado".
  const seamMaterial = fabric(COLORS.suitDark, { fuzzy: false })
  for (const side of [-1, 1]) {
    const seam = part(
      new THREE.TorusGeometry(0.56, 0.012, 6, 28, Math.PI * 0.8),
      seamMaterial,
      [0, 0.6, 0]
    )
    seam.rotation.set(Math.PI / 2, Math.PI * 0.14 * side, 0, 'YXZ')
    seam.scale.set(1.1, 0.94, 0.88)
    group.add(seam)
  }

  // Faixa rosa na cintura. As escalas não são enfeite: na altura y=0.33 o corpo é uma ELIPSE
  // (mais largo em x que em z, por causa do `body.scale`), então um toro circular ou afundaria
  // nos lados ou boiaria na frente.
  const waist = part(
    new THREE.TorusGeometry(0.5, 0.045, 10, 40),
    fabric(COLORS.waist, { fuzzy: false }),
    [0, 0.33, 0]
  )
  waist.rotation.x = Math.PI / 2
  waist.scale.set(1.04, 0.95, 1)
  group.add(waist)

  // Alça atravessada no peito.
  const strap = part(
    new THREE.TorusGeometry(0.56, 0.038, 10, 40),
    fabric(COLORS.strap, { fuzzy: false }),
    [0, 0.62, 0]
  )
  strap.rotation.set(Math.PI / 2, 0, 0.5)
  strap.scale.set(1.06, 1, 0.62)
  group.add(strap)

  /**
   * Emblema no peito, no lado ESQUERDO dele (+X), que é onde está na foto — o direito é o da
   * lanterna. Plano quadrado com textura, e não triângulo de geometria: a arte tem borda arredondada
   * e detalhe interno. O quadrado sobrando some por `alphaTest`.
   *
   * Tamanho, altura e INCLINAÇÃO saem da equação da elipsoide: entre o topo e a base do emblema o
   * peito avança quase 0.13 em z, e um plano chapado só cabe ali deitado junto com a curva. Reto e
   * maior, o terço de baixo entrava no corpo e a fogueira sumia. Com -0.55 e 0.15×0.14 os quatro
   * cantos ficam entre 0.016 e 0.052 à frente da superfície.
   */
  const patch = part(
    new THREE.PlaneGeometry(0.15, 0.14),
    new THREE.MeshStandardMaterial({
      map: createVenturesPatchTexture(),
      // `alphaTest` e não `transparent`: o miolo do emblema é opaco e só o fora do triângulo é
      // vazado. Com `transparent` o plano entraria na fila de ordenação e passaria a piscar contra
      // a barriga conforme a câmera gira; com recorte por alfa ele é sólido como qualquer peça.
      alphaTest: 0.5,
      roughness: 0.85,
      metalness: 0
    }),
    [0.17, 0.885, 0.455]
  )
  patch.rotation.set(-0.55, 0.3, 0)
  patch.name = PART_NAMES.patch
  group.add(patch)

  // ── Equipamento de astronauta ────────────────────────────────────────────────────────────────
  /**
   * Tanque de oxigênio nas costas; sem ele o boneco vira um bicho gordo de gorro. Um cilindro só
   * (eram dois), um pouco mais gordo, senão a mochila sumia atrás do corpo.
   *
   * A ALTURA foi baixada depois de ver rodando: com o topo em ~1.15 as duas calotas claras apareciam
   * uma de cada lado da cúpula e o boneco ganhava ORELHAS. A cabeça mora em y=1.16 com raio 0.40,
   * então tudo que sobe até lá disputa silhueta com ela; agora termina em ~1.03.
   */
  const gearMaterial = prop(COLORS.gear, 0.45, 0.25)
  const gearDarkMaterial = prop(COLORS.gearDark, 0.5, 0.3)
  /**
   * As peças do tanque e da lanterna levam `name`: é por ele que `createRiebeckPlush.test.ts`
   * acha cada uma pra conferir as duas invariantes que já foram quebradas de verdade aqui (o
   * tanque subindo até virar orelha, o vidro da lanterna sumindo dentro do corpo dela).
   */
  const tankBody = part(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 16), gearMaterial, [0, 0.66, -0.56])
  tankBody.name = PART_NAMES.tank
  group.add(tankBody)
  // Calota arredondada no topo (cilindro cortado reto lê como lata, não como cilindro de gás),
  // achatada pra caber na altura disponível abaixo da cabeça.
  const tankDome = part(
    new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    gearMaterial,
    [0, 0.89, -0.56]
  )
  tankDome.scale.set(1, 0.55, 1)
  tankDome.name = PART_NAMES.tank
  group.add(tankDome)
  const tankValve = part(
    new THREE.CylinderGeometry(0.034, 0.034, 0.08, 8),
    gearDarkMaterial,
    [0, 0.98, -0.56]
  )
  tankValve.name = PART_NAMES.tank
  group.add(tankValve)
  // Cinta escura segurando o tanque no corpo, na altura do meio.
  const tankStrap = part(new THREE.BoxGeometry(0.48, 0.07, 0.36), gearDarkMaterial, [0, 0.7, -0.56])
  group.add(tankStrap)

  /**
   * LANTERNA DE MÃO presa ao traje, DEITADA e iluminando pra frente, não um lampião: na referência o
   * que aparece no ombro é um DISCO claro, que é como uma lanterna deitada se vê de frente. A versão
   * anterior era um cilindro em pé, com a silhueta de uma lamparina.
   *
   * Por isso ela é montada ao longo do +Z: o cilindro do three nasce no eixo Y, então cada peça leva
   * `rotation.x = π/2`. O vidro é a TAMPA DA FRENTE, na ponta, à frente de todo o resto.
   */
  const lantern = new THREE.Group()
  /**
   * Ombro DIREITO dele, que é o -X (`forward × up` com o personagem olhando pro +Z) — ou seja, o
   * lado ESQUERDO de quem olha, que é onde ela está na foto.
   *
   * O ponto sai da equação da elipsoide do corpo (semieixos 0.605 / 0.515 / 0.549 centrados em
   * y = 0.6): em x = -0.40, y = 0.88 a superfície está em z ≈ 0.28, e o grupo fica em 0.34 pra que a
   * traseira do cano entre um pouco no traje — é isso que faz ela ler como PRESA nele.
   */
  lantern.position.set(-0.4, 0.88, 0.34)
  // Um tico virada pra fora e pra baixo, acompanhando a curva do ombro. Reta demais ela parece
  // enfiada no boneco; é o mesmo desvio que uma lanterna presa numa alça teria.
  lantern.rotation.y = -0.2
  lantern.rotation.x = 0.08

  /** Deita a peça no eixo Z — o cilindro do three nasce ao longo do Y. */
  function lyingDown(mesh: THREE.Mesh): THREE.Mesh {
    mesh.rotation.x = Math.PI / 2
    return mesh
  }

  const lanternBarrel = lyingDown(
    part(new THREE.CylinderGeometry(0.058, 0.062, 0.18, 12), gearDarkMaterial, [0, 0, 0])
  )
  lanternBarrel.name = PART_NAMES.lanternShell
  lantern.add(lanternBarrel)
  // Aro da frente, um degrau mais largo que o cano: é o que dá "cabeça de lanterna" à silhueta.
  const lanternBezel = lyingDown(
    part(new THREE.CylinderGeometry(0.07, 0.066, 0.045, 12), gearDarkMaterial, [0, 0, 0.105])
  )
  lanternBezel.name = PART_NAMES.lanternShell
  lantern.add(lanternBezel)
  // `emissive` porque a lanterna do jogo é uma luz acesa, e uma lanterna apagada num boneco de
  // 30px na tela some. É só o material — não é uma luz de verdade, então não muda em nada a
  // iluminação da cena nem dos dados.
  const lanternGlass = lyingDown(
    part(
      new THREE.CylinderGeometry(0.058, 0.058, 0.02, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffd98a,
        emissive: new THREE.Color(0xffb340),
        emissiveIntensity: 0.7,
        roughness: 0.3
      }),
      [0, 0, 0.132]
    )
  )
  lanternGlass.name = PART_NAMES.lanternGlass
  lantern.add(lanternGlass)
  // Tampa de trás, fechando o cano — sem ela o cilindro fica com a boca aberta virada pro traje.
  const lanternTail = lyingDown(
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), gearDarkMaterial, [0, 0, -0.1])
  )
  lanternTail.name = PART_NAMES.lanternShell
  lantern.add(lanternTail)
  /**
   * Cinta em volta do cano mais o calço que desce até o traje. São as duas peças que dizem
   * "PRESA AO TRAJE" — sem elas a lanterna fica pairando ao lado do ombro, que é o mesmo defeito
   * (em outra peça) que o tanque de oxigênio já teve.
   */
  const lanternStrap = lyingDown(
    part(new THREE.TorusGeometry(0.064, 0.013, 6, 14), gearDarkMaterial, [0, 0, -0.035])
  )
  lantern.add(lanternStrap)
  lantern.add(part(new THREE.BoxGeometry(0.05, 0.06, 0.07), gearDarkMaterial, [0.01, -0.06, -0.05]))
  group.add(lantern)

  // ── Botas ────────────────────────────────────────────────────────────────────────────────────
  // Curtas e pra frente, saindo por baixo da barriga (é assim que aparecem na foto: a barriga
  // esconde as pernas inteiras e sobram só os pés).
  for (const side of [-1, 1]) {
    const boot = part(new THREE.SphereGeometry(0.19, 18, 14), bootMaterial, [side * 0.24, 0.13, 0.34])
    boot.scale.set(1, 0.78, 1.25)
    // Nomeadas porque são elas que APOIAM o boneco no chão desde que `SIT_DEPTH` foi zerado — o
    // teste mede a altura delas pra garantir que o grupo não volte a pairar.
    boot.name = PART_NAMES.boot
    group.add(boot)
  }

  // ── Braços ───────────────────────────────────────────────────────────────────────────────────
  /**
   * Cada braço é um GRUPO montado ao longo do +X e depois girado, em vez de peça por peça com
   * coordenadas espelhadas na mão: punho verde, anel creme e mão precisam ficar alinhados no mesmo
   * eixo, e acertar isso três vezes com seno e cosseno é onde a versão anterior deixava o punho
   * torto. Espelhar com `scale.x = -1` seria mais curto e está errado: inverte a orientação das
   * faces, e o lado esquerdo ficaria com a iluminação furada.
   */
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(0, 0.74, 0.04)
    arm.rotation.z = -side * 0.38 // caindo pro lado
    arm.rotation.y = -side * 0.2 // e um pouco pra frente

    const upper = part(new THREE.SphereGeometry(0.2, 18, 14), suitMaterial, [side * 0.44, 0, 0])
    upper.scale.set(1.4, 0.92, 1)
    arm.add(upper)

    const cuff = part(
      new THREE.CylinderGeometry(0.165, 0.155, 0.16, 16),
      fabric(COLORS.cuff),
      [side * 0.68, 0, 0]
    )
    cuff.rotation.z = Math.PI / 2
    arm.add(cuff)

    const ring = part(
      new THREE.TorusGeometry(0.15, 0.028, 8, 18),
      fabric(COLORS.cuffRing, { fuzzy: false }),
      [side * 0.76, 0, 0]
    )
    ring.rotation.y = Math.PI / 2
    arm.add(ring)

    const hand = part(new THREE.SphereGeometry(0.16, 16, 12), suitMaterial, [side * 0.86, 0, 0])
    hand.scale.set(1.05, 0.95, 0.95)
    arm.add(hand)

    group.add(arm)
  }

  // ── Cabeça ───────────────────────────────────────────────────────────────────────────────────
  /**
   * Num grupo próprio pra INCLINAR o conjunto (cúpula + faixa + calota + antena) de uma vez: a
   * câmera da cena olha de cima (~42°) e, com a cabeça reta, os olhos ficam quase de perfil pra
   * ela. A inclinação pra trás vira a cara pra cima, na direção de quem está olhando.
   */
  const head = new THREE.Group()
  head.position.set(0, 1.16, 0.02)
  /**
   * Inclinação medida contra a câmera, não escolhida no olho: a câmera padrão da bandeja fica em
   * (0, 13, 14.65) olhando pra origem e a pelúcia mora em (9.6, 0, 5.4), o que dá ~44° de
   * elevação vista de lá. Com a cabeça reta, a cara aponta pro horizonte e desses 44° só se vê a
   * calota. 0.4 rad (~23°) fecha boa parte dessa diferença sem o boneco ficar olhando pro céu.
   */
  head.rotation.x = -0.4

  const skull = part(
    new THREE.SphereGeometry(HEAD_RADIUS, 32, 24),
    (() => {
      /**
       * A cúpula é METAL DOURADO, e não tecido como o resto do boneco ("o capacete é meio metálico
       * dourado"). "Meio" é literal: `metalness` 0.62, e não 1 — em metal puro não existe cor difusa,
       * só reflexo, e os quatro olhos bordados e as costuras de gomo, que são PINTURA no `map`,
       * praticamente desapareceriam. `roughness` 0.34 dá metal escovado; um espelho refletiria a
       * bandeja inteira na cabeça dele. A cor do material é branca de propósito: o dourado já vem no
       * `map`, e um amarelo por cima tingiria o bordado e a pupila junto.
       */
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createHeadTexture(),
        metalness: 0.62,
        roughness: 0.34
      })
      // Relevo bem mais fraco que o do tecido (0.35 → 0.12): a mesma textura de pelo que dá veludo
      // no corpo, num material metálico, vira metal amassado.
      material.normalMap = fuzz.normalMap
      material.normalScale = new THREE.Vector2(0.12, 0.12)
      return material
    })(),
    [0, 0, 0]
  )
  skull.scale.set(1.05, 0.92, 1)
  head.add(skull)

  // Faixa de tricô: sobra pra fora da cúpula de propósito (raio externo 0.41 contra 0.40 da
  // cabeça naquela altura) — é uma barra dobrada por cima da cabeça, não uma listra pintada.
  const brim = part(new THREE.TorusGeometry(0.36, 0.052, 10, 30), brimMaterial, [0, BRIM_Y, 0])
  brim.name = PART_NAMES.brim
  brim.rotation.x = Math.PI / 2
  brim.scale.set(1.05, 1, 1)
  head.add(brim)

  // Tufos de cabelo escuro saindo por trás, por baixo da faixa.
  const hairMaterial = fabric(COLORS.hair)
  for (const [x, y, z, radius] of [
    [-0.16, -0.1, -0.32, 0.14],
    [0.16, -0.1, -0.32, 0.14],
    [0, -0.04, -0.36, 0.15]
  ] as const) {
    const tuft = part(new THREE.SphereGeometry(radius, 14, 12), hairMaterial, [x, y, z])
    tuft.scale.set(1.1, 0.9, 1)
    head.add(tuft)
  }

  // Calota no alto + antena de arames abertos. É a única peça da pelúcia que é vinil brilhante na
  // foto, então leva `roughness` baixo — o contraste com todo o resto fosco é o que faz ela ler
  // como material diferente mesmo com 10px na tela.
  const cap = part(new THREE.SphereGeometry(0.14, 16, 12), prop(COLORS.cap, 0.3, 0.15), [0, 0.335, -0.01])
  cap.scale.set(1.15, 0.55, 1)
  head.add(cap)

  /**
   * A antena da pelúcia é um tufo de arames pretos ABERTOS, meio tortos — não uma haste com duas
   * pontinhas simétricas, que é o que as versões anteriores faziam e lia como antena de formiga.
   * Ângulos e azimutes escolhidos irregulares justamente pra manter esse ar de arame torcido.
   */
  const antennaMaterial = prop(COLORS.antenna, 0.6, 0.2)
  const stem = part(
    new THREE.CylinderGeometry(0.009, 0.012, 0.22, 6),
    antennaMaterial,
    [0, 0.5, -0.01]
  )
  head.add(stem)
  for (const [azimuth, tilt] of [
    [0.3, 0.55],
    [2.1, 0.75],
    [3.6, 0.5],
    [5.1, 0.85]
  ] as const) {
    const wire = part(new THREE.CylinderGeometry(0.007, 0.007, 0.24, 6), antennaMaterial, [0, 0, 0])
    // Erguido meia altura antes de girar, senão o arame roda em volta do próprio meio e metade
    // dele atravessa a cabeça pra baixo.
    wire.position.set(0, 0.12, 0)
    const pivot = new THREE.Group()
    pivot.position.set(0, 0.6, -0.01)
    pivot.rotation.set(0, azimuth, tilt, 'YXZ')
    pivot.add(wire)
    head.add(pivot)
  }

  group.add(head)

  /**
   * Não tem o chapéu de aba larga que aparece pendurado nas costas na foto: foi modelado e removido
   * depois de ver rodando, porque fica quase todo atrás do boneco e o pouco que sobra aparece como
   * uma lasca cinza espetada no ombro. Detalhe que só existe de um ângulo que a câmera não usa custa
   * mais do que rende.
   */

  // ── Banjo ────────────────────────────────────────────────────────────────────────────────────
  /**
   * Encostado na barriga, com a pele virada pra CIMA e pra frente. As versões anteriores sumiam do
   * enquadramento padrão pelo mesmo motivo da cabeça: a câmera olha de cima, então um disco
   * vertical aparece de fio e o banjo vira uma varetinha solta ao lado do corpo.
   */
  const banjo = new THREE.Group()

  const skin = part(
    new THREE.CylinderGeometry(0.22, 0.22, 0.055, 28),
    prop(COLORS.banjoSkin, 0.7),
    [0, 0, 0]
  )
  skin.rotation.x = Math.PI / 2
  banjo.add(skin)
  banjo.add(part(new THREE.TorusGeometry(0.22, 0.036, 12, 32), prop(COLORS.banjoRim, 0.45), [0, 0, 0]))

  // Ponte + braço + cabeça com cravelhas: os detalhes que fazem o disco virar instrumento.
  banjo.add(part(new THREE.BoxGeometry(0.1, 0.024, 0.032), prop(COLORS.banjoNeck), [0, -0.07, 0.04]))
  banjo.add(part(new THREE.BoxGeometry(0.06, 0.52, 0.045), prop(COLORS.banjoNeck), [0, 0.34, 0.025]))
  banjo.add(part(new THREE.BoxGeometry(0.085, 0.13, 0.038), prop(COLORS.banjoRim, 0.45), [0, 0.65, 0.025]))
  for (const side of [-1, 1]) {
    banjo.add(
      part(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), prop(0xd8d2c4, 0.3), [
        side * 0.048,
        0.67,
        0.025
      ])
    )
  }

  const stringMaterial = prop(0xf2ecdc, 0.3)
  for (const offset of [-0.015, 0, 0.015]) {
    banjo.add(
      part(new THREE.CylinderGeometry(0.0035, 0.0035, 0.62, 6), stringMaterial, [offset, 0.32, 0.055])
    )
  }

  // Erguido pra barriga (era 0.44, na altura dos pés): lá embaixo o disco cobria as botas e o
  // instrumento parecia largado no chão em vez de dependurado no boneco.
  banjo.position.set(0.18, 0.56, 0.61)
  banjo.rotation.set(-0.5, 0.1, -0.55)
  group.add(banjo)

  /**
   * O boneco afunda um pouco antes de ser entregue: o corpo é uma esfera de raio 0.56 achatada em
   * 0.92 e centrada em 0.60, ou seja a barriga TERMINA em 0.085, e só as botas desciam até o chão —
   * de qualquer ângulo que não fosse bem de frente, a bola do corpo pairava com um vão embaixo.
   *
   * Está em ZERO a pedido dele ("sobe o Riebeck"), e zero é o limite: as botas terminam exatamente em
   * 0, então qualquer negativo abre um vão de verdade. Na tela todo o curso deste ajuste cabe em UM
   * pixel — pra uma subida que dê pra ver, o que muda é o tamanho ou a distância, não esta constante.
   *
   * A SOMBRA fica de fora do deslocamento, presa ao grupo externo: ela tem que continuar na altura do
   * chão, senão afunda junto e para de ancorar o boneco.
   */
  const SIT_DEPTH = 0
  group.position.y = -SIT_DEPTH

  const root = new THREE.Group()
  root.add(createContactShadow())
  root.add(group)
  return root
}
