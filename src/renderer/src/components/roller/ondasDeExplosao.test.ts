import { describe, expect, it } from 'vitest'
import type { ExplodeRule } from '@shared/types/dice'
import {
  aindaExplode,
  cadeiasParaGrupos,
  encaixarOnda,
  gruposDaProximaOnda,
  type DadoEmCadeia
} from './DiceRoller3D'

/**
 * AS ONDAS DE EXPLOSÃO na bandeja 3D.
 *
 * A cena não sabe explodir: ela lança um punhado de dados e diz onde cada um parou. A explosão é
 * encenada por cima disso — assentou, quem tirou o máximo volta e cai de novo — e são estas quatro
 * funções que amarram a segunda queda de um dado à primeira.
 *
 * É o pedaço com mais chance de errar EM SILÊNCIO de toda a mecânica: um encaixe trocado não dá
 * erro nenhum, só faz um d6 herdar a queda de um d20 e o total sair maior do que deveria. Ninguém
 * confere um total de RPG na mão.
 *
 * O motor sem física tem os testes dele em `domain/dice/dadosExplosivos.test.ts`; aqui é só a
 * encenação.
 */

const regra: ExplodeRule = { maxChain: 10 }

const dado = (sides: number, ...faces: number[]): DadoEmCadeia => ({ sides, faces })

describe('quem ainda está explodindo', () => {
  it('só o dado parado na face máxima', () => {
    expect(aindaExplode(dado(6, 6), regra)).toBe(true)
    expect(aindaExplode(dado(6, 5), regra)).toBe(false)
    // O que importa é a ÚLTIMA face, não as anteriores: 6 → 3 acabou.
    expect(aindaExplode(dado(6, 6, 3), regra)).toBe(false)
    expect(aindaExplode(dado(6, 6, 6), regra)).toBe(true)
  })

  it('sem regra, ninguém explode', () => {
    expect(aindaExplode(dado(6, 6), undefined)).toBe(false)
    expect(aindaExplode(dado(6, 6), { maxChain: 0 })).toBe(false)
  })

  it('o teto para a cadeia mesmo com a face máxima na mesa', () => {
    const noTeto = dado(6, 6, 6, 6)
    expect(aindaExplode(noTeto, { maxChain: 2 })).toBe(false)
    expect(aindaExplode(noTeto, { maxChain: 3 })).toBe(true)
  })
})

describe('os grupos da próxima onda', () => {
  it('só os dados que voltam, contados por tipo', () => {
    const cadeias = [dado(20, 20), dado(20, 4), dado(6, 6), dado(6, 6), dado(6, 1)]
    expect(gruposDaProximaOnda(cadeias, regra)).toEqual([
      { sides: 20, count: 1 },
      { sides: 6, count: 2 }
    ])
  })

  it('ninguém explodindo é onda nenhuma — e é assim que a rolagem termina', () => {
    expect(gruposDaProximaOnda([dado(20, 3), dado(6, 2)], regra)).toEqual([])
  })
})

