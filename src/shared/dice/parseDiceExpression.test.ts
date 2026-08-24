import { describe, expect, it } from 'vitest'
import { MAX_SIMULTANEOUS_DICE } from '../diceRegistry'
import { parseDiceExpression, parseTestBonus } from './parseDiceExpression'

/**
 * O interpretador de expressão é o que faz o importador de fichas servir pra ficha que ninguém
 * previu — qualquer sistema de RPG escreve dado do mesmo jeito. Então o que este teste vigia não é
 * "1d20+5 funciona", é o comportamento diante do que uma ficha REAL traz: célula com nome do golpe
 * junto, espaço no meio, `D` maiúsculo, e — principalmente — texto que só PARECE dado.
 */
describe('parseDiceExpression — o que uma ficha traz escrito', () => {
  it('lê a notação básica, com e sem quantidade', () => {
    expect(parseDiceExpression('1d20')?.expression).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: []
    })
    // Sem quantidade é 1, que é como quase toda ficha escreve.
    expect(parseDiceExpression('d8')?.expression).toEqual({
      groups: [{ sides: 8, count: 1 }],
      modifiers: []
    })
    expect(parseDiceExpression('3D10')?.expression.groups).toEqual([{ sides: 10, count: 3 }])
  })

  it('lê modificador somado e subtraído', () => {
    expect(parseDiceExpression('1d20+5')?.expression.modifiers).toEqual([{ type: 'flat', value: 5 }])
    expect(parseDiceExpression('2d6 - 1')?.expression.modifiers).toEqual([{ type: 'flat', value: -1 }])
    // Vários modificadores somam num só: o app guarda uma lista, mas dois "+2" seguidos são +4.
    expect(parseDiceExpression('1d8+2+3')?.expression.modifiers).toEqual([{ type: 'flat', value: 5 }])
  })

  it('soma grupos do mesmo tipo e mantém tipos diferentes separados', () => {
    expect(parseDiceExpression('1d6+1d6')?.expression.groups).toEqual([{ sides: 6, count: 2 }])
    const misto = parseDiceExpression('1d8+1d6+2')
    expect(misto?.expression.groups).toEqual([
      { sides: 8, count: 1 },
      { sides: 6, count: 1 }
    ])
    /**
     * O `+1` de "+1d6" é a QUANTIDADE do grupo seguinte, não um modificador. Só o `+2` do fim é
     * modificador. Sem essa asserção o teste passava com `modifiers: 3`, porque conferia só os
     * grupos — e era exatamente o que estava acontecendo.
     */
    expect(misto?.expression.modifiers).toEqual([{ type: 'flat', value: 2 }])
  })

  it('acha a expressão no meio do texto da célula, que é como a ficha vem', () => {
    const lido = parseDiceExpression('Pistola 1d12+2 (curto)')
    expect(lido?.expression.groups).toEqual([{ sides: 12, count: 1 }])
    expect(lido?.expression.modifiers).toEqual([{ type: 'flat', value: 2 }])
    // O trecho reconhecido volta pra tela poder mostrar de onde a expressão saiu.
    expect(lido?.matched).toBe('1d12+2')
  })

  it('ignora número solto ANTES do primeiro dado', () => {
    /**
     * O extrator junta colunas vizinhas na mesma string com frequência, e ficha tem numeração de
     * linha. Sem essa regra, "3 Adaga 1d4" viraria 1d4+3 — um preset errado, e errado de um jeito
     * plausível, que é o pior tipo.
     */
    const lido = parseDiceExpression('3 Adaga 1d4')
    expect(lido?.expression.groups).toEqual([{ sides: 4, count: 1 }])
    expect(lido?.expression.modifiers).toEqual([])
  })

  it('devolve null pra texto sem dado nenhum', () => {
    expect(parseDiceExpression('Espada longa')).toBeNull()
    expect(parseDiceExpression('')).toBeNull()
    expect(parseDiceExpression('+7')).toBeNull()
  })

  it('recusa tipo de dado que o app não rola', () => {
    // O app tem sete tipos. Aceitar 1d3 aqui seria prometer na tela de conferência um preset que a
    // bandeja não sabe montar.
    expect(parseDiceExpression('1d3')).toBeNull()
    expect(parseDiceExpression('2d30')).toBeNull()
  })

  it('recusa quantidade acima do teto de dados da rolagem', () => {
    /**
     * O teto sai da CONSTANTE, e não de um número escrito à mão. O teste já tinha `15` cravado e
     * quebrou no dia em que o limite subiu pra 20 — falhando por estar desatualizado, não por o
     * código ter errado, que é o pior tipo de teste vermelho: ele treina a pessoa a mexer no teste
     * em vez de olhar o código.
     */
    const teto = MAX_SIMULTANEOUS_DICE
    expect(parseDiceExpression(`${teto}d6`)).not.toBeNull()
    expect(parseDiceExpression(`${teto + 1}d6`)).toBeNull()

    // SOMA de grupos: dois grupos que sozinhos passam, juntos estouram. O caminho até aqui é o que
    // descobriu o bug do `+9` sendo lido como modificador (ver o comentário de `TOKEN`).
    const metadeQuePassa = Math.floor(teto / 2)
    expect(parseDiceExpression(`${teto}d6+${teto}d6`)).toBeNull()
    expect(parseDiceExpression(`${metadeQuePassa}d6+${metadeQuePassa}d6`)?.expression).toEqual({
      groups: [{ sides: 6, count: metadeQuePassa * 2 }],
      modifiers: []
    })
  })

  it('quantidade de DOIS DÍGITOS depois do "+" é lida como grupo, não como modificador', () => {
    /**
     * O defeito que apareceu quando o teto subiu pra 20 e as contagens de dois dígitos passaram a
     * caber: "1d6+10d6" devolvia NADA, enquanto "10d6+1d6" — a mesma rolagem escrita ao contrário —
     * funcionava. A espiada que separa modificador de grupo olhava um dígito atrás demais, lia um
     * modificador "+1" e sobrava um "0d6", quantidade zero, que derrubava a leitura inteira.
     *
     * Ficava escondido porque nada no app usava dois dígitos: com teto 15, "9d6+9d6" já estourava.
     */
    expect(parseDiceExpression('1d6+10d6')?.expression).toEqual({
      groups: [{ sides: 6, count: 11 }],
      modifiers: []
    })
    // A ordem inversa sempre funcionou — as duas juntas são o que prova que o defeito era da espiada.
    expect(parseDiceExpression('10d6+1d6')?.expression).toEqual({
      groups: [{ sides: 6, count: 11 }],
      modifiers: []
    })
    expect(parseDiceExpression('2d20+10d6')?.expression).toEqual({
      groups: [
        { sides: 20, count: 2 },
        { sides: 6, count: 10 }
      ],
      modifiers: []
    })
  })

  it('e um modificador de dois dígitos continua sendo modificador', () => {
    // O outro lado da mesma moeda: a correção não pode transformar "+12" num grupo de dados.
    expect(parseDiceExpression('1d20+12')?.expression).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: [{ type: 'flat', value: 12 }]
    })
    expect(parseDiceExpression('2d6+10 de fogo')?.expression).toEqual({
      groups: [{ sides: 6, count: 2 }],
      modifiers: [{ type: 'flat', value: 10 }]
    })
    expect(parseDiceExpression('1d8-10')?.expression).toEqual({
      groups: [{ sides: 8, count: 1 }],
      modifiers: [{ type: 'flat', value: -10 }]
    })
  })
})

