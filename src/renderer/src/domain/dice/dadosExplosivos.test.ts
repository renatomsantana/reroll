import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiceExpression } from '@shared/types/dice'
import { expressionLabel, rollExpression } from './diceEngine'

/**
 * DADOS EXPLOSIVOS — "tirou o máximo, rola de novo e soma".
 *
 * A mecânica pedida pela spec (2.1) porque cada sistema usa a sua: Savage Worlds explode todo dado de
 * traço, Shadowrun explode o 6. O que interessa aqui não é a soma — essa é fácil — são as três
 * decisões que a implementação toma e que não são óbvias olhando o resultado:
 *
 * 1. o dado explodido continua sendo UM DADO pra regra de manter;
 * 2. a cadeia tem TETO, porque uma cadeia sem teto é um laço que termina "quase sempre";
 * 3. `chains` só aparece quando houve explosão de verdade.
 *
 * A fonte de números é controlada em todos os testes: explosão é justamente o caminho em que a
 * quantidade de sorteios varia, e verificar isso com dado de verdade seria verificar o acaso.
 */

/** Devolve os valores na ordem dada; depois disso, repete o último. */
function fonteFixa(...valores: number[]) {
  let i = 0
  return vi.fn(() => (i < valores.length ? valores[i++] : valores[valores.length - 1]))
}

/**
 * O `rollDie` transforma o número de 32 bits em face por `valor % lados + 1`. Pra pedir uma face
 * específica basta mandar `face - 1`, que está bem abaixo do limite de rejeição.
 */
function face(n: number): number {
  return n - 1
}

function usarFonte(proximo: () => number): void {
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((buffer: Uint32Array) => {
    buffer[0] = proximo() >>> 0
    return buffer
  }) as typeof crypto.getRandomValues)
}

/** xorshift32 determinístico, pros testes de média. Ver `justicaDoSorteio.test.ts`. */
function fonteDeterministica(semente: number): () => number {
  let estado = semente >>> 0 || 0x9e3779b9
  return () => {
    estado ^= estado << 13
    estado >>>= 0
    estado ^= estado >>> 17
    estado ^= estado << 5
    estado >>>= 0
    return estado
  }
}

const explodindo = (groups: DiceExpression['groups'], maxChain = 10): DiceExpression => ({
  groups,
  modifiers: [],
  explode: { maxChain }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a cadeia', () => {
  it('face máxima rola de novo e soma; face comum para na primeira', () => {
    usarFonte(fonteFixa(face(6), face(6), face(2)))

    const resultado = rollExpression(explodindo([{ sides: 6, count: 1 }]))

    expect(resultado.groups[0].chains).toEqual([[6, 6, 2]])
    expect(resultado.groups[0].rolls).toEqual([14])
    expect(resultado.total).toBe(14)
  })

  it('sem regra de explosão, a face máxima é só uma face máxima', () => {
    const espiao = fonteFixa(face(6), face(6), face(6))
    usarFonte(espiao)

    const resultado = rollExpression({ groups: [{ sides: 6, count: 1 }], modifiers: [] })

    expect(espiao).toHaveBeenCalledTimes(1)
    expect(resultado.groups[0].rolls).toEqual([6])
    expect(resultado.groups[0].chains).toBeUndefined()
  })

  it('o teto corta a cadeia — sem ele isto seria um laço infinito', () => {
    /**
     * A fonte devolve a face máxima PARA SEMPRE. É o cenário que não acontece na prática e que, se
     * acontecesse sem teto, travaria o app numa tela sem resposta em vez de dar erro.
     */
    usarFonte(fonteFixa(face(6)))

    const resultado = rollExpression(explodindo([{ sides: 6, count: 1 }], 4))

    // 1 lançamento inicial + 4 explosões.
    expect(resultado.groups[0].chains?.[0]).toEqual([6, 6, 6, 6, 6])
    expect(resultado.groups[0].rolls).toEqual([30])
  })

  it('teto zero desliga a explosão em vez de estourar', () => {
    const espiao = fonteFixa(face(6))
    usarFonte(espiao)

    const resultado = rollExpression(explodindo([{ sides: 6, count: 1 }], 0))

    expect(espiao).toHaveBeenCalledTimes(1)
    expect(resultado.groups[0].rolls).toEqual([6])
  })

  it('cada dado do grupo explode por conta própria', () => {
    // d6 #1: 6 → 3 (explode uma vez). d6 #2: 4 (não explode). d6 #3: 6 → 6 → 1.
    usarFonte(fonteFixa(face(6), face(3), face(4), face(6), face(6), face(1)))

    const resultado = rollExpression(explodindo([{ sides: 6, count: 3 }]))

    expect(resultado.groups[0].chains).toEqual([[6, 3], [4], [6, 6, 1]])
    expect(resultado.groups[0].rolls).toEqual([9, 4, 13])
    expect(resultado.groups[0].subtotal).toBe(26)
  })
})

