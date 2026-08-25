import { useCallback, useState } from 'react'
import type { RollResult } from '@shared/types/dice'
import type { ItemDoHistorico } from '@shared/types/historico'

const MAX_HISTORY_ENTRIES = 100

/**
 * O histórico da SESSÃO: rolagens e, desde o §3.8, eventos (o descanso). Na memória e por sessão
 * do app, como sempre foi — "some ao fechar" está na lista de conhecidos do beta.
 */
export function useRollHistory() {
  const [history, setHistory] = useState<ItemDoHistorico[]>([])

  const registrar = useCallback((item: ItemDoHistorico) => {
    setHistory((prev) => [item, ...prev].slice(0, MAX_HISTORY_ENTRIES))
  }, [])

  const addToHistory = useCallback((result: RollResult) => registrar({ tipo: 'rolagem', rolagem: result }), [registrar])

  /** "— Descanso longo — PV 12→27": o descanso vira linha do diário da sessão (spec §3.8). */
  const registrarDescanso = useCallback(
    (nome: string, resumo: string) =>
      registrar({ tipo: 'descanso', id: crypto.randomUUID(), timestamp: Date.now(), nome, resumo }),
    [registrar]
  )

  const clearHistory = useCallback(() => setHistory([]), [])

  return { history, addToHistory, registrarDescanso, clearHistory }
}
