import * as THREE from 'three'

/**
 * Textura procedural de tijolo/pedra pra torre — desenhada num canvas 2D (mesma técnica já
 * usada pros números dos dados, ver `createNumberTexture.ts`), NÃO uma imagem externa. O
 * usuário trouxe referências reais (`ideias/`) de torres de castelo com padrão de tijolo visível
 * e pediu explicitamente "como está na imagem" depois de achar a torre anterior (lisa, cinza
 * sólida, com vários torreões separados) sem cara de castelo — um padrão de tijolo repetido é o
 * que mais rapidamente lê como "pedra de castelo" à distância, sem precisar de nenhum asset.
 *
 * Um único "ladrilho" (2 fiadas de tijolo, a de baixo deslocada meio tijolo — o padrão clássico
 * "running bond") é desenhado uma vez e repetido via `RepeatWrapping`; cada tijolo recebe uma
 * variação leve e determinística de tom (baseada na própria posição, não `Math.random()`, pra
 * não mudar a cada remount) pra não ficar "computador demais".
 *
 * Também gera um NORMAL MAP a partir do mesmo layout (junta de argamassa = baixo, tijolo = alto)
 * — pedido do usuário ("os tijolos ainda não estão tão realistas"): só variação de COR não dá
 * profundidade nenhuma sob luz direta, a argamassa precisa ler como realmente recuada. Mesma
 * técnica (altura → normal via diferenças centrais) já usada em `createVelvetNormalMap.ts`.
 */
const TILE_SIZE = 256
const BRICKS_PER_ROW = 4
const ROWS_PER_TILE = 2
// 5 → 7: junta mais grossa/visível — pedido repetido de "mais contraste, parecer torre da idade
// média" (uma junta fina lê como alvenaria nova/precisa, não pedra rústica de castelo).
const MORTAR_THICKNESS = 7
const MORTAR_HEIGHT = 0.15
const BRICK_HEIGHT = 0.9
// 3.5 → 5: sombra da argamassa mais funda sob luz direta, mesmo pedido de mais contraste.
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
  const heights = new Float32Array(TILE_SIZE * TILE_SIZE)
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      heights[y * TILE_SIZE + x] = isMortarPixel(x, y, rowHeight, brickWidth) ? MORTAR_HEIGHT : BRICK_HEIGHT
    }
  }
  return heights
}

function heightAt(heights: Float32Array, x: number, y: number): number {
  const cx = ((x % TILE_SIZE) + TILE_SIZE) % TILE_SIZE
  const cy = ((y % TILE_SIZE) + TILE_SIZE) % TILE_SIZE
  return heights[cy * TILE_SIZE + cx]
}

function buildNormalMap(heights: Float32Array): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para o normal map de tijolo')
  const image = ctx.createImageData(TILE_SIZE, TILE_SIZE)

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const left = heightAt(heights, x - 1, y)
      const right = heightAt(heights, x + 1, y)
      const up = heightAt(heights, x, y - 1)
      const down = heightAt(heights, x, y + 1)

      const nx = (left - right) * NORMAL_STRENGTH
      const ny = (up - down) * NORMAL_STRENGTH
      const nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

      const idx = (y * TILE_SIZE + x) * 4
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
 * Gera as texturas + aplica `repeat` proporcional às dimensões reais da superfície (largura ×
 * altura), pra o tijolo não sair esticado/achatado em superfícies de tamanhos bem diferentes
 * (casca alta vs. parede baixa da base).
 *
 * `brickWorldWidth`/`brickWorldHeight` existem pras peças PEQUENAS da torre ao lado da bandeja
 * (ameia, pilar do portão, soleira — ver `createTowerBesideTray.ts`). Um tijolo de 1.1 × 0.55 é
 * maior que uma ameia inteira: o `Math.max(1, ...)` abaixo cairia em 1 repetição e a peça sairia
 * com um tijolo só esticado por cima dela, que lê como mancha, não como alvenaria. Com tijolo
 * menor, a mesma peça mostra dois ou três de verdade.
 */
export function createBrickTexture(
  stoneColor: number,
  mortarColor: number,
  surfaceWidth: number,
  surfaceHeight: number,
  brickWorldWidth = 1.1,
  brickWorldHeight = 0.55
): BrickTextures {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para a textura de tijolo')

  ctx.fillStyle = shadeColor(mortarColor, 0)
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)

  const rowHeight = TILE_SIZE / ROWS_PER_TILE
  const brickWidth = TILE_SIZE / BRICKS_PER_ROW

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

  const repeatX = Math.max(1, Math.round(surfaceWidth / brickWorldWidth))
  const repeatY = Math.max(1, Math.round(surfaceHeight / brickWorldHeight))
  for (const texture of [map, normalMap]) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
  }

  return { map, normalMap }
}
