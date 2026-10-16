import { describe, expect, it } from 'vitest'
import { D10_FACE_INPUTS, D10_VERTICES } from '../../dice3d/dice-defs/d10'
import { D12_FACE_INPUTS, D12_VERTICES } from '../../dice3d/dice-defs/d12'
import { buildPolyhedronGeometry } from '../../dice3d/geometry/buildPolyhedronGeometry'
import { atlasGridFor, remapGeometryUvsToAtlas } from '../../dice3d/materials/createNumberAtlas'
import { simbolosDaFace } from './d12'
import { layoutDaFace } from './faceLayout'

type Point = [number, number]

function insidePolygon(point: Point, polygon: Point[]): boolean {
  const crosses = polygon.map(([ax, ay], i) => {
    const [bx, by] = polygon[(i + 1) % polygon.length]
    return (bx - ax) * (point[1] - ay) - (by - ay) * (point[0] - ax)
  })
  return crosses.every((cross) => cross >= -1e-6) || crosses.every((cross) => cross <= 1e-6)
}

function clippedCorners(contentRadius?: number, sides: 10 | 12 = 12): number {
  const { geometry, faces } = buildPolyhedronGeometry(sides === 10 ? D10_VERTICES : D12_VERTICES, sides === 10 ? D10_FACE_INPUTS : D12_FACE_INPUTS, contentRadius)
  const uv = geometry.getAttribute('uv')
  let clipped = 0
  faces.forEach((face, faceIndex) => {
    const polygon: Point[] = Array.from({ length: sides === 10 ? 4 : 5 }, (_, i) => [
      uv.getX(faceIndex * (sides === 10 ? 4 : 5) + i), uv.getY(faceIndex * (sides === 10 ? 4 : 5) + i)
    ])
    for (const { x, y, iconSize } of layoutDaFace(simbolosDaFace(face.value, sides).length, sides)) {
      for (const dx of [-iconSize / 2, iconSize / 2]) {
        for (const dy of [-iconSize / 2, iconSize / 2]) {
          // Canvas Y cresce para baixo; UV V cresce para cima.
          if (!insidePolygon([x + dx, 1 - y - dy], polygon)) clipped++
        }
      }
    }
  })
  geometry.dispose()
  return clipped
}

describe('símbolos do d12 ficam dentro da própria face', () => {
  it('reproduz o corte com o mapeamento de números e comporta todos os símbolos no novo mapeamento', () => {
    expect(clippedCorners()).toBeGreaterThan(0)
    expect(clippedCorners(0.38)).toBe(0)
  })

  it('símbolos do d10 também cabem nas faces em pipa', () => {
    expect(clippedCorners(0.25, 10)).toBe(0)
  })

  it('nenhuma face alcança as células vizinhas do atlas', () => {
    const { geometry, faces } = buildPolyhedronGeometry(D12_VERTICES, D12_FACE_INPUTS, 0.38)
    remapGeometryUvsToAtlas(geometry, faces.length)
    const { columns, rows } = atlasGridFor(faces.length)
    const uv = geometry.getAttribute('uv')
    faces.forEach((_, faceIndex) => {
      const column = faceIndex % columns
      const row = Math.floor(faceIndex / columns)
      for (let i = 0; i < 5; i++) {
        const u = uv.getX(faceIndex * 5 + i) * columns - column
        const v = uv.getY(faceIndex * 5 + i) * rows - (rows - 1 - row)
        expect(u).toBeGreaterThanOrEqual(0.0199)
        expect(u).toBeLessThanOrEqual(0.9801)
        expect(v).toBeGreaterThanOrEqual(0.0199)
        expect(v).toBeLessThanOrEqual(0.9801)
      }
    })
    geometry.dispose()
  })
})
