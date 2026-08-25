import { useEffect, useRef } from 'react'
import type { ItemDoHistorico } from '@shared/types/historico'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useSettings } from '@renderer/settings/SettingsContext'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { HistoryEntry } from './HistoryEntry'
import './HistoryModal.css'

interface HistoryModalProps {
  history: ItemDoHistorico[]
  onClear: () => void
  onClose: () => void
}

function formatarHora(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
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
  const { language } = useSettings()
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
            {history.map((item) =>
              item.tipo === 'rolagem' ? (
                <HistoryEntry key={item.rolagem.id} result={item.rolagem} />
              ) : (
                /* O descanso (spec §3.8) como linha do diário: hora, "— nome —", e o que mudou. */
                <div key={item.id} className="history-evento">
                  <span className="history-entry-time">{formatarHora(item.timestamp, language)}</span>
                  <span className="history-evento-nome">{t.history.restEvent.replace('{name}', item.nome)}</span>
                  {item.resumo && <span className="history-evento-resumo">{item.resumo}</span>}
                </div>
              )
            )}
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
