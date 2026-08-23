// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

/**
 * O ATLAS DE NÚMEROS pinta os valores num canvas 2D, e o jsdom não implementa `getContext`. O dublê
 * abaixo é inerte de propósito: o que este arquivo confere é GEOMETRIA e UV — onde o número vai
 * parar na face —, e não um pixel de textura. `measureText` devolve largura porque quem desenha o
 * glifo centraliza por ela; qualquer outra chamada vira função vazia, pra o dublê não precisar
 * correr atrás de cada método novo que o desenho use um dia.
 */
const contexto2dInerte = new Proxy(
  { measureText: () => ({ width: 10 }) },
  {
    get: (alvo, chave) => (chave in alvo ? alvo[chave as keyof typeof alvo] : () => undefined),
    set: () => true
  }
)
HTMLCanvasElement.prototype.getContext = (() => contexto2dInerte) as never

import { AVAILABLE_DICE_TYPES, DICE_REGISTRY } from '../dice-defs/registry'
import { resolveAmbiguousMargin } from '../config/physicsConfig'
import { readTopFace } from '../faceReading/readTopFace'
import { maiorValor, rotacionarVetor } from '../faceReading/orientacaoDeExibicao'
import { orientacaoDeVitrine, topoDasLetrasNaFace } from './orientacaoDeVitrine'
import type { Vector3Tuple } from '@shared/types/dice3d'

/**
 * A pose do estojo tem DUAS metades, e as duas são conferidas aqui:
 *
 * 1. o número certo em cima — pelo `readTopFace`, o mesmo leitor que decide o resultado de uma
 *    rolagem de verdade;
 * 2. o número virado pra frente — pela direção do topo das letras, lida do UV da malha.
 *
 * A segunda é a que este arquivo existe pra travar. Ela some sem ninguém perceber: o dado continua
 * mostrando 20, só que deitado de lado, e nenhum teste de valor reclama.
 */

const FRENTE: Vector3Tuple = [0, 0, 1]
const CIMA: Vector3Tuple = [0, 1, 0]

function escalar(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

describe('orientação de vitrine — maior número pra cima e de frente', () => {
  for (const sides of AVAILABLE_DICE_TYPES) {
    const { definition, buildVisual } = DICE_REGISTRY[sides]
    const margem = resolveAmbiguousMargin(definition)

    describe(`d${sides}`, () => {
      const mesh = buildVisual()
      const giro = orientacaoDeVitrine(definition, mesh.geometry)

      it('continua mostrando o maior número', () => {
        expect(readTopFace(definition, giro, margem).value).toBe(sides)
      })

      it('o giro é unitário', () => {
        expect(Math.hypot(giro.x, giro.y, giro.z, giro.w)).toBeCloseTo(1, 6)
      })

      if (definition.resultMode === 'topFace') {
        it('o topo das letras aponta pra LONGE de quem olha — é como se lê papel na mesa', () => {
          const face = definition.faces.find((f) => f.value === maiorValor(definition))!
          const topoLocal = topoDasLetrasNaFace(mesh.geometry, face.normal)
          expect(topoLocal).not.toBeNull()

          const topo = rotacionarVetor(topoLocal!, giro)
          // Componente horizontal: é ela que diz pra que lado o número está virado.
          const horizontal = Math.hypot(topo[0], topo[2])
          expect(horizontal).toBeGreaterThan(0.5)
          expect(topo[2] / horizontal).toBeLessThan(-0.99)
        })

        it('o topo das letras fica DEITADO na face, não apontando pro céu', () => {
          const face = definition.faces.find((f) => f.value === maiorValor(definition))!
          const topo = rotacionarVetor(topoDasLetrasNaFace(mesh.geometry, face.normal)!, giro)
          expect(Math.abs(escalar(topo, CIMA))).toBeLessThan(0.2)
        })
      } else {
        /**
         * d4: não existe face de cima pra endireitar — o 4 é o número do vértice, impresso nos
         * cantos das três laterais. O que faz ele aparecer de frente é uma lateral virada pra quem
         * olha, e é isso que se confere.
         */
        it('uma das faces laterais fica virada de frente pra quem olha', () => {
          const laterais = definition.faces
            .map((face) => rotacionarVetor(face.normal, giro))
            .filter((normal) => normal[1] < 0.9)

          const maisAFrente = Math.max(...laterais.map((normal) => escalar(normal, FRENTE)))
          const horizontalDaMelhor = laterais
            .map((normal) => ({ normal, frente: escalar(normal, FRENTE) }))
            .sort((a, b) => b.frente - a.frente)[0].normal

          expect(maisAFrente).toBeGreaterThan(0)
          // A componente horizontal dela aponta pra frente, sem sobrar desvio pros lados.
          expect(Math.abs(horizontalDaMelhor[0])).toBeLessThan(0.01)
          expect(horizontalDaMelhor[2]).toBeGreaterThan(0)
        })
      }
    })
  }

  it('a direção do topo das letras é lida da malha e fica DENTRO do plano da face', () => {
    for (const sides of AVAILABLE_DICE_TYPES) {
      const { definition, buildVisual } = DICE_REGISTRY[sides]
      const mesh = buildVisual()
      for (const face of definition.faces) {
        const topo = topoDasLetrasNaFace(mesh.geometry, face.normal)
        expect(topo, `d${sides}, face ${face.value}`).not.toBeNull()
        // Perpendicular à normal: o texto é pintado NA face, não saindo dela.
        expect(Math.abs(escalar(topo!, face.normal))).toBeLessThan(1e-6)
        expect(Math.hypot(topo![0], topo![1], topo![2])).toBeCloseTo(1, 6)
      }
    }
  })
})
