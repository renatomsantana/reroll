import { describe, expect, it } from 'vitest'
import type { Vector3Tuple } from '@shared/types/dice3d'
import { readTopFace } from '../faceReading/readTopFace'
import { quaternionFromTo } from '../faceReading/quaternionTestHelpers'
import { resolveAmbiguousMargin } from '../config/physicsConfig'
import { AVAILABLE_DICE_TYPES, DICE_REGISTRY } from './registry'

const WORLD_UP: Vector3Tuple = [0, 1, 0]
const WORLD_DOWN: Vector3Tuple = [0, -1, 0]

/** d4 não entra aqui: soma de faces opostas não é o critério de correção pra um tetraedro (ver `d4.ts`). */
const OPPOSITE_FACE_SUM: Partial<Record<number, number>> = {
  6: 7,
  8: 9,
  // 9 → 11: o d10 era numerado 0-9 (o d10 de dezena, cujos opostos somam 9) e passou a ser 1-10,
  // cuja convenção é somar 11. Ver o comentário dos valores em `d10.ts`.
  10: 11,
  12: 13,
  20: 21
}

function normalDot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

describe('DiceDefinition — geometria e leitura de todos os tipos de dado', () => {
  for (const sides of AVAILABLE_DICE_TYPES) {
    const { definition } = DICE_REGISTRY[sides]

    describe(`d${sides}`, () => {
      it(`tem ${sides} faces`, () => {
        expect(definition.faces.length).toBe(sides)
      })

      it('toda normal de face é vetor unitário', () => {
        for (const face of definition.faces) {
          const len = Math.sqrt(normalDot(face.normal, face.normal))
          expect(len).toBeCloseTo(1, 5)
        }
      })

      for (const face of definition.faces) {
        it(`lê ${face.value} quando a face id=${face.id} está forçada como decisiva`, () => {
          const targetDirection = definition.resultMode === 'topFace' ? WORLD_UP : WORLD_DOWN
          const rotation = quaternionFromTo(face.normal, targetDirection)

          const reading = readTopFace(definition, rotation, resolveAmbiguousMargin(definition))

          expect(reading.value).toBe(face.value)
          expect(reading.isAmbiguous).toBe(false)
        })
      }

      const expectedSum = OPPOSITE_FACE_SUM[sides]
      if (expectedSum !== undefined) {
        it(`faces opostas somam ${expectedSum}`, () => {
          for (const face of definition.faces) {
            let bestDot = Infinity
            let opposite = face
            for (const other of definition.faces) {
              if (other.id === face.id) continue
              const d = normalDot(face.normal, other.normal)
              if (d < bestDot) {
                bestDot = d
                opposite = other
              }
            }
            expect(face.value + opposite.value).toBe(expectedSum)
          }
        })
      }
    })
  }
})

/**
 * "Nenhum dado tira 0, apenas 1 até o máximo" — a regra que o usuário enunciou ao reportar o d10
 * numerado 0-9. Vale pra todo tipo, e é aqui que fica: um dado com uma face fora do intervalo, ou com
 * dois valores repetidos, é um dado quebrado mesmo que a geometria e a leitura estejam perfeitas.
 */
describe('valores das faces — todo dado sorteia de 1 até o número de lados', () => {
  for (const sides of AVAILABLE_DICE_TYPES) {
    it(`d${sides} tem exatamente os valores 1..${sides}, cada um uma vez`, () => {
      const valores = DICE_REGISTRY[sides].definition.faces.map((face) => face.value)
      expect([...valores].sort((a, b) => a - b)).toEqual(
        Array.from({ length: sides }, (_, i) => i + 1)
      )
    })
  }
})
