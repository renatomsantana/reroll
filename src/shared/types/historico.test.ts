import { describe, expect, it } from 'vitest'
import { MAXIMO_DO_HISTORICO, idDoItem, normalizarHistorico, type ItemDoHistorico } from './historico'

/**
 * O HISTÓRICO lido do disco. Ele mora no `notes.json` do personagem, e o mesmo `normalizarHistorico`
 * atende o pacote de personagem, que é arquivo de OUTRA pessoa: o que passa daqui a tela percorre sem
 * perguntar nada, então item torto tem que morrer aqui, sozinho, sem levar a lista junto.
 */

function rolagem(id: string, extras: Record<string, unknown> = {}): unknown {
  return {
    tipo: 'rolagem',
    rolagem: { id, label: '1d20', total: 14, timestamp: 1, groups: [{ sides: 20, rolls: [14], subtotal: 14 }], ...extras }
  }
}

describe('normalizarHistorico — ler o histórico do disco', () => {
  it('lista ausente ou de tipo errado vira vazia', () => {
    for (const bruto of [undefined, null, 42, 'texto', { tipo: 'rolagem' }]) {
      expect(normalizarHistorico(bruto)).toEqual([])
    }
  })

  it('rolagem e descanso atravessam inteiros', () => {
    const lido = normalizarHistorico([
      rolagem('r1'),
      { tipo: 'descanso', id: 'd1', timestamp: 2, nome: 'Descanso longo', resumo: 'PV 12→27' }
    ])
    expect(lido).toHaveLength(2)
    expect(lido.map(idDoItem)).toEqual(['r1', 'd1'])
    expect((lido[1] as Extract<ItemDoHistorico, { tipo: 'descanso' }>).resumo).toBe('PV 12→27')
  })

  /**
   * `HistoryEntry` faz `g.rolls.map(...)` em TODO grupo da rolagem. Antes desta régua, um grupo sem
   * `rolls` derrubava a janela de histórico inteira em vez de custar a linha estragada.
   */
  it('rolagem com grupo torto cai fora, e as boas ficam', () => {
    const lido = normalizarHistorico([
      rolagem('boa1'),
      rolagem('semRolls', { groups: [{ sides: 20 }] }),
      rolagem('rollsNaoENumero', { groups: [{ sides: 6, rolls: ['4'] }] }),
      rolagem('grupoNaoEObjeto', { groups: ['x'] }),
      rolagem('semSides', { groups: [{ rolls: [3] }] }),
      rolagem('boa2')
    ])
    expect(lido.map(idDoItem)).toEqual(['boa1', 'boa2'])
  })

  it('item sem os campos obrigatórios cai fora', () => {
    const lido = normalizarHistorico([
      { tipo: 'rolagem' },
      { tipo: 'rolagem', rolagem: { id: 'sem total', timestamp: 1, groups: [] } },
      { tipo: 'descanso', timestamp: 1, nome: 'sem id' },
      { tipo: 'outra coisa', id: 'x' },
      null,
      rolagem('sobrevivente')
    ])
    expect(lido.map(idDoItem)).toEqual(['sobrevivente'])
  })

  it('descanso sem timestamp ou resumo entra com o que dá', () => {
    const lido = normalizarHistorico([{ tipo: 'descanso', id: 'd1', nome: 'Intervalo' }])
    expect(lido[0]).toEqual({ tipo: 'descanso', id: 'd1', timestamp: 0, nome: 'Intervalo', resumo: '' })
  })

  it('guarda no máximo os primeiros `MAXIMO_DO_HISTORICO`', () => {
    const muitos = Array.from({ length: MAXIMO_DO_HISTORICO + 20 }, (_, i) => rolagem(`r${i}`))
    const lido = normalizarHistorico(muitos)
    expect(lido).toHaveLength(MAXIMO_DO_HISTORICO)
    // O mais novo vem primeiro na lista gravada, então o corte é no FIM.
    expect(idDoItem(lido[0])).toBe('r0')
  })
})
