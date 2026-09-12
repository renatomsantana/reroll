import * as THREE from 'three'
import { D6_DEFINITION } from './d6'
import { drawNumberGlyph, numericColorToCss } from '../materials/createNumberTexture'
import { createDiceMaterial, ehResina, type DiceMaterialFinish } from '../materials/createDiceMaterial'
import { createNumberAtlasTexture, remapGeometryUvsToAtlas } from '../materials/createNumberAtlas'
import { getCachedTexture, type DiceTextureCache } from '../materials/textureCache'
import { corDoCorpoDeResina, montarDadoDeResina, OPACIDADE_DO_CORPO_DE_RESINA } from '../materials/inclusaoDeResina'

export interface D6VisualOptions {
  bodyColor?: number
  numberColor?: string
  material?: DiceMaterialFinish
  /** As cores da flor 1 e da flor 2 do dado de resina. */
  flores?: [string, string]
  /** As cores da lua e do cristal do dado de resina com luas e cristais. */
  luas?: [string, string]
  /** Ver `textureCache.ts` — opcional, reduz regeração de textura entre dados idênticos da mesma leva de construção. */
  textureCache?: DiceTextureCache
}

/**
 * Constrói a malha do d6 consumindo `D6_DEFINITION.faces` na mesma ordem dos
 * grupos de material do `BoxGeometry`. A face de índice N do array sempre
 * vira o material de índice N — o número desenhado bate com o valor
 * declarado na definição por construção, não por coincidência ou ajuste manual.
 */
export function buildD6Visual(options: D6VisualOptions = {}): THREE.Mesh {
  const bodyColor = options.bodyColor ?? 0xf2ead6
  const numberColor = options.numberColor ?? '#1a1a1a'
  const bodyColorCss = numericColorToCss(bodyColor)
  const resina = ehResina(options.material)
  const opacidadeDoCorpo = resina ? OPACIDADE_DO_CORPO_DE_RESINA : 1
  const corDoCorpo = resina ? corDoCorpoDeResina(bodyColorCss) : bodyColorCss

  const geometry = new THREE.BoxGeometry(
    D6_DEFINITION.scale,
    D6_DEFINITION.scale,
    D6_DEFINITION.scale
  )

  // Atlas único com as 6 faces (ver `createNumberAtlas.ts`) — os grupos de material do
  // `BoxGeometry` já vêm na mesma ordem de `D6_DEFINITION.faces`, então a face de índice N
  // continua sendo a de valor `faces[N].value`, agora numa célula do atlas em vez de numa
  // textura própria.
  const cacheKey = `atlas|d6|${numberColor}|${bodyColorCss}|0.8|${opacidadeDoCorpo}`
  const map = getCachedTexture(options.textureCache, cacheKey, () =>
    createNumberAtlasTexture(D6_DEFINITION.faces.length, corDoCorpo, (ctx, faceIndex, cellPx) => {
      drawNumberGlyph(ctx, D6_DEFINITION.faces[faceIndex].value, cellPx, {
        numberColor,
        fontHeightFraction: 0.8
      })
    }, opacidadeDoCorpo)
  )
  remapGeometryUvsToAtlas(geometry, D6_DEFINITION.faces.length)

  const mesh = new THREE.Mesh(geometry, createDiceMaterial({ map, finish: options.material }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (resina && options.material) montarDadoDeResina(mesh, options.material, { flores: options.flores, luas: options.luas })
  return mesh
}
