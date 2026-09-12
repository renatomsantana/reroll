import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { raioInscrito } from './inclusaoDeResina'
import { alcance, cabecaDaFlor, FORMAS, geradorDe, jardim, planta } from './florDeResina'
import { ceu, cristal, lua } from './luasECristais'
import { buildPolyhedronGeometry } from '../geometry/buildPolyhedronGeometry'
import { D4_VERTICES } from '../dice-defs/d4'
import { D20_FACE_INPUTS, D20_VERTICES } from '../dice-defs/d20'

describe('o raio inscrito', () => {
  it('num cubo de lado 2 é 1, a distância do centro a cada face', () => {
    expect(raioInscrito(new THREE.BoxGeometry(2, 2, 2))).toBeCloseTo(1, 6)
  })

  it('num d20 é menor que o raio de contorno, e é a face mais perto do centro', () => {
    const { geometry } = buildPolyhedronGeometry(D20_VERTICES, D20_FACE_INPUTS)
    geometry.computeBoundingSphere()
    const contorno = geometry.boundingSphere?.radius ?? 0
    const inscrito = raioInscrito(geometry)
    expect(inscrito).toBeGreaterThan(0)
    expect(inscrito).toBeLessThan(contorno)
    // Icosaedro: inscrito/circunscrito = 0,7947.
    expect(inscrito / contorno).toBeCloseTo(0.7947, 2)
  })

  it('num tetraedro é um terço do contorno, que é o caso em que o contorno mais mentiria', () => {
    const geometria = new THREE.BufferGeometry()
    const pontos: number[] = []
    const [a, b, c, d] = D4_VERTICES
    for (const tri of [[a, b, c], [a, c, d], [a, d, b], [b, d, c]]) for (const v of tri) pontos.push(...v)
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(pontos, 3))
    geometria.computeBoundingSphere()
    const contorno = geometria.boundingSphere?.radius ?? 0
    expect(raioInscrito(geometria) / contorno).toBeCloseTo(1 / 3, 2)
  })
})

describe('o jardim de resina', () => {
  it('cabe inteiro dentro da esfera inscrita, em todas as sementes dos sete dados', () => {
    // Sementes = contagem de vértices de cada geometria; qualquer número serve, mas estes são os reais.
    for (const semente of [8, 24, 36, 60, 120, 240, 1000]) {
      expect(alcance(jardim(1, semente))).toBeLessThan(1)
    }
  })

  it('é o mesmo jardim pra mesma semente, então trocar a cor não replanta o dado', () => {
    const a = alcance(jardim(0.3, 24))
    const b = alcance(jardim(0.3, 24))
    expect(a).toBe(b)
    expect(alcance(jardim(0.3, 36))).not.toBe(a)
  })

  it('tem volume: os vértices de uma cabeça de flor não ficam num plano só', () => {
    const cabeca = cabecaDaFlor(FORMAS.margarida, '#b48ae0', 1, geradorDe(7))
    cabeca.updateMatrixWorld(true)
    const alturas: number[] = []
    const p = new THREE.Vector3()
    cabeca.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const pos = obj.geometry.getAttribute('position')
      for (let i = 0; i < pos.count; i++) alturas.push(p.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld).y)
    })
    expect(Math.max(...alturas) - Math.min(...alturas)).toBeGreaterThan(0.2)
  })

  it('o céu de luas e cristais cabe na esfera inscrita, em todas as sementes dos sete dados', () => {
    for (const semente of [8, 24, 36, 60, 120, 240, 1000]) {
      expect(alcance(ceu(1, semente))).toBeLessThan(1)
    }
  })

  it('o cristal tem corpo e ponta, e a lua é uma crescente extrudada com volume', () => {
    let malhas = 0
    cristal(1, 0.2, '#9b5de5').traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry.getAttribute('position')) malhas++
    })
    expect(malhas).toBeGreaterThanOrEqual(2)
    const l = lua(1, 0.3, '#f3dd9c')
    l.geometry.computeBoundingBox()
    const caixa = l.geometry.boundingBox as THREE.Box3
    expect(caixa.max.z - caixa.min.z).toBeGreaterThan(0.3)
    expect(caixa.max.x - caixa.min.x).toBeLessThan(2)
  })

  it('a planta tem caule, folhas e a cabeça: mais de dez malhas', () => {
    const p = planta(FORMAS.rosa, '#ea7fb0', 1, 0.4, geradorDe(3))
    let malhas = 0
    p.traverse((obj) => {
      if (obj instanceof THREE.Mesh) malhas++
    })
    expect(malhas).toBeGreaterThan(10)
  })
})
