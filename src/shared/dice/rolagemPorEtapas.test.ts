import { describe, expect, it } from 'vitest'
import { analisarFormula, type Formula } from './formula'
import {
  avancarRolagem,
  conferirFormulaPraBandeja,
  gruposDaFormula,
  resultadoParaRollResult,
  termosDaFormula,
  type FaceColhida,
  type PassoDaRolagem
} from './rolagemPorEtapas'

function formulaDe(texto: string): Formula {
  const lido = analisarFormula(texto)
  if (!lido.ok) throw new Error(`Fórmula de teste não lê: ${texto} — ${lido.mensagem}`)
  return lido.formula
}

/**
 * Guia a rolagem como a cena guiaria, com as ondas roteirizadas: cada pedido consome a próxima
 * leva do roteiro. Devolve o passo final e os pedidos feitos, pra conferir a coreografia inteira.
 */
function rolarComRoteiro(
  formula: Formula,
  roteiro: number[][]
): { passo: PassoDaRolagem; pedidos: { lados: number; quantidade: number }[] } {
  const faces: FaceColhida[] = []
  const pedidos: { lados: number; quantidade: number }[] = []
  for (let onda = 0; ; onda += 1) {
    const passo = avancarRolagem(formula, faces)
    if (passo.tipo !== 'precisa') return { passo, pedidos }
    pedidos.push(passo.pedido)
    const leva = roteiro[onda]
    if (!leva) throw new Error(`O roteiro acabou na onda ${onda} (pedido ${passo.pedido.quantidade}d${passo.pedido.lados}).`)
    if (leva.length !== passo.pedido.quantidade) {
      throw new Error(`Onda ${onda}: o roteiro tem ${leva.length} faces e o pedido é de ${passo.pedido.quantidade}.`)
    }
    for (const face of leva) faces.push({ lados: passo.pedido.lados, face })
  }
}

function pronta(passo: PassoDaRolagem): Extract<PassoDaRolagem, { tipo: 'pronta' }> {
  if (passo.tipo !== 'pronta') throw new Error(`Esperava 'pronta', veio '${passo.tipo}'.`)
  return passo
}

describe('avancarRolagem — a rolagem por ondas', () => {
  it('uma fórmula simples pede uma onda só e soma', () => {
    const { passo, pedidos } = rolarComRoteiro(formulaDe('1d20+5'), [[13]])
    expect(pedidos).toEqual([{ lados: 20, quantidade: 1 }])
    expect(pronta(passo).resultado.total).toBe(18)
  })

  it('reroll: o dado que caiu abaixo volta sozinho na onda seguinte', () => {
    const { passo, pedidos } = rolarComRoteiro(formulaDe('2d6r<2'), [[1, 5], [4]])
    expect(pedidos).toEqual([
      { lados: 6, quantidade: 2 },
      { lados: 6, quantidade: 1 }
    ])
    const resultado = pronta(passo).resultado
    expect(resultado.total).toBe(9)
    expect(resultado.termos[0].dados[0].rerolado).toBe(1)
    expect(resultado.termos[0].dados[0].valor).toBe(4)
  })

  it('explosão: cada elo é uma onda de um dado, até parar', () => {
    const { passo, pedidos } = rolarComRoteiro(formulaDe('2d6!'), [[6, 3], [6], [2]])
    expect(pedidos).toEqual([
      { lados: 6, quantidade: 2 },
      { lados: 6, quantidade: 1 },
      { lados: 6, quantidade: 1 }
    ])
    expect(pronta(passo).resultado.total).toBe(6 + 6 + 2 + 3)
  })

  it('dois termos caem em duas levas, na ordem da fórmula', () => {
    const { passo, pedidos } = rolarComRoteiro(formulaDe('2d20kl1 + 1d4'), [[17, 4], [3]])
    expect(pedidos).toEqual([
      { lados: 20, quantidade: 2 },
      { lados: 4, quantidade: 1 }
    ])
    expect(pronta(passo).resultado.total).toBe(4 + 3)
  })

  it('contar sucessos: o valor do termo é a contagem', () => {
    const { passo } = rolarComRoteiro(formulaDe('6d6#>=5'), [[5, 2, 6, 1, 5, 3]])
    expect(pronta(passo).resultado.total).toBe(3)
  })

  it('multiplicação e número negativo entram na conta', () => {
    const { passo } = rolarComRoteiro(formulaDe('(1d8+2)*2 - 3'), [[5]])
    expect(pronta(passo).resultado.total).toBe((5 + 2) * 2 - 3)
  })

  it('alvo no fim julga a rolagem inteira', () => {
    const acima = rolarComRoteiro(formulaDe('1d20+5 >= 15'), [[13]])
    expect(pronta(acima.passo).resultado.sucesso).toBe(true)
    const abaixo = rolarComRoteiro(formulaDe('1d20+5 >= 15'), [[3]])
    expect(pronta(abaixo.passo).resultado.sucesso).toBe(false)
  })

  it('uma onda pela metade vira outro pedido do que faltou', () => {
    const formula = formulaDe('3d6')
    const passo1 = avancarRolagem(formula, [{ lados: 6, face: 2 }])
    expect(passo1).toEqual({ tipo: 'precisa', pedido: { lados: 6, quantidade: 2 } })
  })

  it('face de tipo errado no diário é falha, não resultado errado', () => {
    const passo = avancarRolagem(formulaDe('1d20'), [{ lados: 6, face: 3 }])
    expect(passo.tipo).toBe('falha')
  })
})

