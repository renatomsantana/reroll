import * as THREE from 'three'

/**
 * Textura procedural de tijolo pra torre, desenhada num canvas 2D (a mesma técnica dos números dos
 * dados) e não uma imagem externa: um padrão de tijolo repetido é o que mais rápido lê como pedra de
 * castelo à distância, sem asset nenhum. Um ladrilho de fiadas deslocadas meio tijolo (o "running
 * bond" clássico) é desenhado uma vez e repetido por `RepeatWrapping`, com variação de tom
 * determinística pela própria posição (e não `Math.random()`, que mudaria a cada remount).
 *
 * Também sai um NORMAL MAP do mesmo layout (junta de argamassa = baixo, tijolo = alto), porque só
 * variação de cor não dá profundidade sob luz direta e a argamassa precisa ler como recuada.
 *
 * O LADRILHO é calibrado pra ter a mesma escala de pixel nos dois eixos: cobre 8 tijolos por fiada e
 * 8 fiadas, o que em unidades de mundo dá 8.8 × 4.4, ou seja 2:1 — daí o canvas ser 512×256 e não
 * quadrado. Quadrado era um erro silencioso: com o mesmo número de pixels cobrindo 8.8 na horizontal
 * e 4.4 na vertical, a junta saía com o dobro da grossura num eixo e metade no outro. Mais tijolo por
 * ladrilho é a outra metade do conserto da repetição: 64 pedras diferentes antes de o desenho
 * repetir, em vez de 8.
 */
const TILE_WIDTH = 512
const TILE_HEIGHT = 256
const BRICKS_PER_ROW = 8
const ROWS_PER_TILE = 8
/** Junta em pixel. 5 sobre um tijolo de 64x32 dá ~0.09 de mundo — grossa o suficiente pra ler como pedra rústica. */
const MORTAR_THICKNESS = 5
const MORTAR_HEIGHT = 0.15
const BRICK_HEIGHT = 0.9
const NORMAL_STRENGTH = 5

function seededShade(row: number, col: number): number {
  // Variação determinística de tom entre tijolos — era ±13% (±8% antes disso). Aumentada de novo
  // pra ±20% nesta rodada: pedido repetido do usuário ("mais contraste... torre da idade média"),
  // blocos de pedra desgastados de verdade variam bem mais de tom entre si que alvenaria uniforme.
  const n = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453
  return (n - Math.floor(n)) * 0.4 - 0.2
}

function shadeColor(hex: number, amount: number): string {
  const color = new THREE.Color(hex)
  color.offsetHSL(0, 0, amount)
  return `#${color.getHexString()}`
}

/** true se `(x, y)` cai dentro da junta de argamassa (borda de um tijolo) desse ladrilho — mesmo layout usado tanto pro canvas de cor quanto pro mapa de altura, pra ficarem perfeitamente coerentes. */
function isMortarPixel(x: number, y: number, rowHeight: number, brickWidth: number): boolean {
  const row = Math.floor(y / rowHeight)
  const offset = row % 2 === 0 ? 0 : brickWidth / 2
  const xInRow = (((x - offset) % brickWidth) + brickWidth) % brickWidth
  const yInRow = y - row * rowHeight
  return xInRow < MORTAR_THICKNESS || yInRow < MORTAR_THICKNESS
}

function buildHeightMap(rowHeight: number, brickWidth: number): Float32Array {
  const heights = new Float32Array(TILE_WIDTH * TILE_HEIGHT)
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      heights[y * TILE_WIDTH + x] = isMortarPixel(x, y, rowHeight, brickWidth) ? MORTAR_HEIGHT : BRICK_HEIGHT
    }
  }
  return heights
}

function heightAt(heights: Float32Array, x: number, y: number): number {
  const cx = ((x % TILE_WIDTH) + TILE_WIDTH) % TILE_WIDTH
  const cy = ((y % TILE_HEIGHT) + TILE_HEIGHT) % TILE_HEIGHT
  return heights[cy * TILE_WIDTH + cx]
}