describe('encaixar a queda de volta na cadeia certa', () => {
  it('cada queda vai pro dado do MESMO tipo que estava esperando', () => {
    const cadeias = [dado(20, 20), dado(6, 6), dado(6, 2)]
    // A cena devolve na ordem dela; aqui o d6 vem antes do d20 de propósito.
    encaixarOnda(cadeias, [{ sides: 6, value: 4 }, { sides: 20, value: 11 }], regra)

    expect(cadeias[0].faces).toEqual([20, 11])
    expect(cadeias[1].faces).toEqual([6, 4])
    // O d6 que já tinha parado no 2 não recebe nada.
    expect(cadeias[2].faces).toEqual([2])
  })

  it('não encosta em dado que já parou', () => {
    const cadeias = [dado(6, 3), dado(6, 6)]
    encaixarOnda(cadeias, [{ sides: 6, value: 5 }], regra)

    expect(cadeias[0].faces).toEqual([3])
    expect(cadeias[1].faces).toEqual([6, 5])
  })

  it('dois dados do mesmo tipo esperando recebem um cada, na ordem', () => {
    const cadeias = [dado(6, 6), dado(6, 6)]
    encaixarOnda(cadeias, [{ sides: 6, value: 1 }, { sides: 6, value: 2 }], regra)

    expect(cadeias[0].faces).toEqual([6, 1])
    expect(cadeias[1].faces).toEqual([6, 2])
  })

  it('queda a mais é ignorada em vez de somar num dado parado', () => {
    /**
     * Não deveria acontecer — a onda é montada a partir de quem está esperando. Mas somar num dado
     * que já parou seria o defeito mais caro possível aqui: um total maior do que os dados na mesa,
     * sem nada na tela explicando de onde veio.
     */
    const cadeias = [dado(6, 6)]
    encaixarOnda(cadeias, [{ sides: 6, value: 1 }, { sides: 6, value: 5 }], regra)

    expect(cadeias[0].faces).toEqual([6, 1])
  })

  it('queda de um tipo que ninguém pediu não entra em lugar nenhum', () => {
    const cadeias = [dado(20, 20)]
    encaixarOnda(cadeias, [{ sides: 6, value: 6 }], regra)

    expect(cadeias[0].faces).toEqual([20])
  })
})

describe('as cadeias viram o resultado que o resto do app já entende', () => {
  it('um valor por dado — a soma da cadeia dele', () => {
    const grupos = cadeiasParaGrupos([dado(20, 20, 7), dado(20, 4)])

    expect(grupos).toEqual([
      { sides: 20, rolls: [27, 4], subtotal: 31, chains: [[20, 7], [4]] }
    ])
  })

  it('sem explosão nenhuma, `chains` nem aparece', () => {
    const grupos = cadeiasParaGrupos([dado(6, 3), dado(6, 5)])

    expect(grupos).toEqual([{ sides: 6, rolls: [3, 5], subtotal: 8 }])
    expect(grupos[0].chains).toBeUndefined()
  })

  it('agrupa por tipo, na ordem em que cada tipo apareceu', () => {
    const grupos = cadeiasParaGrupos([dado(6, 2), dado(20, 11), dado(6, 4)])

    expect(grupos.map((g) => g.sides)).toEqual([6, 20])
    expect(grupos[0].rolls).toEqual([2, 4])
    expect(grupos[1].rolls).toEqual([11])
  })

  it('rolagem vazia não estoura', () => {
    expect(cadeiasParaGrupos([])).toEqual([])
  })
})

describe('uma rolagem inteira, onda por onda', () => {
  it('3d6 com dois explodindo chega ao total certo', () => {
    /**
     * O caminho completo, do jeito que o componente percorre: primeira queda vira cadeias, a onda
     * seguinte se encaixa, e assim até ninguém mais estar no máximo.
     */
    const cadeias: DadoEmCadeia[] = [
      { sides: 6, faces: [6] },
      { sides: 6, faces: [2] },
      { sides: 6, faces: [6] }
    ]

    // Onda 1: dois d6 voltam. Um tira 6 de novo, o outro tira 1.
    expect(gruposDaProximaOnda(cadeias, regra)).toEqual([{ sides: 6, count: 2 }])
    encaixarOnda(cadeias, [{ sides: 6, value: 6 }, { sides: 6, value: 1 }], regra)

    // Onda 2: só o que tirou 6 de novo volta. Tira 3 e a rolagem acaba.
    expect(gruposDaProximaOnda(cadeias, regra)).toEqual([{ sides: 6, count: 1 }])
    encaixarOnda(cadeias, [{ sides: 6, value: 3 }], regra)

    expect(gruposDaProximaOnda(cadeias, regra)).toEqual([])

    const grupos = cadeiasParaGrupos(cadeias)
    expect(grupos[0].chains).toEqual([[6, 6, 3], [2], [6, 1]])
    expect(grupos[0].rolls).toEqual([15, 2, 7])
    expect(grupos[0].subtotal).toBe(24)
  })
})
