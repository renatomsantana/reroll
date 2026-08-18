import * as THREE from 'three'
import { createVelvetTextures } from './createVelvetNormalMap'

/**
 * Mini pelúcia do Riebeck (Outer Wilds), modelada só com primitivas do three.
 *
 * TERCEIRA versão. As duas anteriores foram feitas "de memória" do personagem e erraram o
 * essencial — eram um traje MARROM com um CAPACETE OLIVA e um aro de visor com uma plaquinha de
 * rosto amarelo por dentro. Comparando com as fotos do produto que estão em `riebeck/`
 * (`product_OW_riebeck_plush_photo2.webp`, close da cabeça, e `...fb8ur54u1tub1.webp`, corpo
 * inteiro de frente), a pelúcia de verdade é outra coisa:
 *
 * - corpo PÊSSEGO (não marrom), uma bola gorda e larga;
 * - cabeça AMARELA lisa, sem visor e sem aro: os quatro olhos são BORDADOS direto na cúpula,
 *   de tamanhos diferentes e espalhados de forma irregular — UM do lado direito dele e TRÊS do
 *   esquerdo, ver `EYES`;
 * - faixa de tricô ROSA em volta da base da cabeça;
 * - calota creme no alto com a antena PRETA de arames abertos saindo dela;
 * - braços pêssego com punho VERDE + anel creme, mãos pêssego, e botas MARRONS embaixo;
 * - faixa rosa na cintura e o banjo dependurado numa correia de couro que cruza o peito.
 *
 * E o que ele É, que a segunda leva ainda tratava como enfeite (correções do usuário):
 * ASTRONAUTA, com tanque de oxigênio nas costas e lanterna no ombro direito; o emblema no peito
 * é o TRIÂNGULO da Outer Wilds Ventures; e o banjo não fica solto na frente — ele pende da
 * correia que dá a volta no corpo, porque ele toca banjo.
 *
 * Duas decisões de técnica que sobreviveram das versões anteriores, porque continuam certas:
 *
 * 1. TECIDO DE VERDADE, não plástico fosco: `sheen` (a extensão do three feita pra tecido) + o
 *    par de texturas procedurais de "pelo" do veludo da bandeja (`createVelvetNormalMap.ts`),
 *    com repetição bem mais fina. É o que separa "pelúcia" de "boneco de resina".
 *
 * 2. ROSTO EM TEXTURA, não em geometria: bolinhas 3D de olho viram borrão cinza num boneco que
 *    ocupa ~30px na tela.
 *
 * O que MUDOU na técnica: os olhos agora são pintados no `map` da PRÓPRIA esfera da cabeça, em
 * vez de num disco chapado colado na frente. O disco existia pra fugir da paralaxe (olho pintado
 * numa calota separada saía do lugar conforme o ângulo), mas ele obrigava a cabeça a ter uma
 * "placa de rosto" — que é justamente o detalhe que não existe na pelúcia real. Pintando na UV da
 * esfera o problema simplesmente não acontece: o olho é a superfície, não algo flutuando na
 * frente dela.
 *
 * Continua 100% decorativa: nunca ganha corpo físico nem collider (mesma convenção da prateleira
 * e do estojo, ver `DiceCanvasMulti.tsx`), então não interfere em rolagem nenhuma.
 */

/**
 * Cores escolhidas JÁ DESCONTANDO a luz da cena: ambiente 0.55 + direcional 1.3 + `environment`
 * clareiam tudo perceptivelmente (medido em versões anteriores comparando o valor pedido com o
 * pixel renderizado numa captura ampliada — um oliva 0x9a9a33 saía verde-limão claro). Por isso
 * os valores aqui são ~20% mais escuros que a cor lida nas fotos de referência.
 */
/**
 * SEGUNDA rodada de escurecimento, a pedido do usuário ("coloca as cores mais escuras"): tudo levou
 * mais um fator ~0.55 em cima dos valores que já vinham ~20% abaixo da foto pelo motivo do
 * parágrafo acima.
 *
 * 0.55 parece muito e não é — foi MEDIDO, não escolhido. Renderizando o boneco com a luz exata da
 * cena (ambiente 0.55 + direcional 1.3 + `environment`) e amostrando o pixel da barriga: a cor do
 * material saía multiplicada por ~2.7 e chegava perto do teto (238 de 255), onde a faixa já está
 * comprimida. Nessa região, tirar 20% da cor quase não move o pixel — as duas primeiras tentativas
 * desta mesma rodada foram exatamente isso e passaram despercebidas. Invertendo a conta pra um alvo
 * de ~190 no pixel, a cor precisava do 0.55. Sem medir, o caminho é continuar tirando 20% e
 * achando que "não mudou nada".
 *
 * O fator é o MESMO pra todas as peças de propósito: escurecer cada cor "no olho" desmancharia as
 * relações entre elas (o painel da barriga tem que continuar um degrau acima do traje, a bota um
 * degrau abaixo), e é a relação que faz o boneco ler, não o valor absoluto.
 *
 * A cúpula da cabeça é a exceção e está comentada onde aparece: ela virou METAL, e metal escurece
 * sozinho.
 */
