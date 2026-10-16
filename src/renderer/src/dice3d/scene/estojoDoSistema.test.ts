// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { computeShelfPositions, createShelfCaseMesh } from './DiceCanvasMulti'
import { TIPOS_ASSIMILACAO } from '../../experiments/assimilacao/d12'
import { disposeScene } from './disposeScene'

vi.mock('./createWoodTexture', () => ({ createWoodTextures: () => ({ map: new THREE.Texture(), normalMap: new THREE.Texture() }) }))

describe('estojo compacto de Assimilação', () => {
  it('tem só três posições, centradas e com o mesmo espaço entre dados', () => {
    const compact = computeShelfPositions(TIPOS_ASSIMILACAO)
    const normal = computeShelfPositions()
    expect(compact).toHaveLength(3)
    expect(normal).toHaveLength(7)
    expect(compact[1].x).toBe(0)
    expect(compact[0].x).toBe(-compact[2].x)
    expect(compact[1].x - compact[0].x).toBeCloseTo(normal[1].x - normal[0].x)
  })
  it('encurta a caixa e a tampa e reduz as divisórias de seis para duas', () => {
    const normal = createShelfCaseMesh(0, 0x445566, 0x223344)
    const compact = createShelfCaseMesh(0, 0x445566, 0x223344, TIPOS_ASSIMILACAO)
    const width = (g: THREE.Group) => new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).x
    const dividers = (g: THREE.Group) => {
      let count = 0
      g.traverse(o => { if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry && o.geometry.parameters.width === 0.05) count++ })
      return count
    }
    expect(width(compact.group)).toBeLessThan(width(normal.group) * 0.6)
    expect(dividers(normal.group)).toBe(6)
    expect(dividers(compact.group)).toBe(2)
    disposeScene(normal.group)
    disposeScene(compact.group)
  })
})
