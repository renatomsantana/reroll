import { useTranslation } from '@renderer/i18n/useTranslation'
import type { UpdateStatus } from '@shared/types/update'

interface StatusBarProps {
  /** Estado da atualização (ver `useUpdateStatus`) — só aparece aqui quando há versão nova esperando. */
  updateStatus: UpdateStatus
  onOpenSettings: () => void
}

/**
 * Barra de baixo: atalhos, crédito e — quando existe — o aviso de versão nova.
 *
 * O aviso ficava só dentro das Preferências, e por isso não chegava em ninguém: quem não abrisse a
 * engrenagem por conta própria não descobria que havia atualização. Aqui ele fica à vista o tempo
 * todo, sem interromper nada, e clicar leva direto pro lugar de atualizar.
 */
export function StatusBar({ updateStatus, onOpenSettings }: StatusBarProps) {
  const t = useTranslation()
  const hasUpdate = updateStatus.state === 'available'

  return (
    <div className="statusbar">
      <span className="statusbar-shortcuts">{t.statusBar.shortcutsHint}</span>
      {hasUpdate && (
        <button type="button" className="statusbar-update" onClick={onOpenSettings}>
          {t.settings.updateBadge.replace('{version}', updateStatus.version)}
        </button>
      )}
      <span className="statusbar-credit">{t.credit}</span>
    </div>
  )
}
