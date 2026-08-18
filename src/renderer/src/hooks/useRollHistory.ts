import { useCallback, useState } from 'react'
import type { RollResult } from '@shared/types/dice'

const MAX_HISTORY_ENTRIES = 100

export function useRollHistory() {
  const [history, setHistory] = useState<RollResult[]>([])

  const addToHistory = useCallback((result: RollResult) => {
    setHistory((prev) => [result, ...prev].slice(0, MAX_HISTORY_ENTRIES))
  }, [])

  const clearHistory = useCallback(() => setHistory([]), [])

  return { history, addToHistory, clearHistory }
}
