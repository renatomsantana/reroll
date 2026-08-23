import { describe, expect, it } from 'vitest'
import { AVAILABLE_DICE_TYPES, DICE_REGISTRY } from '../dice-defs/registry'
import { resolveAmbiguousMargin } from '../config/physicsConfig'
import { readTopFace } from './readTopFace'
import {
  giroDeMenorArco,
  maiorValor,
  orientacaoDoMaiorValor,
  orientacaoParaMostrar
} from './orientacaoDeExibicao'

/**
 * A conferência que importa não é "o quaternion tem os números que eu calculei" — é o LEITOR DE
 * VERDADE do app olhar pro dado orientado e ler o número que se queria mostrar. Por isso todo teste
 * daqui passa pelo `readTopFace`, que é quem decide o resultado de uma rolagem: se um dia a
 * numeração de um dado mudar (o d10 já foi de 0-9 pra 1-10), estes testes acompanham sozinhos.
 */
describe('orientação de exibição — o dado mostrando o número que se pede', () => {
  for (const sides of AVAILABLE_DICE_TYPES) {
    const { definition } = DICE_REGISTRY[sides]
    const margem = resolveAmbiguousMargin(definition)

    describe(`d${sides}`, () => {
      it('mostra o maior número dele — que é o pedido do estojo', () => {
        const leitura = readTopFace(definition, orientacaoDoMaiorValor(definition), margem)
        expect(leitura.value).toBe(sides)
      })

      it('não fica equilibrado numa quina: a face vence com folga', () => {
        const leitura = readTopFace(definition, orientacaoDoMaiorValor(definition), margem)
        expect(leitura.isAmbiguous).toBe(false)
      })

      it('serve pra qualquer valor do dado, não só pro maior', () => {
        for (const face of definition.faces) {
          const leitura = readTopFace(definition, orientacaoParaMostrar(definition, face.value), margem)
          expect(leitura.value).toBe(face.value)
        }
      })
    })
  }

  it('o maior valor de cada dado é o número de lados', () => {
    for (const sides of AVAILABLE_DICE_TYPES) {
      expect(maiorValor(DICE_REGISTRY[sides].definition)).toBe(sides)
    }
  })

  /**
   * O d4 é o único com `resultMode: 'bottomFace'`, e é ele que exercita o caminho dos vetores
   * opostos no `giroDeMenorArco` — a face do 4 aponta pra cima no modelo e tem que terminar
   * encostada na mesa. Uma implementação que ignore esse caso devolve quaternion nulo, e o teste
   * acima passaria por acidente se o dado já estivesse na posição certa: aqui a checagem é direta.
   */
  it('o d4 mostra 4 com a face do 4 virada PRA BAIXO', () => {
    const { definition } = DICE_REGISTRY[4]
    expect(definition.resultMode).toBe('bottomFace')

    const q = orientacaoParaMostrar(definition, 4)
    const face4 = definition.faces.find((f) => f.value === 4)
    expect(face4).toBeDefined()

    const [, y] = rotacionar(face4!.normal, q)
    expect(y).toBeLessThan(-0.99)
  })

  describe('giro de menor arco', () => {
    it('vetores iguais não giram nada', () => {
      expect(giroDeMenorArco([0, 1, 0], [0, 1, 0])).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    })

    it('vetores opostos dão meia volta, e não um quaternion nulo', () => {
      for (const eixo of [
        [0, 1, 0],
        [1, 0, 0],
        [0, 0, 1]
      ] as [number, number, number][]) {
        const q = giroDeMenorArco(eixo, [-eixo[0], -eixo[1], -eixo[2]])
        expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 6)

        const girado = rotacionar(eixo, q)
        expect(girado[0]).toBeCloseTo(-eixo[0], 6)
        expect(girado[1]).toBeCloseTo(-eixo[1], 6)
        expect(girado[2]).toBeCloseTo(-eixo[2], 6)
      }
    })

    it('o quaternion sai sempre unitário — quaternion torto deforma a malha', () => {
      const q = giroDeMenorArco([0, 0, 1], [0.6, 0.8, 0])
      expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 9)
    })
  })
})

/** Mesma fórmula do `readTopFace`, repetida aqui só pra o teste poder olhar uma normal específica. */
function rotacionar(
  v: [number, number, number],
  q: { x: number; y: number; z: number; w: number }
): [number, number, number] {
  const [vx, vy, vz] = v
  const tx = 2 * (q.y * vz - q.z * vy)
  const ty = 2 * (q.z * vx - q.x * vz)
  const tz = 2 * (q.x * vy - q.y * vx)
  return [
    vx + q.w * tx + (q.y * tz - q.z * ty),
    vy + q.w * ty + (q.z * tx - q.x * tz),
    vz + q.w * tz + (q.x * ty - q.y * tx)
  ]
}
