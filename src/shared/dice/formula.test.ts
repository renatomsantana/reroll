import { describe, expect, it } from 'vitest'
import {
  analisarFormula,
  avaliarFormula,
  escreverFormula,
  MAXIMO_DE_PARENTESES_ANINHADOS,
  TAMANHO_MAXIMO_DA_FORMULA,
  type FonteDeDados,
  type Formula
} from './formula'

/**
 * A gramática de rolagem, testada à exaustão — o spec chama isto de "the heart of the app".
 *
 * Três blocos: o que a leitura ACEITA (e a árvore que devolve), o que ela RECUSA (com a mensagem e
 * a posição), e o que a avaliação CALCULA com uma fonte de dados de mentira, que devolve as faces
 * de uma fila e anota cada pedido — assim dá pra conferir não só o total, mas QUANTOS dados de qual
 * tipo a bandeja teria que jogar, e em que ordem.
 */

function ler(texto: string): Formula {
  const resultado = analisarFormula(texto)
  if (!resultado.ok) throw new Error(`"${texto}" não leu: ${resultado.mensagem} (posição ${resultado.posicao})`)
  return resultado.formula
}

function recusa(texto: string): { mensagem: string; posicao: number } {
  const resultado = analisarFormula(texto)
  if (resultado.ok) throw new Error(`"${texto}" deveria ter sido recusada`)
  return resultado
}

/** Fonte de dados com as faces numa fila, e o registro de cada pedido `[lados, quantidade]`. */
function fila(...faces: number[]): { fonte: FonteDeDados; pedidos: [number, number][] } {
  const pedidos: [number, number][] = []
  const fonte: FonteDeDados = (lados, quantidade) => {
    pedidos.push([lados, quantidade])
    return faces.splice(0, quantidade)
  }
  return { fonte, pedidos }
}

function rolar(texto: string, ...faces: number[]) {
  const { fonte, pedidos } = fila(...faces)
  const resultado = avaliarFormula(ler(texto), { dados: fonte })
  if (!resultado.ok) throw new Error(`"${texto}" não avaliou: ${resultado.mensagem}`)
  return { ...resultado, pedidos }
}

const dado = (quantidade: number, lados: number, extra: object = {}) => ({
  tipo: 'dado',
  quantidade,
  lados,
  explodir: false,
  ...extra
})

