import * as THREE from 'three'

/**
 * Texturas procedurais simulando o pelo do veludo: com só `sheen`/`sheenRoughness` ele testou o chão da
 * bandeja e disse que "ainda não parece veludo" — um `sheen` de fresnel puro só fica visível em ângulo
 * rasante, e a câmera padrão olha de cima.
 *
 * Duas camadas, e não uma, e essa é a lição medida: um `normalMap` sozinho (variação de ALTURA, que
 * muda a sombra conforme a luz bate) ficou visível de perto e quase sumia no enquadramento padrão,
 * porque a sensibilidade dele depende do ângulo entre luz e câmera. Um `map` (variação de COR, tipo AO
 * barato) é visível em qualquer ângulo, porque não depende de resposta de iluminação — só multiplica a
 * cor base. Os dois combinados, sobre o mesmo mapa de altura, leem como tecido de perto e de longe.
 *
 * Técnica: desenha um mapa de ALTURA (manchas suaves com seed determinística, sem `Math.random()`, pra
 * não mudar a cada remount) e dele saem os dois mapas — o normal por diferenças centrais, e o de
 * sombreado pelo próprio valor de altura, suavizado.
 */
const SIZE = 128
const BUMP_COUNT = 900
const BUMP_RADIUS = 1.6
const NORMAL_STRENGTH = 5.5
/** Repeats every this many world units — ver nota grande sobre a UV do `ExtrudeGeometry` mais abaixo. */
const TILE_WORLD_SIZE = 1.0
/** Quanto o mapa de sombreado escurece/clareia a cor base (0 = sem efeito, 1 = preto/branco puro nas pontas). Baixo de propósito — é reforço sutil, não um padrão xadrez. */
const SHADING_CONTRAST = 0.22

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function buildHeightMap(): Float32Array {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas pro mapa de altura do veludo')

  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const rand = seededRandom(20260731)
  for (let i = 0; i < BUMP_COUNT; i++) {
    const x = rand() * SIZE
    const y = rand() * SIZE
    const brightness = 96 + Math.floor(rand() * 96)
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, BUMP_RADIUS)
    gradient.addColorStop(0, `rgba(${brightness},${brightness},${brightness},0.9)`)
    gradient.addColorStop(1, 'rgba(128,128,128,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - BUMP_RADIUS, y - BUMP_RADIUS, BUMP_RADIUS * 2, BUMP_RADIUS * 2)
  }

  const heights = new Float32Array(SIZE * SIZE)
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data
  for (let i = 0; i < SIZE * SIZE; i++) heights[i] = data[i * 4] / 255
  return heights
}

/** Repete o vizinho na borda (`clamp`) em vez de estourar índice — evita ruído artificial nas bordas do tile. */
function heightAt(heights: Float32Array, x: number, y: number): number {
  const cx = Math.min(SIZE - 1, Math.max(0, x))
  const cy = Math.min(SIZE - 1, Math.max(0, y))
  return heights[cy * SIZE + cx]
}

/**
 * `repeat` explicado: o `ExtrudeGeometry` gera a UV das tampas com o `WorldUVGenerator` padrão, que usa
 * a posição X/Y BRUTA do vértice, em unidades de mundo, como U/V — e não normalizada pra [0,1] como a
 * maioria das outras geometrias (o `CylinderGeometry` inclusive, que é por isso que a textura de tijolo
 * da torre nunca teve esse problema). Confirmado inspecionando o atributo `uv` da geometria fora do
 * Electron: os valores batiam com a posição do vértice.
 *
 * Como o `repeat` multiplica a UV existente, tratar essa UV-em-unidades-de-mundo como [0,1] inflava a
 * repetição em ~15× — a textura ficava tão fina que o mipmapping a achatava numa cor quase uniforme,
 * sem efeito visível em intensidade nenhuma. Já que a UV está em unidades de mundo, o `repeat` certo é
 * `1/tileWorldSize`, e não depende do tamanho da superfície.
 */
function configureTiling(texture: THREE.CanvasTexture): void {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / TILE_WORLD_SIZE, 1 / TILE_WORLD_SIZE)
}

export interface VelvetTextures {
  normalMap: THREE.CanvasTexture
  /** Multiplica a cor base do material — funciona em QUALQUER ângulo de câmera/luz, ver comentário grande no topo do arquivo. */
  shadingMap: THREE.CanvasTexture
}

export function createVelvetTextures(): VelvetTextures {
  const heights = buildHeightMap()

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = SIZE
  normalCanvas.height = SIZE
  const normalCtx = normalCanvas.getContext('2d')
  if (!normalCtx) throw new Error('Não foi possível obter contexto 2D do canvas pro normal map do veludo')
  const normalImage = normalCtx.createImageData(SIZE, SIZE)

  const shadingCanvas = document.createElement('canvas')
  shadingCanvas.width = SIZE
  shadingCanvas.height = SIZE
  const shadingCtx = shadingCanvas.getContext('2d')
  if (!shadingCtx) throw new Error('Não foi possível obter contexto 2D do canvas pro mapa de sombreado do veludo')
  const shadingImage = shadingCtx.createImageData(SIZE, SIZE)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const left = heightAt(heights, x - 1, y)
      const right = heightAt(heights, x + 1, y)
      const up = heightAt(heights, x, y - 1)
      const down = heightAt(heights, x, y + 1)

      const nx = (left - right) * NORMAL_STRENGTH
      const ny = (up - down) * NORMAL_STRENGTH
      const nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

      const idx = (y * SIZE + x) * 4
      normalImage.data[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 3] = 255

      // heightAt já devolve [0,1] centrado em ~0.5 — reprojeta em torno de 1.0 (multiplicador
      // neutro) com contraste baixo, pra clarear/escurecer a cor base sem nunca estourar preto/
      // branco puro.
      const center = heightAt(heights, x, y) - 0.5
      const shade = Math.min(1, Math.max(0, 1 + center * SHADING_CONTRAST * 2))
      const gray = Math.round(shade * 255)
      shadingImage.data[idx] = gray
      shadingImage.data[idx + 1] = gray
      shadingImage.data[idx + 2] = gray
      shadingImage.data[idx + 3] = 255
    }
  }

  normalCtx.putImageData(normalImage, 0, 0)
  shadingCtx.putImageData(shadingImage, 0, 0)

  const normalMap = new THREE.CanvasTexture(normalCanvas)
  const shadingMap = new THREE.CanvasTexture(shadingCanvas)
  // `shadingMap` vai no slot `map` (cor) — precisa de sRGB, igual `createNumberTexture.ts`.
  // `normalMap` fica no espaço linear padrão (normal maps nunca são sRGB).
  shadingMap.colorSpace = THREE.SRGBColorSpace
  configureTiling(normalMap)
  configureTiling(shadingMap)

  return { normalMap, shadingMap }
}
