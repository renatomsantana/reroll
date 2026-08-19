import { useTranslation } from '@renderer/i18n/useTranslation'
import type { UpdateStatus } from '@shared/types/update'
// O CSS desta barra existia desde sempre e NÃO era importado por ninguém — nem aqui, nem no
// `App.css`. Ou seja, a barra vinha rodando sem estilo nenhum: sem o fundo cinza, sem o degrau de
// cima e, principalmente, sem o `justify-content: space-between` que joga o crédito pra direita. Era
// por isso que o "made by renatinm1" aparecia grudado no fim do texto dos atalhos em vez de na quina.
import './StatusBar.css'

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
