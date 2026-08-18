import { useEffect, useRef } from 'react'
import type { RollResult } from '@shared/types/dice'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { HistoryEntry } from './HistoryEntry'
import './HistoryModal.css'

interface HistoryModalProps {
  history: RollResult[]
  onClear: () => void
  onClose: () => void
}

/**
 * O histórico morava numa coluna FIXA de 260px à direita da janela, ligada o tempo todo. O usuário
 * pediu pra tirar de lá e deixar atrás de um botão nas Preferências ("tipo um logs/histórico pra
 * pessoa poder abrir e ver se quiser") — a lista é consultada de vez em quando, e não valia um
 * quinto da largura da janela permanentemente.
 *
 * Aberto como modal, ele tem MAIS espaço do que tinha na coluna, não menos: aqui cabem hora, nome
 * do golpe, cada dado colorido e o total na mesma linha, que na coluna estreita se atropelavam.
 */
export function HistoryModal({ history, onClear, onClose }: HistoryModalProps) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <Card ref={cardRef} className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="history-modal-header">
          <h2 className="history-modal-title">{t.history.title}</h2>
          {history.length > 0 && (
            <Button variant="ghost" onClick={onClear}>
              {t.history.clear}
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="history-modal-empty">{t.history.empty}</p>
        ) : (
          <div className="history-modal-list">
            {history.map((entry) => (
              <HistoryEntry key={entry.id} result={entry} />
            ))}
          </div>
        )}

        <div className="history-modal-actions">
          <Button variant="primary" onClick={onClose}>
            {t.settings.close}
          </Button>
        </div>
      </Card>
    </div>
  )
}