describe('termosDaFormula e gruposDaFormula', () => {
  it('visita os termos na ordem da avaliação, fundo incluído', () => {
    const termos = termosDaFormula(formulaDe('1d6 + 2d8*(1d4+2)'))
    expect(termos.map((t) => `${t.quantidade}d${t.lados}`)).toEqual(['1d6', '2d8', '1d4'])
  })

  it('agrupa por tipo pro mostrador da barra', () => {
    expect(gruposDaFormula(formulaDe('2d6#>=5 + 1d6 + 1d20'))).toEqual([
      { sides: 6, count: 3 },
      { sides: 20, count: 1 }
    ])
  })
})

describe('conferirFormulaPraBandeja', () => {
  it('aceita o que a bandeja joga', () => {
    expect(conferirFormulaPraBandeja(formulaDe('2d6r<2 + 1d20 >= 15'))).toBeNull()
  })

  it('recusa fórmula sem dado nenhum', () => {
    expect(conferirFormulaPraBandeja(formulaDe('5+3'))).toMatch(/pelo menos um dado/)
  })

  it('recusa tipo de dado que a bandeja não tem', () => {
    expect(conferirFormulaPraBandeja(formulaDe('1d30'))).toMatch(/não tem d30/)
  })

  it('recusa um termo maior que uma onda', () => {
    expect(conferirFormulaPraBandeja(formulaDe('21d6'))).toMatch(/no máximo 20/)
  })

  it('termos SOMADOS podem passar do teto — caem em levas', () => {
    expect(conferirFormulaPraBandeja(formulaDe('20d6 + 20d6'))).toBeNull()
  })

  it('recusa referência à ficha, com a mensagem de sempre', () => {
    expect(conferirFormulaPraBandeja(formulaDe('1d20+@STR.mod'))).toMatch(/@STR\.mod/)
  })
})

describe('resultadoParaRollResult', () => {
  it('cada termo vira um grupo, com as marcas prontas', () => {
    const formula = formulaDe('6d6#>=5 + 2d20kl1')
    const { passo } = rolarComRoteiro(formula, [[5, 2, 6, 1, 5, 3], [17, 4]])
    const result = resultadoParaRollResult(formula, pronta(passo).resultado, 'Golpe')
    expect(result.total).toBe(3 + 4)
    expect(result.sourceName).toBe('Golpe')
    expect(result.formulaTexto).toBe('6d6#>=5 + 2d20kl1')
    expect(result.groups.map((g) => g.rolls)).toEqual([
      [5, 2, 6, 1, 5, 3],
      [17, 4]
    ])
    // No termo de contagem, "conta" é "satisfez a condição"; no de manter, é "ficou".
    expect(result.mantidos).toEqual([
      [true, false, true, false, true, false],
      [false, true]
    ])
    expect(result.modifierTotal).toBe(0)
  })

  it('reroll e explosão viram marca e cadeia', () => {
    const formula = formulaDe('2d6r<2!')
    const { passo } = rolarComRoteiro(formula, [[1, 6], [4], [3]])
    const result = resultadoParaRollResult(formula, pronta(passo).resultado)
    expect(result.total).toBe(4 + 6 + 3)
    expect(result.rerolados).toEqual([[1, null]])
    expect(result.groups[0].chains).toEqual([[4], [6, 3]])
    // Todo dado conta: sem marca a mostrar, o campo nem existe.
    expect(result.mantidos).toBeUndefined()
  })

  it('sem alvo não há julgamento; com alvo o sucesso viaja junto', () => {
    const semAlvo = formulaDe('1d20')
    const comAlvo = formulaDe('1d20 >= 10')
    const a = rolarComRoteiro(semAlvo, [[9]])
    const b = rolarComRoteiro(comAlvo, [[9]])
    expect(resultadoParaRollResult(semAlvo, pronta(a.passo).resultado).sucesso).toBeUndefined()
    expect(resultadoParaRollResult(comAlvo, pronta(b.passo).resultado).sucesso).toBe(false)
  })
})
