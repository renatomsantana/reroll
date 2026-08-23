import { describe, expect, it } from 'vitest'
import { MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'
import { comContagemAjustada, comDadoAcrescentado, totalDeDados } from './DiceRoller3D'

/**
 * O TETO DE DADOS DA ROLAGEM, conferido onde ele de fato manda.
 *
 * O defeito que trouxe este arquivo foi medido no app rodando, dirigindo a interface de verdade:
 * trinta cliques seguidos no "+" levaram a rolagem a 31 dados num app cujo limite é 20.
 *
 * A causa é a mesma armadilha que o projeto já documentou noutro lugar (ver o comentário do
 * `update` em `ProfilesContext`): o teto era conferido ANTES do `setGroups`, sobre a lista do render
 * ANTERIOR. O React agrupa os eventos de um mesmo tique num lote só, e dentro do lote todos os
 * cliques enxergam exatamente a mesma lista velha — a conta nunca chega ao teto porque ela nunca é
 * atualizada entre um clique e o outro.
 *
 * A correção foi mover a conferência pra DENTRO do atualizador, onde a lista é a que o React
 * entrega. Estas funções são esse dentro, extraídas pra poderem ser exercitadas sem React nenhum.
 */

const TETO = MAX_SIMULTANEOUS_DICE

const g = (sides: number, count: number) => ({ sides, count })

describe('acrescentar dado', () => {
  it('soma no grupo que já existe, em vez de criar outro do mesmo tipo', () => {
    expect(comDadoAcrescentado([g(20, 2)], 20, TETO)).toEqual([g(20, 3)])
  })

  it('cria grupo novo pra um tipo que ainda não está na rolagem', () => {
    expect(comDadoAcrescentado([g(20, 2)], 6, TETO)).toEqual([g(20, 2), g(6, 1)])
  })

  it('NO TETO devolve a mesma lista, sem tocar em nada', () => {
    const cheio = [g(20, TETO)]
    expect(comDadoAcrescentado(cheio, 20, TETO)).toBe(cheio)
    expect(comDadoAcrescentado(cheio, 6, TETO)).toBe(cheio)
  })

  it('o teto olha o TOTAL, e não o grupo — vários tipos somam', () => {
    const espalhado = [g(20, 8), g(6, 7), g(4, 5)] // 20 no total
    expect(totalDeDados(espalhado)).toBe(TETO)
    expect(comDadoAcrescentado(espalhado, 12, TETO)).toBe(espalhado)
  })

  it('CLIQUES EM SEQUÊNCIA param no teto — é o defeito medido, em forma de teste', () => {
    /**
     * Encadear a saída na entrada é exatamente o que o React faz dentro de um lote: cada
     * atualização recebe o resultado da anterior. Era isso que não acontecia quando a conferência
     * ficava do lado de fora, lendo o render.
     */
    let grupos = [g(20, 1)]
    for (let i = 0; i < 60; i++) grupos = comDadoAcrescentado(grupos, 20, TETO)

    expect(totalDeDados(grupos)).toBe(TETO)
  })
})

describe('ajustar a contagem de um grupo', () => {
  it('soma e subtrai', () => {
    expect(comContagemAjustada([g(20, 3)], 0, 1, TETO)).toEqual([g(20, 4)])
    expect(comContagemAjustada([g(20, 3)], 0, -1, TETO)).toEqual([g(20, 2)])
  })

  it('chegar a zero REMOVE o grupo', () => {
    expect(comContagemAjustada([g(20, 1), g(6, 2)], 0, -1, TETO)).toEqual([g(6, 2)])
  })

  /**
   * O último grupo ERA intocável ("a tela ficaria sem nada pra rolar") e passou a poder sair, a
   * pedido do usuário: "vamos deixar a opção de remover todos os dados, mas aí o botão de Rolar não
   * funciona. Que seja fácil retirar e trocar de dados".
   *
   * A trava resolvia o problema errado. Ficar sem dados não é estado inválido — é o caminho normal
   * pra trocar 3d6 por 1d20 sem ter que decrementar até 1 primeiro. Quem impede a rolagem vazia é o
   * botão de Rolar, que desliga sozinho (ver `semDados` em `DiceRoller3D`).
   */
  it('o último grupo TAMBÉM sai — a rolagem pode ficar vazia', () => {
    expect(comContagemAjustada([g(20, 1)], 0, -1, TETO)).toEqual([])
  })

  it('lista vazia continua sendo lista vazia, sem estourar', () => {
    expect(comContagemAjustada([], 0, -1, TETO)).toEqual([])
    expect(comContagemAjustada([], 0, 1, TETO)).toEqual([])
    expect(totalDeDados([])).toBe(0)
  })

  it('de vazio, escolher um tipo devolve a rolagem — é o "trocar de dados" do pedido', () => {
    const vazio = comContagemAjustada([g(6, 1)], 0, -1, TETO)
    expect(vazio).toEqual([])
    expect(comDadoAcrescentado(vazio, 20, TETO)).toEqual([g(20, 1)])
  })

  it('somar no teto não faz nada; DIMINUIR no teto continua funcionando', () => {
    /**
     * A metade que se erra ao escrever a guarda: um teto que barre o atualizador inteiro prende a
     * pessoa no limite, sem conseguir nem tirar dados. A conferência é só pro `delta` positivo.
     */
    const cheio = [g(20, TETO)]
    expect(comContagemAjustada(cheio, 0, 1, TETO)).toBe(cheio)
    expect(comContagemAjustada(cheio, 0, -1, TETO)).toEqual([g(20, TETO - 1)])
  })

  it('cliques em sequência param no teto', () => {
    let grupos = [g(6, 1)]
    for (let i = 0; i < 60; i++) grupos = comContagemAjustada(grupos, 0, 1, TETO)

    expect(totalDeDados(grupos)).toBe(TETO)
  })

  it('índice que não existe não estoura', () => {
    const grupos = [g(20, 1)]
    expect(comContagemAjustada(grupos, 7, 1, TETO)).toBe(grupos)
  })
})
