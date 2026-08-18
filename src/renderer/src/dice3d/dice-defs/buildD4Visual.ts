import * as THREE from 'three'
import { D4_DEFINITION, D4_FACE_INPUTS, D4_VERTICES } from './d4'
import { cross, dot, normalize, orientFaceOutward, subtract } from '../geometry/polyhedronMath'
import { numericColorToCss } from '../materials/createNumberTexture'
import { createDiceMaterial, type DiceMaterialFinish } from '../materials/createDiceMaterial'
import { createNumberAtlasTexture, remapGeometryUvsToAtlas } from '../materials/createNumberAtlas'
import { getCachedTexture, type DiceTextureCache } from '../materials/textureCache'

export interface D4VisualOptions {
  bodyColor?: number
  numberColor?: string
  material?: DiceMaterialFinish
  /** Ver `textureCache.ts` — opcional, reduz regeração de textura entre dados idênticos da mesma leva de construção. */
  textureCache?: DiceTextureCache
}

/**
 * `D4_FACE_INPUTS[i].value` é o valor do VÉRTICE i (ver comentário em
 * `d4.ts`: a face que omite o vértice i guarda, em `value`, o valor desse
 * vértice). Isso é exatamente o que precisamos aqui: o número impresso
 * perto do vértice V, em qualquer face que o contenha, é `CORNER_VALUE[V]`.
 */
const CORNER_VALUE = D4_FACE_INPUTS.map((f) => f.value)

/** Fração de como cada número é "puxado" do centro em direção ao seu vértice — perto do canto, sem colar na borda. */
const NUMBER_PULL_TOWARD_VERTEX = 0.62

interface CornerLabel {
  /** Posição do número em FRAÇÃO da célula (0..1, origem no canto superior esquerdo) — fração e não pixel porque a resolução da célula agora é escolhida pelo atlas (ver `createNumberAtlas.ts`). */
  position: [number, number]
  /** Ângulo de rotação (radianos) pra o número apontar "pra fora", do centro em direção ao vértice. */
  angle: number
  value: number
}

/**
 * Um d4 real imprime, em cada face, os 3 números dos OUTROS 3 vértices — não
 * um número da própria face. Cada dígito fica perto do vértice a que se
 * refere, rotacionado apontando "pra fora" (do centro da face em direção ao
 * vértice), assim quando o dado assenta, o vértice que fica pra cima tem seu
 * número lido em pé nas 3 faces visíveis ao redor dele. Sem isso, um número
 * centralizado por face (como os outros dados) fica sem sentido num
 * tetraedro — não existe "a face de cima" nele. Conferido contra a imagem
 * de referência em `png/d4.png`.
 */
function drawD4FaceCell(
  ctx: CanvasRenderingContext2D,
  corners: CornerLabel[],
  numberColor: string,
  cellPx: number
): void {
  // O fundo na cor do corpo já foi pintado pelo atlas inteiro (ver `createNumberAtlas.ts`) —
  // aqui só entram os 3 números. `corners` guarda a posição em fração da célula (0..1), então
  // funciona pra qualquer resolução de célula que o atlas escolher.
  ctx.fillStyle = numberColor
  ctx.font = `bold ${Math.round(cellPx * 0.22)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const corner of corners) {
    ctx.save()
    ctx.translate(corner.position[0] * cellPx, corner.position[1] * cellPx)
    ctx.rotate(corner.angle)
    ctx.fillText(String(corner.value), 0, 0)
    ctx.restore()
  }
}

export function buildD4Visual(options: D4VisualOptions = {}): THREE.Mesh {
  const bodyColor = options.bodyColor ?? 0xf2ead6
  const numberColor = options.numberColor ?? '#1a1a1a'

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  /** Números de cada face, na ordem dos grupos — viram as células do atlas (ver `createNumberAtlas.ts`). */
  const faceCorners: CornerLabel[][] = []
  const geometry = new THREE.BufferGeometry()

  const bodyColorCss = numericColorToCss(bodyColor)

  D4_FACE_INPUTS.forEach((faceInput, faceIndex) => {
    const { orderedVertexIndices, normal } = orientFaceOutward(D4_VERTICES, faceInput.vertexIndices)
    const facePoints = orderedVertexIndices.map((i) => D4_VERTICES[i])

    const uAxis = normalize(subtract(facePoints[1], facePoints[0]))
    const vAxis = normalize(cross(normal, uAxis))
    const projected = facePoints.map((p): [number, number] => [dot(p, uAxis), dot(p, vAxis)])

    const centroidU = (projected[0][0] + projected[1][0] + projected[2][0]) / 3
    const centroidV = (projected[0][1] + projected[1][1] + projected[2][1]) / 3

    // Escala o TRIÂNGULO inteiro pra caber com folga no quadrado de textura —
    // usa a distância até o VÉRTICE mais afastado do centróide (não a
    // distância até a aresta mais próxima, que é bem menor e fazia o
    // triângulo "estourar" pra fora do [0,1]).
    const maxVertexDistance = Math.max(
      ...projected.map(([u, v]) => Math.hypot(u - centroidU, v - centroidV))
    )
    const uvScale = 0.44 / maxVertexDistance

    const faceUVs = projected.map(
      ([u, v]): [number, number] => [
        0.5 + (u - centroidU) * uvScale,
        0.5 + (v - centroidV) * uvScale
      ]
    )

    const localBase = positions.length / 3
    for (let i = 0; i < 3; i++) {
      positions.push(...facePoints[i])
      uvs.push(...faceUVs[i])
    }
    const groupStart = indices.length
    indices.push(localBase, localBase + 1, localBase + 2)
    geometry.addGroup(groupStart, 3, faceIndex)

    faceCorners.push(
      faceUVs.map(([u, v], i) => {
        const offsetU = (u - 0.5) * NUMBER_PULL_TOWARD_VERTEX
        const offsetV = (v - 0.5) * NUMBER_PULL_TOWARD_VERTEX
        // V cresce "pra cima" na textura, Y do canvas cresce "pra baixo" — inverte.
        const position: [number, number] = [0.5 + offsetU, 0.5 - offsetV]
        const angle = Math.atan2(offsetU, offsetV)
        return { position, angle, value: CORNER_VALUE[orderedVertexIndices[i]] }
      })
    )
  })

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.scale(D4_DEFINITION.scale, D4_DEFINITION.scale, D4_DEFINITION.scale)

  // Atlas único com as 4 faces (ver `createNumberAtlas.ts`). A chave inclui os 3 números de
  // cada face porque é o conteúdo desenhado que muda de face pra face — no d4 não existe "o
  // número da face", cada uma mostra os números dos outros três vértices.
  const cacheKey = `atlas|d4|${numberColor}|${bodyColorCss}`
  const map = getCachedTexture(options.textureCache, cacheKey, () =>
    createNumberAtlasTexture(faceCorners.length, bodyColorCss, (ctx, faceIndex, cellPx) => {
      drawD4FaceCell(ctx, faceCorners[faceIndex], numberColor, cellPx)
    })
  )
  remapGeometryUvsToAtlas(geometry, faceCorners.length)

  const mesh = new THREE.Mesh(geometry, createDiceMaterial({ map, finish: options.material }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