function buildNormalMap(heights: Float32Array): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_WIDTH
  canvas.height = TILE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para o normal map de tijolo')
  const image = ctx.createImageData(TILE_WIDTH, TILE_HEIGHT)

  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      const left = heightAt(heights, x - 1, y)
      const right = heightAt(heights, x + 1, y)
      const up = heightAt(heights, x, y - 1)
      const down = heightAt(heights, x, y + 1)

      const nx = (left - right) * NORMAL_STRENGTH
      const ny = (up - down) * NORMAL_STRENGTH
      const nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

      const idx = (y * TILE_WIDTH + x) * 4
      image.data[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      image.data[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
      image.data[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255)
      image.data[idx + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return new THREE.CanvasTexture(canvas)
}

export interface BrickTextures {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
}

/**
 * Gera as texturas e aplica `repeat` proporcional às dimensões reais da superfície, pra o tijolo não
 * sair esticado numa peça e achatado noutra.
 *
 * `brickWorldWidth`/`brickWorldHeight` existem pras peças PEQUENAS da torre ao lado da bandeja
 * (ameia, pilar do portão, soleira): um tijolo de 1.1 × 0.55 é maior que uma ameia inteira, e a peça
 * sairia com um tijolo só esticado por cima, que lê como mancha e não como alvenaria.
 */
export function createBrickTexture(
  stoneColor: number,
  mortarColor: number,
  surfaceWidth: number,
  surfaceHeight: number,
  brickWorldWidth = 1.1,
  brickWorldHeight = 0.55,
  /**
   * Se o tamanho da pedra pode ser ENCOLHIDO pra caber um tanto mínimo dela na peça. `false` quando
   * quem chama já escolheu a pedra a dedo, como a cantaria do portão, onde a ombreira pede um bloco
   * tão largo quanto ela e a verga pede cinco deitadas: ali o ajuste automático encolhia a pedra
   * pedida até caber 1.6, e o pedido virava outra coisa.
   */
  ajustarPecaPequena = true
): BrickTextures {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_WIDTH
  canvas.height = TILE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para a textura de tijolo')

  ctx.fillStyle = shadeColor(mortarColor, 0)
  ctx.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT)

  const rowHeight = TILE_HEIGHT / ROWS_PER_TILE
  const brickWidth = TILE_WIDTH / BRICKS_PER_ROW

  for (let row = 0; row < ROWS_PER_TILE; row++) {
    const offset = row % 2 === 0 ? 0 : brickWidth / 2
    // Uma coluna extra pra cobrir o deslocamento nas bordas do tile (o wrap cuida do resto).
    for (let col = -1; col < BRICKS_PER_ROW; col++) {
      const x = col * brickWidth + offset + MORTAR_THICKNESS / 2
      const y = row * rowHeight + MORTAR_THICKNESS / 2
      const w = brickWidth - MORTAR_THICKNESS
      const h = rowHeight - MORTAR_THICKNESS
      ctx.fillStyle = shadeColor(stoneColor, seededShade(row, col))
      ctx.fillRect(x, y, w, h)
    }
  }

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace

  const normalMap = buildNormalMap(buildHeightMap(rowHeight, brickWidth))

  /**
   * Quantas vezes o tile se repete na superfície, FRACIONÁRIO quando a peça é menor que um tile. Era
   * `Math.max(1, Math.round(...))`, e esse piso de 1 é que deixava as ameias e o portão feios: numa
   * ameia de 0.5 de largura a conta dá 0.45, o piso subia pra 1, e uma repetição inteira significa o
   * tile inteiro espremido numa pedra de meio metro. Trocar o TAMANHO do tijolo não resolvia nada,
   * porque o piso apagava a conta antes dela chegar aqui.
   *
   * O arredondamento continua pra quem passa de um tile: numa superfície que dá a VOLTA (casca,
   * pedestal, cornija) uma repetição fracionária corta o tijolo ao meio onde a textura fecha.
   */
  const inteiroOuFracao = (bruto: number): number => (bruto >= 1 ? Math.round(bruto) : bruto)
  /**
   * A conta divide pelo tamanho do LADRILHO, não pelo de um tijolo, e era daí que vinham duas queixas
   * de uma vez ("tão mt repetidos e colados um no outro"): com o divisor errado o ladrilho inteiro era
   * espremido no espaço de um tijolo, cada tijolo saía com 1/6 da largura devida, e a junta virava
   * sub-pixel na tela. Medido na casca da torre: circunferência 9.11 com tijolo de 1.1 dava 8
   * repetições (32 tijolos na volta, de 0.28 cada); agora dá 1, com os tijolos no tamanho certo.
   */
  /**
   * PEÇA PEQUENA ganha tijolo menor, pra continuar mostrando alvenaria em vez de mancha: o tijolo
   * encolhe até caberem uns dois e meio, que é o mínimo pra a junta aparecer. `Math.min` porque isso
   * só pode ENCOLHER, senão a casca ganharia pedras gigantes.
   */
  const TIJOLOS_MINIMOS = 1.6
  /**
   * O encolhimento é PROPORCIONAL, um fator só pros dois eixos, e é isso que preserva a forma do
   * tijolo. Eixo a eixo, cada peça esticava a pedra num sentido diferente: a ombreira do portão
   * (0.29 × 1.78) saía com tijolo quatro vezes mais alto que largo e a verga (2.46 × 0.32) com um
   * sete vezes mais largo que alto. Não era tamanho, era PROPORÇÃO. Com um fator único, o tijolo do
   * portão é o mesmo da torre, só menor, que é o que acontece numa construção de verdade.
   */
  const fator = ajustarPecaPequena
    ? Math.min(
        1,
        surfaceWidth / (TIJOLOS_MINIMOS * brickWorldWidth),
        surfaceHeight / (TIJOLOS_MINIMOS * brickWorldHeight)
      )
    : 1
  const larguraDoTijolo = brickWorldWidth * fator
  const alturaDoTijolo = brickWorldHeight * fator
  const repeatX = inteiroOuFracao(surfaceWidth / (larguraDoTijolo * BRICKS_PER_ROW))
  const repeatY = inteiroOuFracao(surfaceHeight / (alturaDoTijolo * ROWS_PER_TILE))
  for (const texture of [map, normalMap]) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
  }

  return { map, normalMap }
}
