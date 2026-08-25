import { describe, expect, it } from 'vitest'
import type { RollResult } from '../types/dice'
import { linhaParaChat } from './linhaParaChat'

const ROTULOS = { advantage: 'vant.', disadvantage: 'desv.', success: 'sucesso', failure: 'fracasso' }

function rolagem(parcial: Partial<RollResult>): RollResult {
  return {
    id: 'r',
    label: '1d20 + 5',
    groups: [{ sides: 20, rolls: [12], subtotal: 12 }],
    modifierTotal: 5,
    total: 17,
    timestamp: 0,
    ...parcial
  }
}

/**
 * A linha do chat (spec §3.5), conferida contra o exemplo da própria spec e contra os casos em que
 * uma linha se contradiz com o total — que no chat da mesa todo mundo vê.
 */
describe('linhaParaChat', () => {
  it('o exemplo da spec: nome do preset, expressão, dado, modificador e total em negrito', () => {
    const linha = linhaParaChat(rolagem({ sourceName: 'Percepção' }), true, ROTULOS)
    expect(linha).toBe('🎲 Percepção: 1d20 + 5 → [12] +5 = **17**')
  })

  it('texto puro: sem asteriscos, pra chat que não renderiza Markdown', () => {
    expect(linhaParaChat(rolagem({ sourceName: 'Percepção' }), false, ROTULOS)).toBe('🎲 Percepção: 1d20 + 5 → [12] +5 = 17')
  })

  it('rolagem sem preset usa só a expressão; modificador negativo sai com "-"', () => {
    const linha = linhaParaChat(rolagem({ label: '2d6 - 1', groups: [{ sides: 6, rolls: [3, 5], subtotal: 8 }], modifierTotal: -1, total: 7 }), true, ROTULOS)
    expect(linha).toBe('🎲 2d6 - 1 → [3+5] -1 = **7**')
  })

  it('regra de manter: o descartado entre parênteses e o mantido em negrito — a soma bate com o total', () => {
    const linha = linhaParaChat(
      rolagem({ label: '3d20 (usa o maior)', groups: [{ sides: 20, rolls: [4, 17, 9], subtotal: 30 }], modifierTotal: 0, total: 17, keep: { mode: 'highest', count: 1 } }),
      true,
      ROTULOS
    )
    expect(linha).toBe('🎲 3d20 (usa o maior) → [(4)+**17**+(9)] = **17**')
  })

  it('vantagem: as duas tentativas, a mantida em negrito e a perdida entre parênteses, com o sufixo', () => {
    const linha = linhaParaChat(
      rolagem({ groups: [{ sides: 20, rolls: [18], subtotal: 18 }], total: 23, advantageMode: 'advantage', descartados: [{ sides: 20, rolls: [4], subtotal: 4 }] }),
      true,
      ROTULOS
    )
    expect(linha).toBe('🎲 1d20 + 5 → [**18** | (4)] +5 = **23** (vant.)')
  })

  it('desvantagem SEM a tentativa guardada (rolagem antiga): só o que ficou, e o sufixo diz o modo', () => {
    const linha = linhaParaChat(rolagem({ advantageMode: 'disadvantage' }), false, ROTULOS)
    expect(linha).toBe('🎲 1d20 + 5 → [12] +5 = 17 (desv.)')
  })

  it('explosão por extenso: um d6 valendo 14 se explica sozinho', () => {
    const linha = linhaParaChat(
      rolagem({ label: '1d6!', groups: [{ sides: 6, rolls: [14], subtotal: 14, chains: [[6, 6, 2]] }], modifierTotal: 0, total: 14 }),
      false,
      ROTULOS
    )
    expect(linha).toBe('🎲 1d6! → [14(6+6+2)] = 14')
  })

  it('fórmula com alvo: lista em vez de soma, sem modificador solto, e o julgamento no fim', () => {
    const linha = linhaParaChat(
      rolagem({
        sourceName: 'Ataque',
        label: '1d20+5 >= 15',
        formulaTexto: '1d20+5 >= 15',
        groups: [{ sides: 20, rolls: [12], subtotal: 12 }],
        modifierTotal: 0,
        total: 17,
        sucesso: true
      }),
      true,
      ROTULOS
    )
    expect(linha).toBe('🎲 Ataque: 1d20+5 >= 15 → [12] = **17** ✓ sucesso')
  })

  it('contagem de sucessos: o que não conta vai entre parênteses, pela marca pronta', () => {
    const linha = linhaParaChat(
      rolagem({
        label: '4d6#>=5',
        formulaTexto: '4d6#>=5',
        groups: [{ sides: 6, rolls: [6, 2, 5, 1], subtotal: 2 }],
        modifierTotal: 0,
        total: 2,
        mantidos: [[true, false, true, false]]
      }),
      false,
      ROTULOS
    )
    expect(linha).toBe('🎲 4d6#>=5 → [6, (2), 5, (1)] = 2')
  })
})