describe('o que a leitura aceita', () => {
  it('dado com bônus, com e sem quantidade, maiúsculo, com espaços', () => {
    expect(ler('1d20+5').expressao).toEqual({
      tipo: 'operacao',
      operador: '+',
      esquerda: dado(1, 20),
      direita: { tipo: 'numero', valor: 5 }
    })
    expect(ler('d20').expressao).toEqual(dado(1, 20))
    expect(ler('  2D6 + 3  ').expressao).toMatchObject({ esquerda: dado(2, 6), direita: { valor: 3 } })
    expect(ler('10d10').expressao).toEqual(dado(10, 10))
    expect(ler('d%').expressao).toEqual(dado(1, 100))
  })

  it('manter e descartar: kh, kl, k (= kh), dh, dl, com 1 implícito', () => {
    expect(ler('4d6kh3').expressao).toEqual(dado(4, 6, { manter: { modo: 'maior', quantos: 3 } }))
    expect(ler('4d6k3').expressao).toEqual(dado(4, 6, { manter: { modo: 'maior', quantos: 3 } }))
    expect(ler('4d6K3').expressao).toEqual(dado(4, 6, { manter: { modo: 'maior', quantos: 3 } }))
    expect(ler('2d20kl1').expressao).toEqual(dado(2, 20, { manter: { modo: 'menor', quantos: 1 } }))
    expect(ler('2d20kh').expressao).toEqual(dado(2, 20, { manter: { modo: 'maior', quantos: 1 } }))
    expect(ler('4d6dl1').expressao).toEqual(dado(4, 6, { descartar: { modo: 'menor', quantos: 1 } }))
    expect(ler('4d6dh').expressao).toEqual(dado(4, 6, { descartar: { modo: 'maior', quantos: 1 } }))
  })

  it('explodir, rerolar e contar', () => {
    expect(ler('1d6!').expressao).toEqual(dado(1, 6, { explodir: true }))
    expect(ler('2d6r<2').expressao).toEqual(dado(2, 6, { rerolar: { comparador: '<', alvo: 2 } }))
    expect(ler('6d6#>=5').expressao).toEqual(dado(6, 6, { contar: { comparador: '>=', alvo: 5 } }))
    expect(ler('1d10#=10').expressao).toEqual(dado(1, 10, { contar: { comparador: '=', alvo: 10 } }))
  })

  it('os sufixos vêm em qualquer ordem, colados ou com espaço', () => {
    const esperado = dado(4, 6, {
      manter: { modo: 'maior', quantos: 3 },
      explodir: true,
      rerolar: { comparador: '<', alvo: 2 }
    })
    expect(ler('4d6!kh3r<2').expressao).toEqual(esperado)
    expect(ler('4d6r<2kh3!').expressao).toEqual(esperado)
    expect(ler('4d6 kh3 ! r<2').expressao).toEqual(esperado)
  })

  it('o alvo no fim vira sucesso/fracasso da rolagem inteira', () => {
    expect(ler('1d20+5>=15').alvo).toEqual({ comparador: '>=', alvo: 15 })
    expect(ler('1d20 + 5 >= 15').alvo).toEqual({ comparador: '>=', alvo: 15 })
    expect(ler('1d20=20').alvo).toEqual({ comparador: '=', alvo: 20 })
    expect(ler('1d100 <= 45').alvo).toEqual({ comparador: '<=', alvo: 45 })
    expect(ler('1d20+5').alvo).toBeUndefined()
  })

  it('referências à ficha', () => {
    expect(ler('@STR.mod').expressao).toEqual({ tipo: 'referencia', caminho: ['STR', 'mod'] })
    expect(ler('1d20+@STR.mod+@prof').expressao).toEqual({
      tipo: 'operacao',
      operador: '+',
      esquerda: {
        tipo: 'operacao',
        operador: '+',
        esquerda: dado(1, 20),
        direita: { tipo: 'referencia', caminho: ['STR', 'mod'] }
      },
      direita: { tipo: 'referencia', caminho: ['prof'] }
    })
  })

  it('aritmética: precedência, parênteses, sinal', () => {
    expect(ler('(1d8+2)*2').expressao).toEqual({
      tipo: 'operacao',
      operador: '*',
      esquerda: { tipo: 'operacao', operador: '+', esquerda: dado(1, 8), direita: { tipo: 'numero', valor: 2 } },
      direita: { tipo: 'numero', valor: 2 }
    })
    expect(ler('1d8+2*2').expressao).toMatchObject({ operador: '+', direita: { operador: '*' } })
    expect(ler('-1d4').expressao).toEqual({ tipo: 'negativo', de: dado(1, 4) })
    expect(ler('+5').expressao).toEqual({ tipo: 'numero', valor: 5 })
    expect(ler('--3').expressao).toEqual({ tipo: 'negativo', de: { tipo: 'negativo', de: { tipo: 'numero', valor: 3 } } })
  })

  it('guarda o texto como foi escrito, sem as pontas', () => {
    expect(ler('  1D20 + 5 ').texto).toBe('1D20 + 5')
  })
})

