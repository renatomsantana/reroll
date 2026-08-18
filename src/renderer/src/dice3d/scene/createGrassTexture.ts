import * as THREE from 'three'

/**
 * Grama procedural pro tampo da mesa onde a bandeja fica apoiada — pedido do usuário: "algo como
 * se fosse uma mesinha bonitinha de grama igual o tabletop rpg". A referência é o tapete de
 * terreno de uma mesa de RPG de verdade, não um gramado fotorrealista.
 *
 * SEGUNDA versão, depois do usuário ver a primeira e dizer "a grama tá bem falsa". O que estava
 * denunciando, e o que mudou:
 *
 * 1. LADRILHO REPETINDO NA CARA. O tile de 256px se repetia a cada 2 unidades de mundo, então a
 *    mesma manchinha aparecia dezenas de vezes em fileira — o olho pega esse padrão na hora.
 *    Agora o tile é de 512px cobrindo 8 unidades (4 repetições no tampo inteiro, contra 16).
 * 2. VARIAÇÃO SÓ NUMA ESCALA. Era grama uniforme + manchas de um tamanho só, o que lê como
 *    ruído. Grama de verdade varia em várias escalas ao mesmo tempo: manchões amplos de tom,
 *    tufos médios e as folhas. Agora são três camadas (ver `drawTonalNoise`).
 * 3. TEXTURA BORRADA NO ÂNGULO RASANTE. A câmera olha a mesa quase de lado, e é justamente aí
 *    que a filtragem padrão do GPU achata a textura numa papa. `anisotropy` resolve isso (o
 *    three limita sozinho ao máximo que a placa suporta, então pedir 8 é seguro).
 * 4. FOLHAS TODAS DO MESMO TAMANHO E COR. Agora variam em comprimento, largura, tom e
 *    inclinação, e uma parte delas é desenhada mais clara na ponta.
 *
 * Continua sem imagem externa (mesma política do resto do projeto — ver `createBrickTexture.ts`)
 * e com sorteio DETERMINÍSTICO (seed fixa), pra grama não mudar de desenho a cada remontagem.
 */

const SIZE = 768
/** Quantas unidades de mundo um ladrilho cobre. Quanto maior, menos óbvia a repetição. */
export const GRASS_TILE_WORLD_SIZE = 8
/**
 * Tufos: grama de verdade nasce em moitas, não espalhada em ruído uniforme (ver `drawClumps`).
 *
 * Menos tufos e mais largos que a primeira tentativa (520 de raio 5-16 → 260 de raio 10-26):
 * moitas pequenas e numerosas viravam MANCHAS claras espalhadas — o olho lê isso como sujeira na
 * textura, não como grama. O que a grama pede é muito detalhe FINO com pouco contraste, e a
 * variação grande em escala bem maior que o detalhe.
 */
const CLUMP_COUNT = 260
const BLADES_PER_CLUMP = 46
/** Folhas soltas espalhadas por cima dos tufos, pra não virar um carimbo de moitas. */
const LOOSE_BLADE_COUNT = 14000
const NORMAL_STRENGTH = 2.4

/** Terra por baixo: aparece nas falhas entre os tufos e é o que dá profundidade ao tapete. */
const SOIL_BASE = '#33301f'
const GRASS_BASE = '#3d6a2f'

/**
 * TRÊS famílias de folha, sorteadas por tufo — e é isto que separa grama de tapete sintético.
 *
 * A versão anterior tinha uma faixa só de verdes: cada folha variava de claro pra escuro, mas
 * todas com o MESMO matiz. Grama de verdade nunca é de um verde só — tem moitas mais azuladas
 * (à sombra, mais viçosas), moitas mais amarelas e falhas ressecadas de palha. Foi por isso que
 * o usuário disse que continuava "tipo sintética": a cor era uniforme demais, e cor uniforme é
 * exatamente o que grama artificial tem de característico.
 *
 * A escolha é POR TUFO (não por folha) porque quem seca ou pega sombra é a moita inteira, não
 * uma folha isolada no meio das outras.
 */
const BLADE_FAMILIES = {
  /** Verde comum — a maioria do gramado. */
  fresh: ['#2c5122', '#345a27', '#3c672d', '#447134', '#4d7d3a', '#578a41'],
  /** Palha: moitas ressecadas. Tom fechado de propósito — palha clara demais vira mancha amarela chapada em vez de grama seca. */
  dry: ['#4e4823', '#5b5429', '#68602f', '#756c37', '#827941', '#8f864c'],
  /** Verde mais fechado e azulado, das partes que pegam menos sol. */
  shade: ['#25441f', '#2b4d24', '#325628', '#3a602e', '#426b35', '#4a763c']
} as const
type BladeFamily = keyof typeof BLADE_FAMILIES

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Manchas de tom em três escalas (amplas, médias, pequenas). É o que dá a impressão de terreno
 * irregular por baixo da grama — sem isso o tapete fica com um verde chapado só, e nenhuma
 * quantidade de folhas desenhadas por cima disfarça.
 *
 * Cada mancha é desenhada também nas cópias deslocadas de um ladrilho (ver `drawWrapped`), senão
 * as que caem na borda aparecem cortadas e criam uma grade visível quando a textura se repete.
 */
