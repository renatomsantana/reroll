import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { arranjoDaInclusao, raioInscrito } from './inclusaoDeResina'
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

describe('o arranjo das inclusões', () => {
  it('cabe inteiro dentro da esfera inscrita, contando a diagonal de cada plano', () => {
    for (const semente of [8, 24, 36, 60, 120]) {
      for (const inclusao of arranjoDaInclusao(1, semente)) {
        const alcance = inclusao.posicao.length() + (inclusao.tamanho * Math.SQRT2) / 2
        expect(alcance).toBeLessThanOrEqual(1)
      }
    }
  })

  it('é o mesmo arranjo pra mesma semente, então trocar a cor não rearruma a flor', () => {
    const primeiro = arranjoDaInclusao(0.3, 24)
    const segundo = arranjoDaInclusao(0.3, 24)
    expect(primeiro.map((i) => i.posicao.toArray())).toEqual(segundo.map((i) => i.posicao.toArray()))
    expect(arranjoDaInclusao(0.3, 36).map((i) => i.posicao.toArray())).not.toEqual(primeiro.map((i) => i.posicao.toArray()))
  })

  it('tem flor e folha, e escala com o raio', () => {
    const arranjo = arranjoDaInclusao(0.5, 24)
    expect(arranjo.some((i) => i.tipo.startsWith('flor'))).toBe(true)
    expect(arranjo.some((i) => i.tipo === 'folha')).toBe(true)
    const dobro = arranjoDaInclusao(1, 24)
    expect(dobro[0].tamanho).toBeCloseTo(arranjo[0].tamanho * 2, 6)
  })
})
