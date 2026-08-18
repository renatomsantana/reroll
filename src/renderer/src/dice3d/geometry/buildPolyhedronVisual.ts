import * as THREE from 'three'
import type { Vector3Tuple } from '@shared/types/dice3d'
import type { PolyhedronFaceInput } from './polyhedronMath'
import { buildPolyhedronGeometry, POLYHEDRON_NUMBER_FONT_HEIGHT_FRACTION } from './buildPolyhedronGeometry'
import { drawNumberGlyph, numericColorToCss } from '../materials/createNumberTexture'
import { createDiceMaterial, type DiceMaterialFinish } from '../materials/createDiceMaterial'
import { createNumberAtlasTexture, remapGeometryUvsToAtlas } from '../materials/createNumberAtlas'
import { getCachedTexture, type DiceTextureCache } from '../materials/textureCache'

export interface PolyhedronVisualOptions {
  bodyColor?: number
  numberColor?: string
  scale?: number
  material?: DiceMaterialFinish
  /** Ver `textureCache.ts` — opcional, reduz regeração de textura entre dados idênticos da mesma leva de construção. */
  textureCache?: DiceTextureCache
}

/**
 * Constrói a malha visual de qualquer dado poliédrico (d4, d8, d10, d12,
 * d20) a partir dos mesmos vértices/faces usados pra `DiceDefinition` —
 * mesmo princípio do `buildD6Visual.ts`: a face de índice N sempre vira o
 * material de índice N, por construção.
 */
export function buildPolyhedronVisual(
  vertices: Vector3Tuple[],
  faceInputs: PolyhedronFaceInput[],
  options: PolyhedronVisualOptions = {}
): THREE.Mesh {
  const bodyColor = options.bodyColor ?? 0xf2ead6
  const numberColor = options.numberColor ?? '#1a1a1a'
  const bodyColorCss = numericColorToCss(bodyColor)
  const scale = options.scale ?? 1

  const { geometry, faces } = buildPolyhedronGeometry(vertices, faceInputs)
  geometry.scale(scale, scale, scale)

  /**
   * UM material com o atlas de todas as faces, em vez de um material+textura POR FACE — ver o
   * comentário grande em `createNumberAtlas.ts` (medição de FPS incluída). A chave de cache
   * inclui os VALORES das faces na ordem em que aparecem, porque é essa ordem que define qual
   * número cai em qual célula do atlas.
   */
  const cacheKey = `atlas|${faces.map((f) => f.value).join(',')}|${numberColor}|${bodyColorCss}|${POLYHEDRON_NUMBER_FONT_HEIGHT_FRACTION}`
  const map = getCachedTexture(options.textureCache, cacheKey, () =>
    createNumberAtlasTexture(faces.length, bodyColorCss, (ctx, faceIndex, cellPx) => {
      drawNumberGlyph(ctx, faces[faceIndex].value, cellPx, {
        numberColor,
        fontHeightFraction: POLYHEDRON_NUMBER_FONT_HEIGHT_FRACTION
      })
    })
  )
  remapGeometryUvsToAtlas(geometry, faces.length)

  const mesh = new THREE.Mesh(geometry, createDiceMaterial({ map, finish: options.material }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
