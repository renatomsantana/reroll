import * as THREE from 'three'

/**
 * Atlas de números: UMA textura com todas as faces de um dado lado a lado, em vez de uma textura (e um
 * material) POR FACE.
 *
 * O motivo é medido: cada grupo de material vira um `draw call` no three, e antes disso cada dado tinha
 * um grupo por face — um d100 sozinho custava 100 draw calls, e a prateleira decorativa custava 160
 * fixos por quadro, mais o mesmo tanto na passada de sombra. Medido com o HUD de debug: 5 dados na
 * cena davam 165 FPS, e 13 dados (8 deles d100) davam 97. Com o atlas cada dado tem UM material, então
 * o custo deixa de escalar com o número de faces.
 *
 * O truque é só de UV: a geometria continua a mesma, mas as UVs de cada face são reescritas do
 * quadrado [0,1] inteiro pra CÉLULA daquela face dentro do atlas.
 */

export interface AtlasGrid {
  columns: number
  rows: number
  /** Lado de cada célula em pixels de canvas. */
  cellPx: number
}

/**
 * Grade e resolução por célula. Dados com muitas faces (d100) ganham células menores de
 * propósito: 100 células a 256px dariam um canvas de 2560×2560 (26 MB só de pixels) pra
 * números que, na tela, aparecem numa facetinha de poucos pixels.
 */
export function atlasGridFor(faceCount: number): AtlasGrid {
  const columns = Math.ceil(Math.sqrt(faceCount))
  const rows = Math.ceil(faceCount / columns)
  const cellPx = faceCount <= 6 ? 256 : faceCount <= 24 ? 192 : 96
  return { columns, rows, cellPx }
}

/**
 * Desenha o atlas. `drawCell` recebe o contexto JÁ TRANSLADADO pro canto da célula, então quem chama
 * desenha em coordenadas locais sem se preocupar com onde ela está.
 *
 * `generateMipmaps: false` com `LinearFilter`: com mipmap, os níveis menores misturariam células
 * VIZINHAS num borrão, o que num atlas apareceria como número fantasma na face errada.
 */
export function createNumberAtlasTexture(
  faceCount: number,
  bodyColor: string,
  drawCell: (ctx: CanvasRenderingContext2D, faceIndex: number, cellPx: number) => void
): THREE.CanvasTexture {
  const { columns, rows, cellPx } = atlasGridFor(faceCount)
  const canvas = document.createElement('canvas')
  canvas.width = columns * cellPx
  canvas.height = rows * cellPx
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Não foi possível obter contexto 2D do canvas para desenhar o atlas do dado')
  }

  // Fundo na cor do CORPO em todo o atlas (inclusive nas células sobrando de uma grade que não
  // fecha exata) — mesmo motivo de sempre: a cor do corpo é a textura, não `material.color`
  // (ver `createNumberTexture.ts`).
  ctx.fillStyle = bodyColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const column = faceIndex % columns
    const row = Math.floor(faceIndex / columns)
    ctx.save()
    ctx.translate(column * cellPx, row * cellPx)
    drawCell(ctx, faceIndex, cellPx)
    ctx.restore()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

/**
 * Reescreve as UVs da geometria pra apontar pra célula do atlas de cada face, e apaga os grupos de
 * material, o que faz o three desenhar a malha inteira num único draw call.
 *
 * Depende de uma propriedade que todos os construtores de dado deste projeto garantem: nenhum vértice é
 * compartilhado entre faces (os poliedros e o d4 duplicam os vértices pra ter shading facetado, e o
 * `BoxGeometry` já nasce assim). Se dois grupos compartilhassem um vértice, remapear um estragaria o
 * outro. `group.materialIndex`, e não a ordem do grupo, é o índice da face.
 */
export function remapGeometryUvsToAtlas(geometry: THREE.BufferGeometry, faceCount: number): void {
  const { columns, rows } = atlasGridFor(faceCount)
  const index = geometry.getIndex()
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
  if (!index || !uv) return

  const remapped = new Set<number>()
  for (const group of geometry.groups) {
    const faceIndex = group.materialIndex ?? 0
    const column = faceIndex % columns
    const row = Math.floor(faceIndex / columns)
    for (let i = group.start; i < group.start + group.count; i++) {
      const vertexIndex = index.getX(i)
      if (remapped.has(vertexIndex)) continue
      remapped.add(vertexIndex)
      const u = uv.getX(vertexIndex)
      const v = uv.getY(vertexIndex)
      // V do canvas cresce pra BAIXO e o do UV pra CIMA (`flipY` padrão da textura já cuida da
      // imagem inteira) — por isso a linha 0 do canvas é a faixa de V mais ALTA no UV.
      uv.setXY(vertexIndex, (column + u) / columns, (rows - 1 - row + v) / rows)
    }
  }

  uv.needsUpdate = true
  geometry.clearGroups()
}