const COLORS = {
  /** Corpo/traje — o pêssego da pelúcia (foto: ~#f0be94). */
  suit: 0x6c543f,
  /** Painel da barriga, um tom acima: dá volume sem geometria nova. */
  suitLight: 0x77614c,
  suitDark: 0x543e2c,
  /**
   * Cúpula da cabeça. Entra no canvas dos olhos, não no `color` do material.
   *
   * NÃO levou o mesmo escurecimento do resto: o material dela agora é metálico (ver `skull`), e em
   * metal esta cor deixa de ser "a cor que se vê" e passa a ser o TOM DO REFLEXO. Escurecida junto
   * com o tecido, a cabeça saía um bronze quase preto em vez do dourado pedido.
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
   * Botas, no marrom escuro da foto de referência. Chegaram a ser clareadas pra 0x8a5b33 por uma
   * suspeita minha de que a faixa escura embaixo do corpo estivesse lendo como vão — hipótese
   * errada: o "flutuando" era a respiração sobrescrevendo a altura da pelúcia. Desfeito, porque a
   * referência manda aqui.
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
   * O emblema da Outer Wilds Ventures não tem mais cor chapada aqui: virou uma pintura em canvas
   * (`createVenturesPatchTexture`), com as cores dela dentro da própria função. Chapado ele era um
   * triângulo escuro com miolo verde, que de perto não era logo nenhum.
   */
  /** Tanque de oxigênio nas costas e lanterna no ombro: o mesmo vinil creme, meio brilhante. */
  gear: 0x656158,
  gearDark: 0x292521,
  banjoSkin: 0x63543e,
  banjoRim: 0x3e2a17,
  banjoNeck: 0x2d1e11
} as const

