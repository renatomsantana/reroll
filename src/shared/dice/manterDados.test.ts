import { describe, expect, it } from 'vitest'
import type { DiceGroupResult } from '../types/dice'
import {
  indicesMantidos,
  mantidosPorGrupo,
  rotuloDeManter,
  totalMantido,
  valoresDosGrupos
} from './manterDados'

/**
 * "Role N dados e use o MAIOR" — a regra que faltava, e que fazia o preset importado de uma ficha de
 * Ordem Paranormal dar um total errado com cara de certo: somar 2d20 dá em média 21 onde a regra dá
 * 13,8.
 *
 * Os testes aqui são de CONTA, e por isso não sorteiam nada: valores fixos entram, total sai. É a
 * única parte do rolador que dá pra fixar assim, e é justamente a parte que estava errada.
 */

function grupo(sides: number, rolls: number[]): DiceGroupResult {
  return { sides, rolls, subtotal: rolls.reduce((s, r) => s + r, 0) }
}

describe('totalMantido', () => {
  it('sem regra, soma tudo — o comportamento de sempre', () => {
    expect(totalMantido([3, 9, 14])).toBe(26)
    expect(totalMantido([3, 9, 14], undefined)).toBe(26)
  })

  it('o caso de Ordem Paranormal: 2d20, vale o maior', () => {
    expect(totalMantido([7, 18], { mode: 'highest', count: 1 })).toBe(18)
    expect(totalMantido([18, 7], { mode: 'highest', count: 1 })).toBe(18)
  })

  it('atributo ZERO de Ordem Paranormal: 2d20, vale o PIOR', () => {
    expect(totalMantido([7, 18], { mode: 'lowest', count: 1 })).toBe(7)
  })

  it('mantém os N melhores quando N é mais de um', () => {
    expect(totalMantido([2, 20, 11, 5], { mode: 'highest', count: 2 })).toBe(31)
    expect(totalMantido([2, 20, 11, 5], { mode: 'lowest', count: 2 })).toBe(7)
  })

  it('manter tantos quanto se rola, ou mais, é o mesmo que não ter regra', () => {
    /**
     * Não é caso hipotético: o editor deixa aumentar a quantidade de dados depois de escolher a
     * regra, e um preset gravado com "usa os 3 maiores" pode acabar com 2 dados. A resposta certa é
     * somar os dois, e não devolver zero nem estourar.
     */
    expect(totalMantido([4, 6], { mode: 'highest', count: 2 })).toBe(10)
    expect(totalMantido([4, 6], { mode: 'highest', count: 9 })).toBe(10)
  })

  it('regra com contagem zero ou negativa não zera o total', () => {
    // Um `presets.json` editado à mão pode trazer isso, e um total zero seria uma rolagem perdida.
    expect(totalMantido([4, 6], { mode: 'highest', count: 0 })).toBe(10)
    expect(totalMantido([4, 6], { mode: 'highest', count: -3 })).toBe(10)
  })

  it('lista vazia não quebra', () => {
    expect(totalMantido([], { mode: 'highest', count: 1 })).toBe(0)
  })
})

describe('indicesMantidos', () => {
  it('no empate fica o primeiro — e é sempre o mesmo entre um render e outro', () => {
    // O total não muda (os valores são iguais), mas a MARCAÇÃO na tela ficaria pulando.
    const a = indicesMantidos([12, 12, 3], { mode: 'highest', count: 1 })
    const b = indicesMantidos([12, 12, 3], { mode: 'highest', count: 1 })
    expect([...a]).toEqual([0])
    expect([...a]).toEqual([...b])
  })
})

describe('mantidosPorGrupo', () => {
  it('marca dado por dado, atravessando os grupos', () => {
    /**
     * A regra vale pro CONJUNTO da rolagem, não por grupo: "role tudo isso e fique com os dois
     * melhores" é como os sistemas escrevem. Aqui o maior de todos está no segundo grupo.
     */
    const grupos = [grupo(20, [4, 19]), grupo(6, [6, 1])]
    expect(valoresDosGrupos(grupos)).toEqual([4, 19, 6, 1])
    expect(mantidosPorGrupo(grupos, { mode: 'highest', count: 2 })).toEqual([
      [false, true],
      [true, false]
    ])
  })

  it('sem regra, tudo é mantido — nada fica marcado como descartado', () => {
    expect(mantidosPorGrupo([grupo(20, [4, 19])])).toEqual([[true, true]])
  })

  it('a marcação bate exatamente com o total', () => {
    /**
     * É o contrato entre a conta e a tela: o que aparece destacado tem que ser o que entrou na soma.
     * Se as duas contas divergirem, a pessoa vê dois dados marcados e um total que não é a soma
     * deles — e passa a não confiar em nenhum resultado do app.
     */
    const grupos = [grupo(20, [8, 3, 17]), grupo(20, [11])]
    const keep = { mode: 'highest' as const, count: 2 }
    const marcas = mantidosPorGrupo(grupos, keep).flat()
    const valores = valoresDosGrupos(grupos)
    const somaDosMarcados = valores.reduce((s, v, i) => (marcas[i] ? s + v : s), 0)
    expect(somaDosMarcados).toBe(totalMantido(valores, keep))
    expect(somaDosMarcados).toBe(28)
  })
})

describe('rotuloDeManter', () => {
  it('diz o que a regra faz, no singular e no plural', () => {
    expect(rotuloDeManter({ mode: 'highest', count: 1 })).toBe('o maior')
    expect(rotuloDeManter({ mode: 'lowest', count: 1 })).toBe('o menor')
    expect(rotuloDeManter({ mode: 'highest', count: 2 })).toBe('os 2 maiores')
    expect(rotuloDeManter({ mode: 'lowest', count: 3 })).toBe('os 3 menores')
  })

  it('sem regra não há o que dizer', () => {
    expect(rotuloDeManter(undefined)).toBeNull()
    expect(rotuloDeManter({ mode: 'highest', count: 0 })).toBeNull()
  })
})
