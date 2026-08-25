import { describe, expect, it } from 'vitest'
import {
  MAXIMO_DE_DESCANSOS,
  aplicarDescanso,
  descansoCompleto,
  descansosPadrao,
  normalizarDescansos,
  resumoDoDescanso
} from './descanso'
import type { RecursoVital } from './recursoVital'

const PV: RecursoVital = { id: 'pv', nome: 'PV', atual: 12, maximo: 45 }
const PE: RecursoVital = { id: 'pe', nome: 'PE', atual: 4, maximo: 12 }
const SAN: RecursoVital = { id: 'san', nome: 'Sanidade', atual: 40, maximo: 40 }
const RECURSOS = [PV, PE, SAN]

/** O descanso (spec §3.8): o que o clique muda, o que a confirmação mostra, o que o disco aceita. */
describe('aplicarDescanso', () => {
  it('máximo volta ao máximo, somar soma preso ao máximo, nada não mexe; o resumo só lista o que mudou', () => {
    const descanso = {
      id: 'd',
      nome: 'Descanso',
      efeitos: [
        { recursoId: 'pv', modo: 'maximo' as const },
        { recursoId: 'pe', modo: 'somar' as const, quantidade: 20 }
      ]
    }
    const { recursos, mudancas } = aplicarDescanso(RECURSOS, descanso)
    expect(recursos.map((r) => r.atual)).toEqual([45, 12, 40])
    expect(mudancas).toEqual([
      { nome: 'PV', de: 12, para: 45 },
      { nome: 'PE', de: 4, para: 12 }
    ])
    expect(resumoDoDescanso(mudancas)).toBe('PV 12→45, PE 4→12')
  })

  it('barra já cheia não entra no resumo, e um descanso sem efeito não muda nada', () => {
    const { recursos, mudancas } = aplicarDescanso(RECURSOS, { id: 'd', nome: 'Curto', efeitos: [] })
    expect(recursos).toEqual(RECURSOS)
    expect(mudancas).toEqual([])
    expect(resumoDoDescanso(mudancas)).toBe('')
  })

  it('o descanso completo devolve tudo', () => {
    const { recursos } = aplicarDescanso(RECURSOS, descansoCompleto(RECURSOS, 'Descanso'))
    expect(recursos.map((r) => r.atual)).toEqual([45, 12, 40])
  })
})

describe('descansosPadrao — o que a ficha importada recebe', () => {
  it('D&D: longo devolve tudo, curto vem vazio pra pessoa preencher', () => {
    const [longo, curto] = descansosPadrao('D&D 5e', RECURSOS)
    expect(longo.nome).toBe('Descanso longo')
    expect(aplicarDescanso(RECURSOS, longo).recursos.map((r) => r.atual)).toEqual([45, 12, 40])
    expect(curto.nome).toBe('Descanso curto')
    expect(curto.efeitos).toEqual([])
  })

  it('Ordem: descanso devolve tudo, intervalo só o PE', () => {
    const [descanso, intervalo] = descansosPadrao('Ordem Paranormal', RECURSOS)
    expect(descanso.nome).toBe('Descanso')
    expect(intervalo.nome).toBe('Intervalo')
    expect(aplicarDescanso(RECURSOS, intervalo).mudancas).toEqual([{ nome: 'PE', de: 4, para: 12 }])
  })

  it('sistema desconhecido: um descanso que devolve tudo', () => {
    const lista = descansosPadrao('Kids on Bikes', RECURSOS)
    expect(lista).toHaveLength(1)
    expect(aplicarDescanso(RECURSOS, lista[0]).recursos.map((r) => r.atual)).toEqual([45, 12, 40])
  })
})

describe('normalizarDescansos', () => {
  it('descarta tipo sem nome e efeito de barra que não existe; modo torto vira nada; quantidade torta vira zero', () => {
    const lidos = normalizarDescansos(
      [
        {
          id: 'a',
          nome: 'Descanso',
          efeitos: [
            { recursoId: 'pv', modo: 'maximo' },
            { recursoId: 'sumiu', modo: 'maximo' },
            { recursoId: 'pe', modo: 'somar', quantidade: 'muito' },
            { recursoId: 'san', modo: 'tudo' },
            { recursoId: 'pv', modo: 'somar', quantidade: 3 }
          ]
        },
        { id: 'b', nome: '', efeitos: [] },
        'texto'
      ],
      RECURSOS
    )
    expect(lidos).toEqual([
      {
        id: 'a',
        nome: 'Descanso',
        efeitos: [
          { recursoId: 'pv', modo: 'maximo' },
          { recursoId: 'pe', modo: 'somar', quantidade: 0 }
        ]
      }
    ])
  })

  it('lista ausente vira vazia; corta no teto', () => {
    expect(normalizarDescansos(undefined, RECURSOS)).toEqual([])
    const muitos = Array.from({ length: MAXIMO_DE_DESCANSOS + 3 }, (_, i) => ({ id: String(i), nome: `D${i}`, efeitos: [] }))
    expect(normalizarDescansos(muitos, RECURSOS)).toHaveLength(MAXIMO_DE_DESCANSOS)
  })
})