function drawTonalNoise(ctx: CanvasRenderingContext2D, random: () => number): void {
  // Escalas bem separadas e contraste baixo: manchas próximas do tamanho dos tufos competiriam
  // com eles e voltariam a virar "sujeira" na textura.
  const layers = [
    { count: 22, min: 140, max: 300, alpha: 0.26 },
    { count: 60, min: 60, max: 140, alpha: 0.16 },
    { count: 120, min: 20, max: 50, alpha: 0.1 }
  ]

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const x = random() * SIZE
      const y = random() * SIZE
      const radius = layer.min + random() * (layer.max - layer.min)
      const lighter = random() > 0.5
      drawWrapped(x, y, radius, (px, py) => {
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius)
        gradient.addColorStop(
          0,
          lighter
            ? `rgba(120,170,86,${layer.alpha})`
            : `rgba(26,52,20,${layer.alpha})`
        )
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gradient
        ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2)
      })
    }
  }
}

/** Chama `draw` na posição original e nas cópias deslocadas de um ladrilho que ainda tocam a área — é o que faz o tile emendar sem costura. */
function drawWrapped(x: number, y: number, reach: number, draw: (px: number, py: number) => void): void {
  for (const offsetX of [0, -SIZE, SIZE]) {
    for (const offsetY of [0, -SIZE, SIZE]) {
      const px = x + offsetX
      const py = y + offsetY
      if (px + reach < 0 || px - reach > SIZE || py + reach < 0 || py - reach > SIZE) continue
      draw(px, py)
    }
  }
}

/** Uma folha: curva, com ponta mais clara em parte delas. Reta e de cor chapada, a folha lê como risco de caneta. */
function drawBlade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
  family: BladeFamily,
  colorIndex: number,
  width: number,
  alpha: number
): void {
  const palette = BLADE_FAMILIES[family]
  const dx = Math.cos(angle) * length
  const dy = Math.sin(angle) * length

  drawWrapped(x, y, length + width, (px, py) => {
    ctx.strokeStyle = palette[colorIndex]
    ctx.lineWidth = width
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(px, py)
    // A segunda metade inclina mais que a primeira, como folha dobrando com o próprio peso.
    ctx.quadraticCurveTo(px + dx * 0.45, py + dy * 0.5, px + dx, py + dy)
    ctx.stroke()

    if (colorIndex >= 3) {
      ctx.strokeStyle = palette[Math.min(palette.length - 1, colorIndex + 1)]
      ctx.lineWidth = width * 0.65
      ctx.globalAlpha = alpha * 0.8
      ctx.beginPath()
      ctx.moveTo(px + dx * 0.55, py + dy * 0.6)
      ctx.lineTo(px + dx, py + dy)
      ctx.stroke()
    }
  })
}

/** Sorteia a família do tufo: a maioria verde comum, uma minoria de palha e de verde sombreado. */
function pickFamily(random: () => number): BladeFamily {
  const roll = random()
  if (roll > 0.9) return 'dry'
  if (roll > 0.64) return 'shade'
  return 'fresh'
}

/**
 * Grama em TUFOS, não espalhada uniformemente.
 *
 * Era o que ainda fazia a grama parecer falsa mesmo depois de arrumar ladrilho e variação de
 * tom: folhas sorteadas com posição uniforme dão uma densidade constante em todo lugar, e
 * densidade constante é exatamente o que não existe na natureza. Grama nasce em moitas, com
 * falhas entre elas — e é nas falhas que a terra aparece, o que por sua vez dá profundidade.
 *
 * Cada tufo tem seu próprio tom base e sua própria inclinação dominante (como se o vento
 * tivesse penteado aquela moita), com as folhas variando em volta desses valores.
 */