describe('o que a leitura recusa — com a mensagem e a posição', () => {
  it('vazio', () => {
    expect(recusa('')).toMatchObject({ mensagem: expect.stringContaining('1d20+5'), posicao: 0 })
    expect(recusa('   ').posicao).toBe(0)
  })

  it('dado impossível', () => {
    expect(recusa('0d6').mensagem).toMatch(/Zero dados/)
    expect(recusa('1d0').mensagem).toMatch(/um lado/)
    expect(recusa('1d1').mensagem).toMatch(/um lado/)
    expect(recusa('1d').mensagem).toMatch(/sem número de lados/)
    expect(recusa('d').mensagem).toMatch(/sem número de lados/)
    expect(recusa('101d6').mensagem).toMatch(/Dados demais/)
    expect(recusa('1d1001').mensagem).toMatch(/Lados demais/)
    expect(ler('100d1000').expressao).toEqual(dado(100, 1000))
  })

  it('manter ou descartar sem sentido', () => {
    expect(recusa('2d6kh3').mensagem).toMatch(/manter 3 dados de 2/)
    expect(recusa('1d6kh0').mensagem).toMatch(/Manter zero/)
    expect(recusa('1d6dl1').mensagem).toMatch(/não deixa nenhum/)
    expect(recusa('4d6dl4').mensagem).toMatch(/não deixa nenhum/)
    expect(recusa('4d6dl0').mensagem).toMatch(/Descartar zero/)
    expect(ler('4d6dl3').expressao).toMatchObject({ descartar: { quantos: 3 } })
    expect(ler('2d6kh2').expressao).toMatchObject({ manter: { quantos: 2 } })
  })

  it('a mesma regra duas vezes no mesmo dado', () => {
    expect(recusa('1d6kh1kl1').mensagem).toMatch(/Só uma regra de manter/)
    expect(recusa('4d6kh1dl1').mensagem).toMatch(/Só uma regra de manter/)
    expect(recusa('1d6!!').mensagem).toMatch(/já explode/)
    expect(recusa('1d6r<2r<3').mensagem).toMatch(/Só uma regra de rerolar/)
    expect(recusa('1d6#>=3#>=3').mensagem).toMatch(/Só uma contagem/)
  })

  it('condição fora das faces, ou que vale sempre', () => {
    expect(recusa('1d6#>=7').mensagem).toMatch(/entre 1 e 6/)
    expect(recusa('1d6r<0').mensagem).toMatch(/entre 1 e 6/)
    expect(recusa('1d6r>=1').mensagem).toMatch(/rerolaria todo dado/)
    expect(recusa('1d6r<=6').mensagem).toMatch(/rerolaria todo dado/)
    // Nunca rerola: inofensivo, passa.
    expect(ler('1d6r<1').expressao).toMatchObject({ rerolar: { comparador: '<', alvo: 1 } })
    // Contar que vale sempre é só uma contagem de dados — não é erro.
    expect(ler('3d6#>=1').expressao).toMatchObject({ contar: { alvo: 1 } })
  })

  it('sufixo pela metade', () => {
    expect(recusa('1d6r<').mensagem).toMatch(/Rerolar precisa/)
    expect(recusa('1d6#').mensagem).toMatch(/Contar precisa/)
    expect(recusa('1d6#>=').mensagem).toMatch(/Contar precisa/)
  })

  it('aritmética quebrada, com a posição certa', () => {
    expect(recusa('1d6+')).toMatchObject({ mensagem: expect.stringContaining('acabou antes'), posicao: 4 })
    expect(recusa('1d6/2')).toMatchObject({ mensagem: expect.stringContaining('Divisão'), posicao: 3 })
    expect(recusa('2(1d6)')).toMatchObject({ mensagem: expect.stringContaining('"("'), posicao: 1 })
    expect(recusa('(1d6')).toMatchObject({ mensagem: expect.stringContaining('fechar'), posicao: 4 })
    expect(recusa('1d6)')).toMatchObject({ mensagem: expect.stringContaining('")"'), posicao: 3 })
    expect(recusa(')')).toMatchObject({ mensagem: expect.stringContaining('sem abrir'), posicao: 0 })
    expect(recusa('1d6 * * 2').mensagem).toMatch(/Não entendi "\*"/)
    expect(recusa('1d6 2d6').mensagem).toMatch(/Não entendi "2"/)
    expect(recusa('1d6 & 2').mensagem).toMatch(/Não entendi "&"/)
    expect(recusa('1d6 kh1 kh1').mensagem).toMatch(/Só uma regra/)
  })

  it('referência e alvo pela metade', () => {
    expect(recusa('@').mensagem).toMatch(/Referência precisa de um nome/)
    expect(recusa('1d20+@').mensagem).toMatch(/Referência precisa de um nome/)
    expect(recusa('1d6>=').mensagem).toMatch(/Depois do comparador/)
    expect(recusa('1d6 >= x').mensagem).toMatch(/Depois do comparador/)
    // Alvo só no fim, sobre a rolagem inteira — dentro de parênteses não existe.
    expect(recusa('(1d6>=3)').mensagem).toMatch(/fechar/)
    expect(recusa('1d6>=3+1').mensagem).toMatch(/Não entendi "\+"/)
  })

  it('tetos: tamanho, parênteses, número solto', () => {
    const longa = '1d6' + '+1'.repeat(TAMANHO_MAXIMO_DA_FORMULA)
    expect(recusa(longa)).toMatchObject({ posicao: TAMANHO_MAXIMO_DA_FORMULA })
    const fundo = '('.repeat(MAXIMO_DE_PARENTESES_ANINHADOS + 1) + '1d6' + ')'.repeat(MAXIMO_DE_PARENTESES_ANINHADOS + 1)
    expect(recusa(fundo).mensagem).toMatch(/Parênteses demais/)
    const noLimite = '('.repeat(MAXIMO_DE_PARENTESES_ANINHADOS) + '1d6' + ')'.repeat(MAXIMO_DE_PARENTESES_ANINHADOS)
    expect(ler(noLimite).expressao).toEqual(dado(1, 6))
    expect(recusa('1d6+5000000').mensagem).toMatch(/grande demais/)
    expect(recusa('1d6>=5000000').mensagem).toMatch(/grande demais/)
  })

  it('nada do que se digita derruba a leitura', () => {
    const lixo = [' ', 'd ', '1d6\n+2', 'ddd', '+++', '***', '@@@', '!!!', '###', 'kkk', '1d6k9999999999', '99999999999999999999d6']
    for (const texto of lixo) expect(() => analisarFormula(texto)).not.toThrow()
  })
})