/**
 * 2:1 de propósito. A UV da esfera do three é equirretangular: `u` cobre 360° de volta e `v`
 * cobre 180° de polo a polo, então um pixel só fica QUADRADO na superfície se a textura for duas
 * vezes mais larga que alta. Com um canvas quadrado, cada olho desenhado como círculo sairia
 * espremido na horizontal na cabeça.
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
 * Os quatro olhos, em pixels do canvas. Tamanhos e posições DESIGUAIS de propósito: na foto os
 * olhos do Riebeck não formam par nenhum — tem um grande à esquerda, um grande à direita e dois
 * miúdos no meio, em alturas diferentes. Foi tentado antes o arranjo simétrico "dois grandes em
 * cima, dois pequenos embaixo" e ele lê como bichinho genérico de 2+2 olhos, não como hearthiano.
 *
 * Alturas SUBIDAS depois de ver a primeira versão desta leva rodando: com o olho de baixo em
 * y=300 ele saía cortado ao meio pela faixa de tricô. Não bastava a conta de "está acima de
 * `BRIM_Y`" — a faixa é um toro que SOBRESSAI da cúpula, então, com a câmera olhando de cima, ela
 * tapa um pedaço da cabeça bem acima da linha onde ela cruza. Agora o olho mais baixo (y=252)
 * cai perto do equador, com folga de sobra pro tricô.
 *
 * O ARRANJO é 1 + 3, não 2 + 2: UM olho grande do lado direito DELE e TRÊS do lado esquerdo
 * (pequeno, médio e um grande ovalado quase na quina da cabeça). Isso foi correção do usuário e
 * confere com `riebeck/images.jpg` ampliada. A versão anterior espalhava dois de cada lado, o que
 * dá um rosto simétrico — e simetria é justamente o que o Riebeck não tem.
 *
 * Os `x` saem de medir a foto, não de gosto: num rosto esférico visto de frente, um olho a α
 * graus do centro aparece a `sin(α)` da metade da largura da cúpula. Medindo o afastamento de
 * cada olho na imagem e invertendo esse seno dá α ≈ -35°, +14°, +26° e +40°, que viram deslocamento
 * em pixel por `Δx = α/360 · largura`. Como o personagem olha pro +Z e o +X dele é o lado
 * ESQUERDO dele, os três ficam com `x` acima de `FRONT_X`.
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
     * O olho ovalado sai de um círculo desenhado num sistema de coordenadas ESTICADO em Y, e não
     * de uma elipse montada peça por peça: assim a sombra, o contorno e a pupila esticam todos na
     * mesma proporção, que é como o bordado da foto se deforma. Montado na mão, cada um desses
     * três precisaria do próprio fator de correção.
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
 * Sombra de contato: uma mancha escura desenhada no chão, debaixo da pelúcia.
 *
 * Não é enfeite — é a correção do "o Riebeck está flutuando", que persistiu mesmo depois de acertar
 * a altura dela duas vezes. A causa não era a altura: a câmera de sombra da cena cobre um raio de
 * `circumradius + 2` (~9.5, ver `LIGHT_CONFIG.shadowFrustum`), dimensionado pra bandeja, e a
 * pelúcia mora a ~13 do centro. Fora desse alcance ela simplesmente NÃO projeta sombra nenhuma — e
 * um objeto sem sombra de contato lê como flutuando, por mais encostado no chão que esteja.
 *
 * Alargar o frustum resolveria, e sairia caro no lugar errado: o mesmo mapa de 2048 passaria a
 * cobrir mais que o dobro de área, perdendo resolução justamente nas sombras dos DADOS, que são as
 * que importam. Uma mancha local custa um draw call e não mexe em nada disso.
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
 * Emblema triangular da Outer Wilds Ventures, desenhado em canvas: céu estrelado, o FOGUETE
 * decolando em diagonal com o rastro de fogo, uma fogueira acesa no chão e dois pinheiros
 * ladeando. É o que está na referência ampliada (`riebeck/ok-i-think-im-in-love-...png`) e é o
 * pedido do usuário ("desenha o foguetinho") — antes o emblema era um triângulo verde chapado.
 *
 * Desenhado, e não modelado: são sete elementos pequenos dentro de um triângulo de 0.17 de lado.
 * Como peças 3D isso seria uma dúzia de malhas disputando o mesmo milímetro de barriga; como
 * pintura é um canvas e um plano.
 *
 * FORA do triângulo o canvas fica transparente, e o material recorta por `alphaTest` — por isso
 * nada aqui pinta o fundo do quadrado inteiro.
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
   * O FOGUETE, subindo em diagonal pra direita — é a peça que dá nome ao pedido. Desenhado num
   * sistema de coordenadas girado (`translate` + `rotate`) pra que corpo, janela e rastro sigam o
   * mesmo eixo: inclinar cada peça por conta é onde um desenho assim entorta.
   */
  // x = 145 e não mais à direita: nesta altura o triângulo só vai até x ≈ 169, e o foguete tem
  // ~17 de meia-largura depois de inclinado — encostado na borda, o recorte comeria uma aleta.
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
 * Altura local da faixa de tricô, em relação ao centro da cabeça. Vale a constante nomeada por
 * causa da dependência com `EYES`: é ela que define até onde os olhos podem descer sem ficarem
 * escondidos atrás do tricô.
 *
 * Subiu de -0.17 pra -0.10 junto com a cabeça: lá embaixo a faixa cruzava a cabeça já dentro do
 * corpo, então de fora ela lia como uma GOLA no pescoço, não como um gorro na cabeça.
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
   * Emblema da Outer Wilds Ventures no peito. Fica no lado ESQUERDO dele (+X), que é onde está na
   * foto — o lado direito é o da lanterna. Posição e inclinação vêm da versão anterior, onde o z
   * foi CALCULADO pra cair logo fora da superfície do corpo naquela altura e naquele x (a
   * elipsoide do corpo, não uma esfera) — chutado, ele afunda de um lado e boia do outro.
   *
   * O DESENHO mudou a pedido do usuário ("desenha o foguetinho"). Eram dois triângulos chapados,
   * um escuro fazendo borda pra um verde liso: lido de perto, um losango verde sem nenhum motivo.
   * O emblema de verdade (`riebeck/ok-i-think-im-in-love-...png`, onde ele aparece grande) é um
   * triângulo de céu estrelado com o foguete decolando, a fogueira e os pinheiros.
   *
   * Virou UM plano quadrado com textura em vez de um triângulo de geometria: a arte tem borda
   * arredondada e detalhe interno, coisas que se desenham num canvas e não se modelam com dois
   * `CircleGeometry`. O quadrado sobrando some por `alphaTest` (ver `createVenturesPatchTexture`),
   * então a silhueta na cena continua sendo a do triângulo.
   */
  /**
   * Tamanho, altura e INCLINAÇÃO saem da equação da elipsoide, não de tentativa: entre o topo e a
   * base do emblema o peito avança quase 0.13 em z (ele está bem na curva onde a barriga começa a
   * estufar). Um plano chapado só cabe ali se estiver deitado pra trás junto com essa curva —
   * primeira versão ficou reta (`rotation.x` -0.2) e num quadrado maior, e o terço de baixo do
   * triângulo entrou no corpo: na conferência renderizada o chão, a fogueira e os pinheiros
   * simplesmente não apareciam, cortados pela barriga.
   *
   * Com -0.55 e 0.15×0.14, os QUATRO cantos ficam entre 0.016 e 0.052 à frente da superfície —
   * fora dela em todos, e perto o bastante pra não parecer um adesivo levantado.
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
   * Tanque de oxigênio nas costas — o Riebeck é astronauta, e sem ele o boneco vira só um bicho
   * gordo de gorro. UM cilindro só, a pedido do usuário (a primeira versão tinha dois lado a
   * lado). Sozinho ele ficou um pouco mais gordo que cada um do par, senão a mochila encolhia
   * junto e sumia atrás do corpo.
   *
   * A ALTURA foi baixada depois de ver rodando: com o topo em ~1.15 as duas calotas claras
   * apareciam uma de cada lado da cúpula amarela e o boneco ganhava um par de ORELHAS. A cabeça
   * mora em y=1.16 com raio 0.40, então qualquer coisa que suba até lá disputa silhueta com ela.
   * Agora o conjunto todo (válvula inclusive) termina em ~1.03, abaixo da linha do tricô (1.06).
   *
   * A consequência é que, de frente, o tanque fica quase todo escondido atrás do corpo — e está
   * certo assim: é uma mochila, ela aparece de lado e de trás. Isso é diferente do chapéu que foi
   * removido, que não aparecia de ângulo NENHUM e só deixava uma lasca solta no ombro.
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
   * Lanterna no ombro DIREITO dele. Direito dele é o -X: o personagem olha pro +Z com o +Y pra
   * cima, e `forward × up` dá -X — ou seja, ela aparece do lado ESQUERDO de quem olha, que é onde
   * ela está na foto.
   *
   * O ponto de apoio (-0.44, 0.99, 0.14) é a superfície da elipsoide do corpo naquela altura,
   * resolvida pra z, não um chute: no ombro a curva cai rápido, e errar por pouco deixa a
   * lanterna flutuando ao lado do boneco.
   */
  /**
   * LANTERNA DE MÃO presa ao traje, DEITADA e iluminando pra frente — não um lampião.
   *
   * A versão anterior estava errada e o usuário apontou: era um cilindro EM PÉ, com o vidro numa
   * faixa no meio entre duas peças escuras e uma alça de arame (`TorusGeometry`) no topo. Alça em
   * cima + vidro no meio é a silhueta de uma lamparina de furar a noite na mão, não a de uma
   * lanterna. Na referência (`riebeck/images.jpg`, vista de frente) o que aparece no ombro dele é
   * um DISCO claro — que é como uma lanterna deitada apontada pra frente se vê de frente.
   *
   * Por isso ela é montada ao longo do +Z (a frente do boneco) e não do +Y: cilindro do three
   * nasce no eixo Y, então cada peça leva `rotation.x = π/2` pra deitar. O vidro deixou de precisar
   * ser a peça mais larga pra aparecer — agora ele é a TAMPA DA FRENTE, e o que garante que ele
   * apareça é estar na ponta, à frente de todo o resto.
   */
  const lantern = new THREE.Group()
  /**
   * Ombro DIREITO dele, que é o -X: o personagem olha pro +Z com o +Y pra cima, e `forward × up`
   * dá -X — ou seja, ela aparece do lado ESQUERDO de quem olha, que é onde ela está na foto.
   *
   * O ponto sai da equação da elipsoide do corpo (semieixos 0.605 / 0.515 / 0.549 centrados em
   * y = 0.6), não de chute: em x = -0.40, y = 0.88 a superfície está em z ≈ 0.28. O grupo fica em
   * 0.34 pra que a traseira do cano (z local -0.09) entre um pouco no traje — é isso que faz ela
   * ler como PRESA nele, em vez de encostada por fora.
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
   * coordenadas espelhadas na mão: o punho verde, o anel creme e a mão precisam ficar alinhados
   * no mesmo eixo, e acertar isso três vezes com seno e cosseno na mão é onde a versão anterior
   * deixava o punho torto em relação ao braço.
   *
   * Espelhar com `scale.x = -1` seria mais curto e está errado: inverte a orientação das faces,
   * e o lado esquerdo ficaria com a iluminação furada.
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
       * A cúpula deixou de ser TECIDO e virou METAL DOURADO, a pedido do usuário ("o capacete é
       * meio metálico dourado"). Antes era um `fabric()` como o resto do boneco: veludo com sheen,
       * que dá halo de pelúcia e nenhum brilho de superfície.
       *
       * "MEIO metálico" é literal aqui — `metalness: 0.62`, não 1. Em metal puro não existe cor
       * difusa, só reflexo: os quatro olhos bordados e as costuras de gomo, que são PINTURA no
       * `map`, praticamente desapareceriam. Deixando parte da resposta difusa, o dourado brilha e o
       * bordado continua legível.
       *
       * `roughness: 0.34` dá metal escovado, não espelho — a cúpula da pelúcia é um tecido com
       * brilho, e um espelho perfeito refletiria a bandeja inteira na cabeça dele.
       *
       * Cor branca no material de propósito: o dourado já vem pintado no `map` junto com os olhos,
       * e um `color` amarelo por cima tingiria o bordado marrom e a pupila clara também.
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
   * NÃO tem o chapéu de aba larga que aparece pendurado nas costas na foto de baixo. Foi
   * modelado e removido depois de ver rodando: fica quase todo atrás do boneco no enquadramento
   * da cena, e o pouquinho que sobra pra fora aparece como uma lasca cinza espetada no ombro —
   * lê como bug, não como chapéu. Detalhe que só existe de um ângulo que a câmera não usa custa
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
   * O boneco AFUNDA um pouco antes de ser entregue, e é isto que corrige o "o Riebeck está
   * flutuando" de verdade — depois de duas tentativas erradas (altura da mesa, sombra de contato).
   *
   * Medindo as peças uma a uma: o corpo é uma esfera de raio 0.56 achatada em 0.92, centrada em
   * 0.60, ou seja, a barriga TERMINA em 0.085 — e a única coisa que descia até o chão eram as duas
   * botas, pequenas e lá na frente. De qualquer ângulo que não fosse bem de frente, a bola do
   * corpo aparecia pairando com um vão embaixo. Não era a altura do grupo (essa já estava certa),
   * era o boneco não encostar no chão dentro do próprio grupo.
   *
   * `SIT_DEPTH` chegou a 0.42 durante a caçada ao "está flutuando", e voltou pra 0.14 quando a
   * causa real apareceu: a respiração da pelúcia sobrescrevia `position.y` no laço de animação e
   * prendia o boneco na altura do chão da bandeja (ver o comentário grande lá, em
   * `DiceCanvasMulti.tsx`). Afundar o modelo nunca ia resolver aquilo — só ia enterrá-lo assim que
   * o bug fosse corrigido.
   *
   * ZERADO a pedido do usuário ("sobe o Riebeck"). Era 0.14: passava de propósito da tangência
   * exata (0.085, medida) pra barriga encostar e ceder um pouco, como pelúcia largada num gramado.
   * Em 0 o boneco sobe essas 0.14 e passa a se apoiar só nas BOTAS, que é o limite: elas terminam
   * exatamente em 0, então qualquer valor negativo daqui tira o boneco do chão e abre um vão de
   * verdade — o "está flutuando" que custou três tentativas erradas pra resolver.
   *
   * Na tela isso é cerca de UM pixel. Não é erro de valor: com `PLUSH_SCALE` 0.45 e a posição lá
   * atrás no gramado, a pelúcia inteira tem ~12px de altura, e 0.14 daqui vira 0.063 de mundo. Todo
   * o curso deste ajuste cabe nesse pixel — pra uma subida que dê pra ver, o que precisa mudar é o
   * tamanho ou a distância dela, não esta constante.
   *
   * A SOMBRA fica de fora deste deslocamento, presa ao grupo externo: ela tem que continuar
   * exatamente na altura do chão, senão afunda junto e some — que é justamente o que faria ela
   * parar de ancorar o boneco.
   */
  const SIT_DEPTH = 0
  group.position.y = -SIT_DEPTH

  const root = new THREE.Group()
  root.add(createContactShadow())
  root.add(group)
  return root
}
