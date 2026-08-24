import { describe, expect, it } from 'vitest'
import type { DiceExpression } from '../types/dice'
import { MAX_EXPLOSOES_POR_DADO, MAX_SIMULTANEOUS_DICE } from '../diceRegistry'
import { expressaoParaFormula, textoParaExpressao } from './formulaParaExpressao'

/**
 * A ponte entre a gramática e o `DiceExpression` que a bandeja rola hoje: o que traduz, o que fica
 * de fora COM O MOTIVO, e a ida-e-volta com o texto.
 */

function reduz(texto: string): DiceExpression {
  const r = textoParaExpressao(texto)
  if (!r.ok) throw new Error(`"${texto}" ficou de fora: ${r.motivo}`)
  return r.expression
}

function ficaDeFora(texto: string): string {
  const r = textoParaExpressao(texto)
  if (r.ok) throw new Error(`"${texto}" deveria ficar de fora, virou ${JSON.stringify(r.expression)}`)
  return r.motivo
}

describe('o que a bandeja já rola', () => {
  it('dados somados e modificador fixo', () => {
    expect(reduz('1d20+5')).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 5 }] })
    expect(reduz('1d20')).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [] })
    expect(reduz('1d20 + 3 - 5').modifiers).toEqual([{ type: 'flat', value: -2 }])
    expect(reduz('1d20 + 3 - 3').modifiers).toEqual([])
    expect(reduz('d%').groups).toEqual([{ sides: 100, count: 1 }])
  })

  it('o mesmo tipo de dado vira um grupo só; tipos diferentes ficam na ordem', () => {
    expect(reduz('2d6 + 1d6 + 3').groups).toEqual([{ sides: 6, count: 3 }])
    expect(reduz('1d8 + 1d6').groups).toEqual([
      { sides: 8, count: 1 },
      { sides: 6, count: 1 }
    ])
  })

  it('manter e descartar viram a regra de manter do rolador', () => {
    expect(reduz('4d6kh3').keep).toEqual({ mode: 'highest', count: 3 })
    expect(reduz('4d6dl1').keep).toEqual({ mode: 'highest', count: 3 })
    expect(reduz('2d20kl1').keep).toEqual({ mode: 'lowest', count: 1 })
    expect(reduz('4d6dh1').keep).toEqual({ mode: 'lowest', count: 3 })
    expect(reduz('2d20kh1 + 5')).toEqual({
      groups: [{ sides: 20, count: 2 }],
      modifiers: [{ type: 'flat', value: 5 }],
      keep: { mode: 'highest', count: 1 }
    })
    // Manter todos não é regra.
    expect(reduz('2d20kh2').keep).toBeUndefined()
  })

  it('explosão vira a regra de explosão do rolador, com o teto da bandeja', () => {
    expect(reduz('1d6!').explode).toEqual({ maxChain: MAX_EXPLOSOES_POR_DADO })
    expect(reduz('1d6! + 1d8!').groups).toHaveLength(2)
    expect(reduz('1d6 + 1d8').explode).toBeUndefined()
  })

  it('sinal duplo se cancela', () => {
    expect(reduz('-(-1d4)').groups).toEqual([{ sides: 4, count: 1 }])
    expect(reduz('1d20 - -2').modifiers).toEqual([{ type: 'flat', value: 2 }])
  })
})

