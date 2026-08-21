import { describe, expect, it } from 'vitest'
import {
  MODIFICADOR_MAXIMO,
  modificadorDoTexto,
  textoDeModificadorAceito,
  textoDoModificadorAjustado
} from './DiceRoller3D'

/**
 * O CAMPO DO MODIFICADOR, e o defeito que o trouxe: não dava pra digitar modificador NEGATIVO.
 *
 * O campo era `<input type="number">` guardando `Number(valor) || 0`. Digitar o sinal de menos dava
 * `Number('-')` = `NaN`, que virava zero na mesma tecla — o traço sumia antes de dar tempo de
 * escrever o algarismo. Um app de RPG em que não se digita "-2" é um app de RPG pela metade: metade
 * das rolagens de ficha tem penalidade.
 *
 * A causa é conceitual e vale registrar: o estado guardava o NÚMERO, e o número não tem como
 * representar "a pessoa digitou o sinal e ainda não digitou o resto". O texto tem.
 */

describe('o que o campo aceita enquanto se digita', () => {
  it('aceita os estados INCOMPLETOS — é o conserto do defeito', () => {
    // Nenhum destes é número, e todos são passagem obrigatória pra chegar num que é.
    expect(textoDeModificadorAceito('-')).toBe(true)
    expect(textoDeModificadorAceito('+')).toBe(true)
    expect(textoDeModificadorAceito('')).toBe(true)
  })

  it('aceita número com e sem sinal', () => {
    for (const t of ['0', '5', '-2', '+3', '999', '-999']) {
      expect(textoDeModificadorAceito(t), t).toBe(true)
    }
  })

  it('recusa o que não é modificador', () => {
    for (const t of ['abc', '1.5', '--3', '3-', '1e5', '1000', '-1000', ' 5']) {
      expect(textoDeModificadorAceito(t), t).toBe(false)
    }
  })
})

describe('quanto o texto vale', () => {
  it('estado incompleto vale zero, sem estragar o que está escrito', () => {
    expect(modificadorDoTexto('-')).toBe(0)
    expect(modificadorDoTexto('+')).toBe(0)
    expect(modificadorDoTexto('')).toBe(0)
  })

  it('número com sinal vale o que diz', () => {
    expect(modificadorDoTexto('-2')).toBe(-2)
    expect(modificadorDoTexto('+3')).toBe(3)
    expect(modificadorDoTexto('7')).toBe(7)
  })
})

describe('os botões de menos e mais', () => {
  it('somam e subtraem um', () => {
    expect(textoDoModificadorAjustado('0', 1)).toBe('1')
    expect(textoDoModificadorAjustado('0', -1)).toBe('-1')
    expect(textoDoModificadorAjustado('-3', 1)).toBe('-2')
  })

  it('funcionam a partir de um estado incompleto', () => {
    /**
     * A pessoa digita o traço, muda de ideia e clica no "+". Sem tratar isso, o `NaN` viraria a
     * string "NaN" dentro do campo — e a partir dali nada mais funcionaria.
     */
    expect(textoDoModificadorAjustado('-', 1)).toBe('1')
    expect(textoDoModificadorAjustado('', -1)).toBe('-1')
  })

  it('param no teto, dos dois lados', () => {
    expect(textoDoModificadorAjustado(String(MODIFICADOR_MAXIMO), 1)).toBe(String(MODIFICADOR_MAXIMO))
    expect(textoDoModificadorAjustado(String(-MODIFICADOR_MAXIMO), -1)).toBe(String(-MODIFICADOR_MAXIMO))
  })

  it('clicar em sequência anda de um em um até o teto e para', () => {
    let texto = '0'
    for (let i = 0; i < MODIFICADOR_MAXIMO + 50; i++) texto = textoDoModificadorAjustado(texto, 1)
    expect(texto).toBe(String(MODIFICADOR_MAXIMO))

    for (let i = 0; i < MODIFICADOR_MAXIMO * 2 + 50; i++) texto = textoDoModificadorAjustado(texto, -1)
    expect(texto).toBe(String(-MODIFICADOR_MAXIMO))
  })

  it('o resultado do botão é sempre um texto que o campo aceita de volta', () => {
    // Fecha o ciclo: o que o botão escreve tem que poder ser editado à mão depois.
    for (const partida of ['0', '-', '', '5', '-999', '999']) {
      for (const delta of [1, -1]) {
        const saida = textoDoModificadorAjustado(partida, delta)
        expect(textoDeModificadorAceito(saida), `${partida} ${delta} -> ${saida}`).toBe(true)
      }
    }
  })
})

describe('digitar "-2" tecla a tecla', () => {
  it('o traço sobrevive à primeira tecla — era exatamente isto que não acontecia', () => {
    let texto = ''
    for (const tecla of ['-', '2']) {
      const proximo = texto + tecla
      if (textoDeModificadorAceito(proximo)) texto = proximo
    }
    expect(texto).toBe('-2')
    expect(modificadorDoTexto(texto)).toBe(-2)
  })

  it('apagar tudo pra reescrever não devolve um zero na cara da pessoa', () => {
    // O campo fica VAZIO enquanto ela reescreve; o valor vale zero, mas o texto não vira "0".
    expect(textoDeModificadorAceito('')).toBe(true)
    expect(modificadorDoTexto('')).toBe(0)
  })
})