describe('um dado explodido é UM dado', () => {
  it('a regra de manter enxerga a cadeia inteira como um valor só', () => {
    /**
     * É a decisão de desenho mais importante aqui. Em "role 3d20 e use o maior", um d20 que tirou
     * 20 e depois 7 vale 27 — e não "um 20 e um 7" competindo separados. Com a leitura errada, a
     * cauda de uma explosão poderia ser o dado escolhido, o que é o oposto do que a regra diz.
     */
    // d20 #1: 20 → 7 (= 27). #2: 18. #3: 4.
    usarFonte(fonteFixa(face(20), face(7), face(18), face(4)))

    const resultado = rollExpression({
      groups: [{ sides: 20, count: 3 }],
      modifiers: [],
      keep: { mode: 'highest', count: 1 },
      explode: { maxChain: 10 }
    })

    expect(resultado.groups[0].rolls).toEqual([27, 18, 4])
    expect(resultado.total).toBe(27)
  })

  it('manter o MENOR não escolhe a cauda de uma explosão', () => {
    // d20 #1: 20 → 2 (= 22). #2: 9. A cauda vale 2, mas o dado vale 22 — o menor é o 9.
    usarFonte(fonteFixa(face(20), face(2), face(9)))

    const resultado = rollExpression({
      groups: [{ sides: 20, count: 2 }],
      modifiers: [],
      keep: { mode: 'lowest', count: 1 },
      explode: { maxChain: 10 }
    })

    expect(resultado.total).toBe(9)
  })
})

describe('o resultado conta o que aconteceu', () => {
  it('o modificador entra uma vez só, depois de toda a explosão', () => {
    usarFonte(fonteFixa(face(6), face(6), face(1)))

    const resultado = rollExpression({
      groups: [{ sides: 6, count: 1 }],
      modifiers: [{ type: 'flat', value: 3 }],
      explode: { maxChain: 10 }
    })

    expect(resultado.total).toBe(16) // 6 + 6 + 1 + 3
    expect(resultado.modifierTotal).toBe(3)
  })

  it('o rótulo avisa que explode — senão "1d6" com total 14 parece defeito', () => {
    expect(expressionLabel(explodindo([{ sides: 6, count: 1 }]))).toBe('1d6 (explode)')
  })

  it('rótulo com as duas regras juntas', () => {
    expect(
      expressionLabel({
        groups: [{ sides: 20, count: 3 }],
        modifiers: [{ type: 'flat', value: 2 }],
        keep: { mode: 'highest', count: 1 },
        explode: { maxChain: 10 }
      })
    ).toBe('3d20 + 2 (usa o maior, explode)')
  })

  it('a regra viaja junto do resultado, pra tela saber por que o número é grande', () => {
    usarFonte(fonteFixa(face(1)))
    expect(rollExpression(explodindo([{ sides: 6, count: 1 }])).explode).toEqual({ maxChain: 10 })
  })
})

describe('a média sobe do tanto que a matemática manda', () => {
  it('d6 explosivo tem média 4,2 e não 3,5', () => {
    /**
     * A conta fechada de um dado explosivo de N faces é (N+1)/2 × N/(N−1) — cada face máxima
     * concede outro lançamento, o que vale 1/(N−1) de dado extra. Pro d6: 3,5 × 1,2 = 4,2.
     *
     * É o teste que pega a implementação plausível-e-errada: somar a face máxima duas vezes, ou
     * explodir na face errada, ou explodir sempre. Todas continuam devolvendo números maiores que
     * 3,5, e só a média diz qual está certa.
     */
    usarFonte(fonteDeterministica(0xb00b5))

    const amostras = Array.from(
      { length: 20000 },
      () => rollExpression(explodindo([{ sides: 6, count: 1 }])).total
    )
    const media = amostras.reduce((a, b) => a + b, 0) / amostras.length

    expect(media).toBeGreaterThan(4.2 - 0.1)
    expect(media).toBeLessThan(4.2 + 0.1)
  })
})