describe('o que a avaliação calcula', () => {
  it('soma e bônus, pedindo à fonte exatamente os dados do termo', () => {
    const r = rolar('1d20+5', 13)
    expect(r.total).toBe(18)
    expect(r.pedidos).toEqual([[20, 1]])
    expect(r.sucesso).toBeUndefined()
    expect(r.termos).toEqual([{ quantidade: 1, lados: 20, valor: 13, dados: [{ faces: [13], valor: 13, mantido: true }] }])
  })

  it('cada termo pede na ordem em que aparece', () => {
    const r = rolar('1d20 + 2d6 + d%', 10, 3, 4, 77)
    expect(r.pedidos).toEqual([
      [20, 1],
      [6, 2],
      [100, 1]
    ])
    expect(r.total).toBe(94)
    expect(r.termos.map((t) => [t.quantidade, t.lados, t.valor])).toEqual([
      [1, 20, 10],
      [2, 6, 7],
      [1, 100, 77]
    ])
  })

  it('manter e descartar marcam quem ficou', () => {
    expect(rolar('2d20kh1', 7, 15).total).toBe(15)
    expect(rolar('2d20kh1', 7, 15).termos[0].dados.map((d) => d.mantido)).toEqual([false, true])
    expect(rolar('2d20kl1', 7, 15).total).toBe(7)
    expect(rolar('4d6kh3', 1, 6, 3, 5).total).toBe(14)
    expect(rolar('4d6dl1', 1, 6, 3, 5).total).toBe(14)
    expect(rolar('4d6dh1', 1, 6, 3, 5).total).toBe(9)
    expect(rolar('4d6dl2', 1, 6, 3, 5).total).toBe(11)
    // Empate fica com quem veio primeiro — a marcação não pisca entre um render e outro.
    expect(rolar('2d6kh1', 4, 4).termos[0].dados.map((d) => d.mantido)).toEqual([true, false])
  })

  it('explosão: a face máxima concede outro lançamento, e o dado continua sendo UM dado', () => {
    const r = rolar('1d6!', 6, 6, 2)
    expect(r.total).toBe(14)
    expect(r.termos[0].dados).toEqual([{ faces: [6, 6, 2], valor: 14, mantido: true }])
    expect(r.pedidos).toEqual([
      [6, 1],
      [6, 1],
      [6, 1]
    ])
    // Manter olha o valor final: um 6+4 vale 10 e ganha de um 5.
    expect(rolar('2d6!kh1', 6, 5, 4).total).toBe(10)
    expect(rolar('1d6!', 3).termos[0].dados[0].faces).toEqual([3])
  })

  it('a explosão tem teto, o mesmo da bandeja', () => {
    const { fonte, pedidos } = fila(6, 6, 6, 6, 6, 6)
    const r = avaliarFormula(ler('1d6!'), { dados: fonte, tetoDeExplosoes: 2 })
    if (!r.ok) throw new Error(r.mensagem)
    // Teto 2 = até dois elos além da face que caiu: três faces, e a fonte não é chamada de novo.
    expect(r.termos[0].dados[0].faces).toEqual([6, 6, 6])
    expect(pedidos).toHaveLength(3)
    expect(r.total).toBe(18)
  })

  it('reroll acontece uma vez, e antes da explosão', () => {
    const r = rolar('2d6r<2', 1, 5, 4)
    expect(r.total).toBe(9)
    expect(r.termos[0].dados[0]).toEqual({ faces: [4], rerolado: 1, valor: 4, mantido: true })
    expect(r.termos[0].dados[1]).toEqual({ faces: [5], valor: 5, mantido: true })
    expect(r.pedidos).toEqual([
      [6, 2],
      [6, 1]
    ])
    // Uma vez só: o segundo 1 fica.
    expect(rolar('1d6r<2', 1, 1).termos[0].dados[0]).toEqual({ faces: [1], rerolado: 1, valor: 1, mantido: true })
    // Rerolou pra 6, e o 6 explode.
    expect(rolar('1d6!r<2', 1, 6, 3).total).toBe(9)
  })

  it('contar sucessos, entre os dados mantidos', () => {
    expect(rolar('6d6#>=5', 5, 6, 1, 2, 5, 3).total).toBe(3)
    expect(rolar('6d6kh3#>=5', 5, 6, 1, 2, 5, 3).total).toBe(3)
    expect(rolar('6d6kh2#>=5', 5, 6, 1, 2, 5, 3).total).toBe(2)
    expect(rolar('3d10#=10', 10, 1, 10).total).toBe(2)
    expect(rolar('3d6#>=5', 1, 2, 3).total).toBe(0)
    // Explodido, o valor conta como um só: 6+1 = 7 satisfaz >= 5.
    expect(rolar('1d6!#>=5', 6, 1).total).toBe(1)
  })

  it('o alvo julga a rolagem inteira', () => {
    expect(rolar('1d20+5>=15', 10)).toMatchObject({ total: 15, sucesso: true })
    expect(rolar('1d20+5>=15', 9)).toMatchObject({ total: 14, sucesso: false })
    expect(rolar('1d20=20', 20).sucesso).toBe(true)
    expect(rolar('1d100<=45', 45).sucesso).toBe(true)
    expect(rolar('1d100<=45', 46).sucesso).toBe(false)
  })

  it('referências vêm da ficha; sem valor, a fórmula falha em vez de chutar', () => {
    const ficha: Record<string, number> = { 'STR.mod': 3, prof: 2 }
    const referencia = (caminho: string[]) => ficha[caminho.join('.')]
    const { fonte } = fila(10)
    const r = avaliarFormula(ler('1d20+@STR.mod+@prof'), { dados: fonte, referencia })
    expect(r).toMatchObject({ ok: true, total: 15 })

    const semProf = avaliarFormula(ler('1d20+@prof'), { dados: fila(10).fonte, referencia: () => undefined })
    expect(semProf).toEqual({ ok: false, mensagem: 'A ficha não tem valor para @prof.' })
    const semContexto = avaliarFormula(ler('@STR.mod'), { dados: fila().fonte })
    expect(semContexto).toMatchObject({ ok: false })
  })

  it('aritmética', () => {
    expect(rolar('(1d8+2)*2', 5).total).toBe(14)
    expect(rolar('1d8+2*2', 5).total).toBe(9)
    expect(rolar('-1d4', 3).total).toBe(-3)
    expect(rolar('1d6-1d4', 5, 2).total).toBe(3)
    expect(rolar('10-2-3').total).toBe(5)
    expect(rolar('2*3*4').total).toBe(24)
    expect(rolar('1d20 - -2', 1).total).toBe(3)
  })

  it('fonte de dados errada não passa em silêncio', () => {
    const curta = avaliarFormula(ler('2d6'), { dados: () => [3] })
    expect(curta).toEqual({ ok: false, mensagem: 'A fonte de dados devolveu 1 faces em vez de 2.' })
    const foraDaFace = avaliarFormula(ler('1d6'), { dados: () => [7] })
    expect(foraDaFace).toEqual({ ok: false, mensagem: 'A fonte de dados devolveu 7 num d6.' })
    const zero = avaliarFormula(ler('1d6'), { dados: () => [0] })
    expect(zero).toMatchObject({ ok: false })
    const quebrada = avaliarFormula(ler('1d6'), { dados: () => [1.5] })
    expect(quebrada).toMatchObject({ ok: false })
  })
})

