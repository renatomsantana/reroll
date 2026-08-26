import { useCallback } from 'react'
import type { RollResult } from '@shared/types/dice'
import { MAXIMO_DO_HISTORICO, type ItemDoHistorico } from '@shared/types/historico'
import { useNotes } from './useNotes'

/**
 * O histórico de rolagens e descansos DO PERSONAGEM ABERTO.
 *
 * Era um `useState` daqui: sumia ao fechar o app e era o mesmo pra todo personagem. A spec (§3.2 e
 * §9.1 da importação) lista o histórico entre o que troca junto com o personagem e volta como
 * estava; agora ele mora no `notes.json` dele (`NotesData.historico`), então trocar de personagem
 * troca o histórico, e fechar o app não apaga nada. A gravação é a mesma da ficha, a cada item.
 *
 * A guarda de `useNotes` vale aqui também: uma rolagem feita antes de a ficha do personagem ter
 * carregado é descartada em vez de gravada na ficha errada (ver `prontoRef` lá).
 */
export function useRollHistory() {
  const { notes, update, updateField } = useNotes()

  const registrar = useCallback(
    (item: ItemDoHistorico) => {
      update((previous) => ({ ...previous, historico: [item, ...previous.historico].slice(0, MAXIMO_DO_HISTORICO) }))
    },
    [update]
  )

  const addToHistory = useCallback((result: RollResult) => registrar({ tipo: 'rolagem', rolagem: result }), [registrar])

  const registrarDescanso = useCallback(
    (nome: string, resumo: string) =>
      registrar({ tipo: 'descanso', id: crypto.randomUUID(), timestamp: Date.now(), nome, resumo }),
    [registrar]
  )

  const clearHistory = useCallback(() => updateField('historico', []), [updateField])

  return { history: notes.historico, addToHistory, registrarDescanso, clearHistory }
}