describe('parseTestBonus — a coluna TESTE, que traz só o bônus', () => {
  it('transforma bônus solto em teste de d20', () => {
    expect(parseTestBonus('+7')).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: [{ type: 'flat', value: 7 }]
    })
    expect(parseTestBonus('5')?.modifiers).toEqual([{ type: 'flat', value: 5 }])
    expect(parseTestBonus('-1')?.modifiers).toEqual([{ type: 'flat', value: -1 }])
    // Bônus zero é teste sem modificador, não ausência de teste.
    expect(parseTestBonus('0')).toEqual({ groups: [{ sides: 20, count: 1 }], modifiers: [] })
  })

  it('o dado do teste é escolha de quem chama, não regra embutida', () => {
    // Sistema que testa com d100 passa o próprio número — a função não decide isso sozinha.
    expect(parseTestBonus('+10', 100)?.groups).toEqual([{ sides: 100, count: 1 }])
  })

  it('recusa o que não é um bônus solto', () => {
    expect(parseTestBonus('')).toBeNull()
    expect(parseTestBonus('Luta')).toBeNull()
    // Quem tem notação de dado tem que ir por `parseDiceExpression`, que lê de verdade — aqui viraria
    // um d20 com modificador inventado a partir do primeiro número que aparecesse.
    expect(parseTestBonus('1d20+7')).toBeNull()
  })
})

describe('o "d" colado nos números — achado dos livros de regras de Pathfinder 2e', () => {
  it('"enfeebled 4" e "colored 20" não são dados', () => {
    expect(parseDiceExpression('enfeebled 4 (1 day)')).toBeNull()
    expect(parseDiceExpression('colored 20')).toBeNull()
    // Com a quantidade na frente, o espaço em volta do "d" continua valendo — é assim que ficha datilografada escreve.
    expect(parseDiceExpression('Dano: 1 d 8')?.expression.groups).toEqual([{ sides: 8, count: 1 }])
  })

  it('o que toda ficha escreve continua lendo', () => {
    expect(parseDiceExpression('Espada d8')?.expression.groups).toEqual([{ sides: 8, count: 1 }])
    expect(parseDiceExpression('d20')?.expression.groups).toEqual([{ sides: 20, count: 1 }])
    expect(parseDiceExpression('1D8+2')?.expression.modifiers).toEqual([{ type: 'flat', value: 2 }])
    expect(parseDiceExpression('2d6 + 3')?.expression.modifiers).toEqual([{ type: 'flat', value: 3 }])
  })
})
