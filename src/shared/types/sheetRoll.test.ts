import { describe, expect, it } from 'vitest'
import { MAX_SIMULTANEOUS_DICE } from '../diceRegistry'
import { normalizarTipoDeRolagem, rolagemDoCampo } from './sheetRoll'

/**
 * A conta que transforma o número escrito na ficha na rolagem daquele sistema.
 *
 * É o pedaço do app onde um erro passa mais fácil despercebido: o dado cai na mesa, o total aparece,
 * e nada denuncia que a regra usada era a de outro sistema. Por isso cada caso aqui é uma regra de
 * jogo declarada, e não um exemplo de arredondamento.
 */

describe('rolagem de campo de ficha', () => {
  it('sem tipo, lê a notação escrita no próprio campo — vale pra sistema nenhum conhecido', () => {
    /**
     * O caminho da ficha genérica: o app não sabe que sistema é, mas "1d8+2" na coluna de dano
     * continua sendo uma rolagem. É o que faz o botão de dado aparecer numa ficha que ninguém
     * cadastrou aqui.
     */
    expect(rolagemDoCampo('1d8+2')).toEqual({
      groups: [{ sides: 8, count: 1 }],
      modifiers: [{ type: 'flat', value: 2 }]
    })
    expect(rolagemDoCampo('2d6 de fogo')).toEqual({ groups: [{ sides: 6, count: 2 }], modifiers: [] })
  })

  it('sem tipo e sem notação, não há rolagem — e isso é o caso comum', () => {
    // Nome, classe, deslocamento e CA existem aos montes numa ficha e não se rolam. `null` aqui é
    // o que diz à tela onde NÃO desenhar o botão.
    expect(rolagemDoCampo('Agente de Saúde')).toBeNull()
    expect(rolagemDoCampo('9m/6q')).toBeNull()
    expect(rolagemDoCampo('')).toBeNull()
    expect(rolagemDoCampo('   ')).toBeNull()
  })

  describe('d20 — o valor é um bônus', () => {
    it('soma o bônus ao d20, com ou sem sinal', () => {
      const esperado = { groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 7 }] }
      expect(rolagemDoCampo('+7', 'd20')).toEqual(esperado)
      expect(rolagemDoCampo('7', 'd20')).toEqual(esperado)
    })

    it('bônus negativo continua negativo, e zero não vira modificador nenhum', () => {
      expect(rolagemDoCampo('-1', 'd20')).toEqual({
        groups: [{ sides: 20, count: 1 }],
        modifiers: [{ type: 'flat', value: -1 }]
      })
      expect(rolagemDoCampo('+0', 'd20')).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [] })
    })

    it('atravessa a anotação que o jogador escreveu junto do número', () => {
      // Ficha preenchida à mão tem de tudo escrito na mesma caixa.
      expect(rolagemDoCampo('+5 (treinado)', 'd20')?.modifiers).toEqual([{ type: 'flat', value: 5 }])
    })
  })

  describe('d20-valor — o valor é um atributo de D&D', () => {
    it('converte o valor no modificador do sistema', () => {
      // A tabela do sistema: 8 → -1, 10 → 0, 16 → +3, 18 → +4, 20 → +5.
      const modificador = (valor: string) =>
        rolagemDoCampo(valor, 'd20-valor')?.modifiers[0]?.value ?? 0
      expect(modificador('8')).toBe(-1)
      expect(modificador('10')).toBe(0)
      expect(modificador('11')).toBe(0)
      expect(modificador('16')).toBe(3)
      expect(modificador('18')).toBe(4)
      expect(modificador('20')).toBe(5)
    })

    it('arredonda pra BAIXO também no negativo, que é a regra do sistema', () => {
      // Valor 7 dá -2, e não -1: a divisão de (7-10)/2 é -1,5 e a regra manda arredondar pra baixo.
      expect(rolagemDoCampo('7', 'd20-valor')?.modifiers).toEqual([{ type: 'flat', value: -2 }])
      expect(rolagemDoCampo('3', 'd20-valor')?.modifiers).toEqual([{ type: 'flat', value: -4 }])
    })

    it('sempre um d20 só — o que muda é o que se soma', () => {
      expect(rolagemDoCampo('16', 'd20-valor')?.groups).toEqual([{ sides: 20, count: 1 }])
    })
  })

  describe('pool-d20 — o valor é quantos dados, como em Ordem Paranormal', () => {
    it('atributo 3 rola três d20 e fica com o maior', () => {
      expect(rolagemDoCampo('3', 'pool-d20')).toEqual({
        groups: [{ sides: 20, count: 3 }],
        modifiers: [],
        keep: { mode: 'highest', count: 1 }
      })
    })

    it('atributo 1 rola um dado, sem regra de manter', () => {
      // Não há o que escolher com um dado só, e uma regra ali só encheria o rótulo do resultado.
      expect(rolagemDoCampo('1', 'pool-d20')).toEqual({
        groups: [{ sides: 20, count: 1 }],
        modifiers: []
      })
    })

    it('atributo ZERO rola dois e fica com o PIOR — a regra que o sistema tem e quase todo app erra', () => {
      expect(rolagemDoCampo('0', 'pool-d20')).toEqual({
        groups: [{ sides: 20, count: 2 }],
        modifiers: [],
        keep: { mode: 'lowest', count: 1 }
      })
    })

    it('número que não cabe na bandeja não vira rolagem', () => {
      /**
       * Um "40" digitado por engano no campo de atributo viraria quarenta dados numa cena que rola
       * quinze — truncados na hora de rolar, com o total sem relação nenhuma com o que a ficha
       * prometeu. Não rolar é mais honesto que rolar outra coisa.
       */
      expect(rolagemDoCampo(String(MAX_SIMULTANEOUS_DICE + 1), 'pool-d20')).toBeNull()
      expect(rolagemDoCampo(String(MAX_SIMULTANEOUS_DICE), 'pool-d20')?.groups).toEqual([
        { sides: 20, count: MAX_SIMULTANEOUS_DICE }
      ])
      expect(rolagemDoCampo('-2', 'pool-d20')).toBeNull()
    })
  })

  it('não pesca número do meio de uma frase', () => {
    // "Deslocamento 9m/6q" não é 1d20+9, e um campo de texto marcado por engano não pode virar
    // rolagem só porque tem dígito em algum lugar.
    expect(rolagemDoCampo('m9', 'd20')).toBeNull()
    expect(rolagemDoCampo('Bruxa 5', 'd20')).toBeNull()
  })
})

describe('tipo de rolagem lido do disco', () => {
  it('aceita os tipos que existem e descarta o resto', () => {
    expect(normalizarTipoDeRolagem('d20')).toBe('d20')
    expect(normalizarTipoDeRolagem('pool-d20')).toBe('pool-d20')
    /**
     * Arquivo editado à mão, ou gravado por uma versão que tinha um tipo a mais. O campo perde o
     * botão certo e cai no palpite por notação de dado — perde-se o botão, nunca a ficha.
     */
    expect(normalizarTipoDeRolagem('d100-invertido')).toBeUndefined()
    expect(normalizarTipoDeRolagem(7)).toBeUndefined()
    expect(normalizarTipoDeRolagem(undefined)).toBeUndefined()
  })
})
