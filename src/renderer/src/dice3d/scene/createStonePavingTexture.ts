import * as THREE from 'three'

/**
 * Textura de piso de pedra ("relevos de tijolos na terra", pedido do usuário depois do portão da
 * torre) — mesmo padrão "running bond" + normal map de `createBrickTexture.ts`, mas com o
 * `repeat` calculado em UNIDADES DE MUNDO em vez de UV normalizada: a base da torre
 * (`createBaseFloor` em `createTowerScene.ts`) é um `THREE.ShapeGeometry` (chão hexagonal), que
 * dá UV em unidades de mundo brutas (mesma pegadinha já documentada em `createScene.ts`/
 * `buildTowerShellGeometry.ts`, não a UV normalizada [0,1] que a casca cilíndrica da torre tem).
 * Duplica a técnica de desenho em vez de generalizar `createBrickTexture.ts` pra aceitar os dois
 * modos de UV — os dois casos são pequenos o bastante pra não valer uma abstração compartilhada.
 */
const TILE_SIZE = 256
const STONES_PER_ROW = 4
const ROWS_PER_TILE = 2
const MORTAR_THICKNESS = 6
const TILE_WORLD_SIZE = 1.6
const MORTAR_HEIGHT = 0.15
const STONE_HEIGHT = 0.9
const NORMAL_STRENGTH = 3

function seededShade(row: number, col: number): number {
  const n = Math.sin(row * 33.13 + col * 51.71) * 12321.987
  return (n - Math.floor(n)) * 0.22 - 0.11
}

function shadeColor(hex: number, amount: number): string {
  const color = new THREE.Color(hex)
  color.offsetHSL(0, 0, amount)
  return `#${color.getHexString()}`
}

function isMortarPixel(x: number, y: number, rowHeight: number, stoneWidth: number): boolean {
  const row = Math.floor(y / rowHeight)
  const offset = row % 2 === 0 ? 0 : stoneWidth / 2
  const xInRow = (((x - offset) % stoneWidth) + stoneWidth) % stoneWidth
  const yInRow = y - row * rowHeight
  return xInRow < MORTAR_THICKNESS || yInRow < MORTAR_THICKNESS
}

function heightAt(heights: Float32Array, x: number, y: number): number {
  const cx = ((x % TILE_SIZE) + TILE_SIZE) % TILE_SIZE
  const cy = ((y % TILE_SIZE) + TILE_SIZE) % TILE_SIZE
  return heights[cy * TILE_SIZE + cx]
}

function buildNormalMap(rowHeight: number, stoneWidth: number): THREE.CanvasTexture {
  const heights = new Float32Array(TILE_SIZE * TILE_SIZE)
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      heights[y * TILE_SIZE + x] = isMortarPixel(x, y, rowHeight, stoneWidth) ? MORTAR_HEIGHT : STONE_HEIGHT
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para o normal map do piso de pedra')
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

export interface StonePavingTextures {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
}

export function createStonePavingTexture(stoneColor: number, mortarColor: number): StonePavingTextures {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para o piso de pedra')

  ctx.fillStyle = shadeColor(mortarColor, 0)
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)

  const rowHeight = TILE_SIZE / ROWS_PER_TILE
  const stoneWidth = TILE_SIZE / STONES_PER_ROW
  for (let row = 0; row < ROWS_PER_TILE; row++) {
    const offset = row % 2 === 0 ? 0 : stoneWidth / 2
    for (let col = -1; col < STONES_PER_ROW; col++) {
      const x = col * stoneWidth + offset + MORTAR_THICKNESS / 2
      const y = row * rowHeight + MORTAR_THICKNESS / 2
      const w = stoneWidth - MORTAR_THICKNESS
      const h = rowHeight - MORTAR_THICKNESS
      ctx.fillStyle = shadeColor(stoneColor, seededShade(row, col))
      ctx.fillRect(x, y, w, h)
    }
  }

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = buildNormalMap(rowHeight, stoneWidth)

  for (const texture of [map, normalMap]) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(1 / TILE_WORLD_SIZE, 1 / TILE_WORLD_SIZE)
  }

  return { map, normalMap }
}
