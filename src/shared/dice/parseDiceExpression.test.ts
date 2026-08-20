import { describe, expect, it } from 'vitest'
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
    // 15 é `MAX_SIMULTANEOUS_DICE`. Passar disso seria aceitar um preset que a rolagem trunca calada.
    expect(parseDiceExpression('15d6')).not.toBeNull()
    expect(parseDiceExpression('16d6')).toBeNull()
    // 9d6+9d6 são 18 dados, acima do teto — e o caminho até aqui é o que descobriu o bug do `+9`
    // sendo lido como modificador (ver o comentário de `TOKEN`).
    expect(parseDiceExpression('9d6+9d6')).toBeNull()
    expect(parseDiceExpression('7d6+7d6')?.expression).toEqual({
      groups: [{ sides: 6, count: 14 }],
      modifiers: []
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
