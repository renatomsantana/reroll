import { describe, expect, it } from 'vitest'
import { D100_DEFINITION, D100_FACE_INPUTS, D100_FACE_NORMALS, D100_VERTICES } from './d100Sphere'
import { dot, scale } from '../geometry/polyhedronMath'
import { resolveAmbiguousMargin } from '../config/physicsConfig'

/**
 * A GEOMETRIA DO D100, conferida pelas propriedades que fazem dele um dado HONESTO — e não pelo
 * desenho, que é consequência delas.
 *
 * Este arquivo existe porque a versão anterior parecia certa em tudo o que se olhava (cem faces,
 * cem números, formato de bola) e mesmo assim treze faces nunca saíam em 3000 rolagens. O que
 * faltava não era visível: simetria das normais e regularidade das áreas. Cada teste aqui é uma
 * dessas coisas invisíveis, escrita de forma a falhar se alguém mexer na construção sem saber por
 * que ela é assim (a história completa está em `d100Sphere.ts` e `antipodalDirections.ts`).
 */
describe('d100 — a geometria que torna o dado honesto', () => {
  const METADE = 50

  it('tem 100 faces com números de 1 a 100, cada um uma vez só', () => {
    expect(D100_DEFINITION.faces).toHaveLength(100)
    const valores = [...D100_DEFINITION.faces.map((face) => face.value)].sort((a, b) => a - b)
    expect(valores).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
  })

  it('as faces são polígonos de verdade — nada de triângulo fiapo', () => {
    for (const { vertexIndices } of D100_FACE_INPUTS) {
      // Célula de Voronoi de uma direção entre vizinhas bem espalhadas: pentágono, hexágono ou
      // heptágono. Um triângulo aqui seria sinal de direção espremida entre as vizinhas.
      expect(vertexIndices.length).toBeGreaterThanOrEqual(5)
      expect(vertexIndices.length).toBeLessThanOrEqual(7)
    }
  })

  /**
   * A propriedade CENTRAL, no sentido literal: faces opostas paralelas. Sem ela o mapa "face de
   * apoio → face lida" deixa de ser bijeção e sobram faces que não saem nunca, por mais iguais que
   * sejam as áreas — foi o defeito medido, e o motivo de `antipodalDirections.ts` existir.
   */
  it('as faces vêm em pares opostos, e o par soma 101', () => {
    for (let i = 0; i < METADE; i++) {
      const norte = D100_DEFINITION.faces[i]
      const sul = D100_DEFINITION.faces[i + METADE]
      expect(dot(norte.normal, scale(sul.normal, -1)), `faces ${i} e ${i + METADE} não são opostas`).toBeCloseTo(1, 6)
      expect(norte.value + sul.value).toBe(101)
    }
  })

  /**
   * A tradução direta da honestidade: apoiado em cada uma das cem faces, o dado tem que mostrar uma
   * face DIFERENTE. Cem apoios, cem resultados distintos.
   */
  it('cada face de apoio leva a uma face lida diferente — o mapa é uma bijeção', () => {
    const lidas = new Set<number>()
    for (const apoio of D100_DEFINITION.faces) {
      const paraCima = scale(apoio.normal, -1)
      let melhor = D100_DEFINITION.faces[0]
      let melhorProduto = -Infinity
      for (const face of D100_DEFINITION.faces) {
        const produto = dot(face.normal, paraCima)
        if (produto > melhorProduto) {
          melhorProduto = produto
          melhor = face
        }
      }
      lidas.add(melhor.value)
    }
    expect(lidas.size).toBe(100)
  })

  it('as áreas das faces ficam todas perto da média', () => {
    const areas = D100_FACE_INPUTS.map(({ vertexIndices }) => {
      const pontos = vertexIndices.map((i) => D100_VERTICES[i])
      let area = 0
      // Leque a partir do primeiro canto — vale pra qualquer polígono convexo planar.
      for (let i = 1; i < pontos.length - 1; i++) {
        const ab = pontos[i].map((c, k) => c - pontos[0][k])
        const ac = pontos[i + 1].map((c, k) => c - pontos[0][k])
        const cruz = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0]
        ]
        area += Math.hypot(cruz[0], cruz[1], cruz[2]) / 2
      }
      return area
    })
    const media = areas.reduce((soma, area) => soma + area, 0) / areas.length
    const menor = Math.min(...areas)
    const maior = Math.max(...areas)
    // Medido: 0,93x a 1,07x da média (a versão de casco convexo com jitter dava 0,70x a 1,40x).
    expect(menor / media).toBeGreaterThan(0.85)
    expect(maior / media).toBeLessThan(1.15)
  })

  /**
   * A leitura precisa de FOLGA sobre a margem de ambiguidade, senão dado deitado e parado é lido
   * como "equilibrado numa aresta" e leva cutucada pra sempre — foi o que aconteceu quando a
   * geometria nova rodou com a margem global de 0,08: 255 mil cutucadas e nenhum dado assentando.
   */
  it('dado deitado nunca é confundido com dado equilibrado', () => {
    let maiorProduto = -1
    for (let i = 0; i < D100_DEFINITION.faces.length; i++) {
      for (let j = i + 1; j < D100_DEFINITION.faces.length; j++) {
        maiorProduto = Math.max(maiorProduto, dot(D100_DEFINITION.faces[i].normal, D100_DEFINITION.faces[j].normal))
      }
    }
    // Diferença de produto escalar entre a face de cima e a vizinha mais próxima, com o dado
    // deitado: 1 − cos(ângulo entre as normais mais próximas).
    const diferencaNoRepouso = 1 - maiorProduto
    const margem = resolveAmbiguousMargin(D100_DEFINITION)
    expect(diferencaNoRepouso).toBeGreaterThan(margem * 2)
  })

  it('as normais da definição são as direções de onde ele foi construído', () => {
    // A face é a célula de Voronoi da direção: a normal calculada pela malha (Newell, em
    // `computePolyhedronFaces`) tem que bater com a direção que a gerou. Se um dia a construção
    // embaralhar a ordem, é aqui que aparece.
    D100_DEFINITION.faces.forEach((face, i) => {
      expect(dot(face.normal, D100_FACE_NORMALS[i]), `face ${i}`).toBeCloseTo(1, 6)
    })
  })
})