describe('o que ainda fica de fora, com o motivo escrito', () => {
  it('tipo de dado que a bandeja não tem', () => {
    expect(ficaDeFora('1d3')).toMatch(/não tem d3/)
    expect(ficaDeFora('1d3')).toMatch(/d4, d6, d8, d10, d12, d20, d100/)
  })

  it('o que o rolador desta versão não faz', () => {
    expect(ficaDeFora('1d6*2')).toMatch(/Multiplicação/)
    expect(ficaDeFora('(1d8+2)*2')).toMatch(/Multiplicação/)
    expect(ficaDeFora('1d20+@STR.mod')).toMatch(/@STR\.mod precisa de um valor da ficha/)
    expect(ficaDeFora('2d6r<2')).toMatch(/Rerolar/)
    expect(ficaDeFora('6d6#>=5')).toMatch(/Contar sucessos/)
    expect(ficaDeFora('1d20+5>=15')).toMatch(/alvo/)
    expect(ficaDeFora('1d6-1d4')).toMatch(/subtraído/)
    expect(ficaDeFora('-1d4')).toMatch(/subtraído/)
    expect(ficaDeFora('-(1d4)')).toMatch(/subtraído/)
    expect(ficaDeFora('2d20kh1+1d6')).toMatch(/por grupo/)
    expect(ficaDeFora('1d6!+1d8')).toMatch(/parte dos dados/)
  })

  it('o teto da bandeja', () => {
    expect(ficaDeFora(`${MAX_SIMULTANEOUS_DICE + 1}d6`)).toMatch(new RegExp(`máximo ${MAX_SIMULTANEOUS_DICE}`))
    expect(ficaDeFora('10d6+11d6')).toMatch(/21 dados/)
    expect(reduz(`${MAX_SIMULTANEOUS_DICE}d6`).groups[0].count).toBe(MAX_SIMULTANEOUS_DICE)
  })

  it('sem dado, e texto que nem lê', () => {
    expect(ficaDeFora('5')).toMatch(/pelo menos um dado/)
    expect(ficaDeFora('1d')).toMatch(/sem número de lados/)
    expect(ficaDeFora('')).toMatch(/1d20\+5/)
  })
})

describe('de volta ao texto', () => {
  it('escreve o preset na gramática', () => {
    expect(
      expressaoParaFormula({
        groups: [{ sides: 20, count: 2 }],
        modifiers: [{ type: 'flat', value: 5 }],
        keep: { mode: 'highest', count: 1 }
      })
    ).toBe('2d20kh1 + 5')
    expect(expressaoParaFormula({ groups: [{ sides: 6, count: 1 }], modifiers: [], explode: { maxChain: 10 } })).toBe('1d6!')
    expect(expressaoParaFormula({ groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: -2 }] })).toBe('1d20 - 2')
    expect(
      expressaoParaFormula({
        groups: [
          { sides: 8, count: 1 },
          { sides: 6, count: 1 }
        ],
        modifiers: [
          { type: 'flat', value: 1 },
          { type: 'flat', value: 2 }
        ]
      })
    ).toBe('1d8 + 1d6 + 3')
  })

  it('regra sem efeito não aparece; regra que a notação não escreve devolve null', () => {
    expect(expressaoParaFormula({ groups: [{ sides: 20, count: 2 }], modifiers: [], keep: { mode: 'highest', count: 2 } })).toBe('2d20')
    expect(expressaoParaFormula({ groups: [{ sides: 20, count: 2 }], modifiers: [], keep: { mode: 'highest', count: 0 } })).toBe('2d20')
    expect(expressaoParaFormula({ groups: [{ sides: 6, count: 1 }], modifiers: [], explode: { maxChain: 0 } })).toBe('1d6')
    // Manter sobre dois tipos de dado ao mesmo tempo: a bandeja faz, a notação não diz.
    expect(
      expressaoParaFormula({
        groups: [
          { sides: 20, count: 2 },
          { sides: 6, count: 1 }
        ],
        modifiers: [],
        keep: { mode: 'highest', count: 1 }
      })
    ).toBeNull()
    expect(expressaoParaFormula({ groups: [], modifiers: [] })).toBeNull()
    expect(expressaoParaFormula({ groups: [{ sides: 6, count: 0 }], modifiers: [] })).toBeNull()
  })

  it('ida e volta', () => {
    const exemplos: DiceExpression[] = [
      { groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 5 }] },
      { groups: [{ sides: 6, count: 4 }], modifiers: [], keep: { mode: 'highest', count: 3 } },
      { groups: [{ sides: 20, count: 2 }], modifiers: [{ type: 'flat', value: -1 }], keep: { mode: 'lowest', count: 1 } },
      { groups: [{ sides: 6, count: 2 }], modifiers: [], explode: { maxChain: MAX_EXPLOSOES_POR_DADO } },
      {
        groups: [
          { sides: 8, count: 1 },
          { sides: 6, count: 2 }
        ],
        modifiers: [{ type: 'flat', value: 3 }]
      }
    ]
    for (const expression of exemplos) {
      const texto = expressaoParaFormula(expression)
      expect(texto).not.toBeNull()
      expect(reduz(texto!)).toEqual(expression)
    }
    expect(expressaoParaFormula(reduz('4d6kh3 + 2'))).toBe('4d6kh3 + 2')
    expect(expressaoParaFormula(reduz('4d6dl1'))).toBe('4d6kh3')
  })
})