describe('de volta a texto', () => {
  it('forma canônica: minúsculas, espaços em volta dos operadores, sufixos colados', () => {
    expect(escreverFormula(ler('1D20+5'))).toBe('1d20 + 5')
    expect(escreverFormula(ler('d%'))).toBe('1d100')
    expect(escreverFormula(ler('4d6 kh3 !'))).toBe('4d6kh3!')
    expect(escreverFormula(ler('4d6dl1'))).toBe('4d6dl1')
    expect(escreverFormula(ler('2d6 r<2 #>=5'))).toBe('2d6r<2#>=5')
    expect(escreverFormula(ler('1d20+@STR.mod+@prof >= 15'))).toBe('1d20 + @STR.mod + @prof >= 15')
    expect(escreverFormula(ler('-1d4'))).toBe('-1d4')
    expect(escreverFormula(ler('+5'))).toBe('5')
  })

  it('parênteses só onde a precedência exige', () => {
    expect(escreverFormula(ler('(1d8+2)*2'))).toBe('(1d8 + 2) * 2')
    expect(escreverFormula(ler('1d8+2*2'))).toBe('1d8 + 2 * 2')
    expect(escreverFormula(ler('1d6-(1d4+1)'))).toBe('1d6 - (1d4 + 1)')
    expect(escreverFormula(ler('(1d6-1d4)+1'))).toBe('1d6 - 1d4 + 1')
    expect(escreverFormula(ler('-(1d4+1)'))).toBe('-(1d4 + 1)')
    expect(escreverFormula(ler('2*(3*4)'))).toBe('2 * (3 * 4)')
  })

  it('o que foi escrito lê de volta igual', () => {
    const exemplos = [
      '1d20 + 5',
      '4d6kh3',
      '2d20kl1 + @DEX.mod',
      '1d6! + 1d8',
      '6d6#>=5',
      '2d6r<2 + 3',
      '(1d8 + 2) * 2',
      '1d6 - (1d4 + 1)',
      '-1d4',
      '1d20 + @STR.mod + @prof >= 15',
      '1d100 <= 45'
    ]
    for (const texto of exemplos) {
      const canonico = escreverFormula(ler(texto))
      expect(canonico).toBe(texto)
      expect(escreverFormula(ler(canonico))).toBe(canonico)
    }
  })
})
