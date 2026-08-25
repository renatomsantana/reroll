import { describe, expect, it } from 'vitest'
import { MAXIMO_DE_CONDICOES, condicoesPadrao, normalizarCondicoes, normalizarHud } from './hud'

/** O estado do HUD (spec §3.6) e as condições, na leitura do disco. */
describe('normalizarHud', () => {
  it('ausente é o padrão; canto desconhecido volta pro padrão; booleanos tortos idem', () => {
    expect(normalizarHud(undefined)).toEqual({ canto: 'se', visivel: true, mini: false })
    expect(normalizarHud({ canto: 'centro', visivel: 'sim', mini: 1 })).toEqual({ canto: 'se', visivel: true, mini: false })
    expect(normalizarHud({ canto: 'nw', visivel: false, mini: true })).toEqual({ canto: 'nw', visivel: false, mini: true })
  })
})

describe('normalizarCondicoes', () => {
  it('descarta sem nome, corrige ativa, dá id a quem repete, corta no teto', () => {
    const lidas = normalizarCondicoes([
      { id: 'a', nome: 'Machucado', ativa: true },
      { id: 'a', nome: 'Enlouquecendo', ativa: 'sim' },
      { id: 'b', nome: '' },
      null
    ])
    expect(lidas[0]).toEqual({ id: 'a', nome: 'Machucado', ativa: true })
    expect(lidas[1].nome).toBe('Enlouquecendo')
    expect(lidas[1].ativa).toBe(false)
    expect(lidas[1].id).not.toBe('a')
    expect(lidas).toHaveLength(2)

    const muitas = Array.from({ length: MAXIMO_DE_CONDICOES + 2 }, (_, i) => ({ id: String(i), nome: `C${i}` }))
    expect(normalizarCondicoes(muitas)).toHaveLength(MAXIMO_DE_CONDICOES)
  })

  it('Ordem sugere Machucado e Enlouquecendo, desligadas; o resto nada', () => {
    expect(condicoesPadrao('Ordem Paranormal').map((c) => [c.nome, c.ativa])).toEqual([['Machucado', false], ['Enlouquecendo', false]])
    expect(condicoesPadrao('D&D 5e')).toEqual([])
  })
})