function drawClumps(ctx: CanvasRenderingContext2D, random: () => number): void {
  ctx.lineCap = 'round'
  for (let c = 0; c < CLUMP_COUNT; c++) {
    const cx = random() * SIZE
    const cy = random() * SIZE
    const spread = 10 + random() * 16
    const clumpTilt = (random() - 0.5) * 0.9
    const family = pickFamily(random)
    const clumpTone = Math.floor(random() * (BLADE_FAMILIES[family].length - 2))
    const clumpHeight = 0.8 + random() * 0.6

    for (let i = 0; i < BLADES_PER_CLUMP; i++) {
      // Distribuição concentrada no meio da moita (soma de dois sorteios ≈ triangular), pra
      // borda do tufo rarear em vez de terminar num círculo nítido.
      const offsetX = (random() + random() - 1) * spread
      const offsetY = (random() + random() - 1) * spread
      const length = (5 + random() * 10) * clumpHeight
      const angle = -Math.PI / 2 + clumpTilt + (random() - 0.5) * 0.7
      // Quase todas as folhas ficam no tom do próprio tufo; só uma minoria clareia. Com
      // clareamento frequente o tufo inteiro subia de tom e virava a mancha clara de antes.
      const colorIndex = Math.min(
        BLADE_FAMILIES[family].length - 1,
        clumpTone + (random() > 0.88 ? 2 : random() > 0.62 ? 1 : 0)
      )
      drawBlade(
        ctx,
        cx + offsetX,
        cy + offsetY,
        length,
        angle,
        family,
        colorIndex,
        0.8 + random() * 1.2,
        0.55 + random() * 0.45
      )
    }
  }

  for (let i = 0; i < LOOSE_BLADE_COUNT; i++) {
    const family = pickFamily(random)
    drawBlade(
      ctx,
      random() * SIZE,
      random() * SIZE,
      4 + random() * 9,
      -Math.PI / 2 + (random() - 0.5) * 1.4,
      family,
      Math.floor(random() * BLADE_FAMILIES[family].length),
      0.7 + random() * 1.1,
      0.4 + random() * 0.5
    )
  }
  ctx.globalAlpha = 1
}

export interface GrassTextures {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
}

interface GrassCanvases {
  color: HTMLCanvasElement
  normal: HTMLCanvasElement
}

/**
 * Mesmo raciocínio de `createWoodTexture.ts`: o desenho é determinístico (seed fixa), só o
 * `repeat` muda entre chamadas, e ele mora na `Texture`. Aqui pesa ainda mais — o normal map
 * percorre 768×768 pixels lendo quatro vizinhos em cada um (≈2,4 milhões de leituras), e isso
 * acontecia em toda montagem da cena da bandeja.
 */
let cachedGrassCanvases: GrassCanvases | null = null

function drawGrassCanvases(): GrassCanvases {
  if (cachedGrassCanvases) return cachedGrassCanvases
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para a grama')

  const random = seededRandom(20260815)
  /**
   * Ordem das camadas: TERRA por baixo de tudo, grama rala por cima dela, variação de tom, e só
   * então os tufos. Assim o que aparece nas falhas entre as moitas é solo, não um verde chapado
   * — é o mesmo motivo de um mapa de RPG pintado ter a base marrom antes do verde.
   */
  ctx.fillStyle = SOIL_BASE
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = GRASS_BASE
  ctx.globalAlpha = 0.82
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.globalAlpha = 1
  drawTonalNoise(ctx, random)
  drawClumps(ctx, random)

  const colorData = ctx.getImageData(0, 0, SIZE, SIZE).data

  // Normal map derivado da LUMINÂNCIA da própria grama desenhada: folha clara = folha mais
  // alta. Sai coerente com o desenho de graça, sem manter um segundo mapa de altura à parte.
  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = SIZE
  normalCanvas.height = SIZE
  const normalCtx = normalCanvas.getContext('2d')
  if (!normalCtx) throw new Error('Não foi possível obter contexto 2D do canvas para o normal map da grama')
  const normalImage = normalCtx.createImageData(SIZE, SIZE)

  const height = (x: number, y: number): number => {
    const cx = ((x % SIZE) + SIZE) % SIZE
    const cy = ((y % SIZE) + SIZE) % SIZE
    const idx = (cy * SIZE + cx) * 4
    return (colorData[idx] * 0.3 + colorData[idx + 1] * 0.6 + colorData[idx + 2] * 0.1) / 255
  }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const nx = (height(x - 1, y) - height(x + 1, y)) * NORMAL_STRENGTH
      const ny = (height(x, y - 1) - height(x, y + 1)) * NORMAL_STRENGTH
      const length = Math.sqrt(nx * nx + ny * ny + 1)
      const idx = (y * SIZE + x) * 4
      normalImage.data[idx] = Math.round(((nx / length) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 3] = 255
    }
  }
  normalCtx.putImageData(normalImage, 0, 0)

  cachedGrassCanvases = { color: canvas, normal: normalCanvas }
  return cachedGrassCanvases
}

/** `repeat`: quantas vezes o ladrilho se repete ao longo da UV [0,1] do tampo (quem chama calcula a partir de `GRASS_TILE_WORLD_SIZE`). */
export function createGrassTextures(repeat: number): GrassTextures {
  const canvases = drawGrassCanvases()

  const map = new THREE.CanvasTexture(canvases.color)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = new THREE.CanvasTexture(canvases.normal)

  for (const texture of [map, normalMap]) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat, repeat)
    /**
     * Filtragem anisotrópica: a mesa é vista quase de lado no enquadramento padrão, e nesse
     * ângulo a filtragem comum borra a textura numa papa esverdeada — era metade do "tá falsa".
     * Pedir 8 é seguro em qualquer placa: o three limita sozinho ao máximo suportado.
     */
    texture.anisotropy = 8
  }

  return { map, normalMap }
}
