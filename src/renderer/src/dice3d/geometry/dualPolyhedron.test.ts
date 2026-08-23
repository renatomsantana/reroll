import { describe, expect, it } from 'vitest'
import type { Vector3Tuple } from '@shared/types/dice3d'
import { buildDualFromNormals } from './dualPolyhedron'
import { antipodalDirections } from './antipodalDirections'
import { dot, length, normalize, orientFaceOutward, scale } from './polyhedronMath'

/**
 * A construção "pelas normais" conferida onde a resposta é conhecida de antemão: seis direções nos
 * eixos têm que devolver um CUBO. Se a conta do vértice dual, a ordem dos cantos ou a orientação
 * estiverem erradas, um cubo denuncia na hora — e nenhuma malha de cem faces denunciaria, porque
 * ninguém sabe de cor como ela deveria ser.
 */
describe('poliedro dual a partir das normais', () => {
  const EIXOS: Vector3Tuple[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ]

  it('seis direções nos eixos dão um cubo', () => {
    const { vertices, faces } = buildDualFromNormals(EIXOS)

    expect(faces).toHaveLength(6)
    expect(vertices).toHaveLength(8)
    for (const face of faces) expect(face).toHaveLength(4)

    // Os oito cantos de um cubo de lado 2: todas as coordenadas ±1.
    for (const vertice of vertices) {
      for (const coordenada of vertice) expect(Math.abs(coordenada)).toBeCloseTo(1, 6)
    }
  })

  it('cada face olha exatamente pra direção que a gerou, e a 1 de distância do centro', () => {
    const { vertices, faces } = buildDualFromNormals(EIXOS)

    faces.forEach((indices, i) => {
      const { normal } = orientFaceOutward(vertices, indices)
      expect(dot(normal, EIXOS[i]), `face ${i}`).toBeCloseTo(1, 6)
      // Plano `n·x = 1`: todo canto da face está a essa distância na direção da normal.
      for (const indice of indices) expect(dot(vertices[indice], EIXOS[i])).toBeCloseTo(1, 6)
    })
  })

  it('os cantos de cada face vêm em ordem ao redor dela, não embaralhados', () => {
    const { vertices, faces } = buildDualFromNormals(antipodalDirections(50))

    for (const indices of faces) {
      const pontos = indices.map((i) => vertices[i])
      const centro = pontos
        .reduce((soma, p) => [soma[0] + p[0], soma[1] + p[1], soma[2] + p[2]] as Vector3Tuple, [0, 0, 0])
        .map((c) => c / pontos.length) as Vector3Tuple
      const normal = normalize(centro)
      /**
       * Polígono em ordem = a soma dos ângulos girados de um canto pro seguinte dá uma volta
       * inteira. Embaralhado, a soma some (a estrela vai e volta) — é o defeito que a ordenação em
       * volta da normal existe pra evitar, e que uma malha renderizada mostraria como face rasgada.
       */
      let voltaTotal = 0
      for (let i = 0; i < pontos.length; i++) {
        const a = pontos[i].map((c, k) => c - centro[k]) as Vector3Tuple
        const b = pontos[(i + 1) % pontos.length].map((c, k) => c - centro[k]) as Vector3Tuple
        const cruz: Vector3Tuple = [
          a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]
        ]
        const sinal = Math.sign(dot(cruz, normal))
        voltaTotal += sinal * Math.acos(Math.min(1, Math.max(-1, dot(normalize(a), normalize(b)))))
      }
      expect(Math.abs(voltaTotal)).toBeCloseTo(2 * Math.PI, 4)
    }
  })
})

/**
 * As direções antipodais — o conjunto de onde sai a honestidade do d100. Ver o comentário grande em
 * `antipodalDirections.ts`: o que importa não é a beleza da distribuição, é a simetria.
 */
describe('direções antipodais', () => {
  it('a segunda metade é a antípoda exata da primeira', () => {
    const direcoes = antipodalDirections(50)
    expect(direcoes).toHaveLength(100)
    for (let i = 0; i < 50; i++) {
      const oposta = scale(direcoes[i], -1)
      expect(dot(direcoes[i + 50], oposta)).toBeCloseTo(1, 9)
    }
  })

  it('são todas unitárias', () => {
    for (const direcao of antipodalDirections(50)) expect(length(direcao)).toBeCloseTo(1, 9)
  })

  it('a relaxação AFASTA as direções — é pra isso que ela existe', () => {
    const separacaoMinima = (direcoes: Vector3Tuple[]): number => {
      let maiorProduto = -1
      for (let i = 0; i < direcoes.length; i++) {
        for (let j = i + 1; j < direcoes.length; j++) {
          maiorProduto = Math.max(maiorProduto, dot(direcoes[i], direcoes[j]))
        }
      }
      return maiorProduto
    }

    // Sem relaxação, a espiral espelhada amontoa direções perto do equador: vizinhas a 11,5°
    // (produto 0.98). Com ela, 19,5° (produto 0.94). Quanto MENOR o produto, mais separadas.
    const crua = separacaoMinima(antipodalDirections(50, 0))
    const relaxada = separacaoMinima(antipodalDirections(50))
    expect(relaxada).toBeLessThan(crua)
    expect(relaxada).toBeLessThan(0.95)
  })

  it('é determinística — o dado de hoje é o mesmo de amanhã', () => {
    // Sem isso, um dado gerado com números aleatórios teria numeração diferente a cada abertura do
    // app, e a face 37 de ontem seria outra face hoje.
    expect(antipodalDirections(50)).toEqual(antipodalDirections(50))
  })
})
