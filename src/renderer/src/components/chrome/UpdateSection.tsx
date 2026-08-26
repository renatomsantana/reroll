import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/types/update'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useDialogo } from '@renderer/components/common/Dialogo'
import { Button } from '../common/Button'

/**
 * Versão instalada + atualização, dentro das Preferências. É a única presença da atualização na
 * interface: o app nunca abre diálogo por conta própria, nem baixa nada sozinho.
 *
 * O fluxo é o que o usuário desenhou: o app descobre em silêncio que existe versão nova, e quem
 * decide é quem está usando — clicar em "Atualizar", responder "deseja atualizar?" e depois "tem
 * certeza?". Só então o download começa. As duas perguntas são de propósito: a partir do "sim" o
 * app baixa ~100MB e reinicia sozinho, e isso não pode acontecer por clique errado.
 */
export function UpdateSection() {
  const t = useTranslation()
  const dialogo = useDialogo()
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    void window.api.update.getVersion().then(setVersion)
    // O estado vem do main, que já pode ter checado antes deste painel abrir — sem isso, abrir as
    // Preferências depois da checagem mostraria "nada aconteceu" mesmo tendo versão nova esperando.
    void window.api.update.getStatus().then(setStatus)
    return window.api.update.onStatus(setStatus)
  }, [])

  function statusText(): string {
    switch (status.state) {
      case 'checking':
        return t.settings.updateChecking
      case 'upToDate':
        return t.settings.updateUpToDate
      case 'available':
        return t.settings.updateAvailable.replace('{version}', status.version)
      case 'downloading':
        return t.settings.updateDownloading
          .replace('{version}', status.version)
          .replace('{percent}', String(status.percent))
      case 'ready':
        return t.settings.updateReady.replace('{version}', status.version)
      case 'error':
        return t.settings.updateError
      case 'portable':
        return t.settings.updatePortable
      default:
        return ''
    }
  }

  /** As duas perguntas, em sequência, no diálogo do app (ver `Dialogo.tsx` sobre o `confirm` nativo). */
  function handleUpdate(): void {
    if (status.state !== 'available') return
    const versao = status.version
    void (async () => {
      if (!(await dialogo.confirmar(t.settings.updateConfirm.replace('{version}', versao)))) return
      if (!(await dialogo.confirmar(t.settings.updateConfirmAgain))) return
      await window.api.update.download()
    })()
  }

  const isBusy = status.state === 'checking' || status.state === 'downloading'

  return (
    <div className="settings-panel-field settings-panel-field-column">
      <span>
        {t.settings.version} <strong>{version || '...'}</strong>
      </span>
      {/* O texto do erro do `electron-updater` é técnico (URL, código HTTP) — vai pro `title`, não pra tela. */}
      <small
        className="settings-panel-hint"
        title={status.state === 'error' ? status.message : undefined}
      >
        {statusText()}
      </small>
      <div className="settings-panel-update-actions">
        {status.state === 'available' ? (
          <Button variant="primary" onClick={handleUpdate}>
            {t.settings.updateNow}
          </Button>
        ) : status.state === 'portable' ? null : (
          <Button variant="secondary" disabled={isBusy} onClick={() => void window.api.update.check()}>
            {t.settings.checkUpdates}
          </Button>
        )}
        {/* Rede de segurança: se o reinício automático não acontecer, ainda dá pra aplicar na mão. */}
        {status.state === 'ready' && (
          <Button variant="primary" onClick={() => void window.api.update.installNow()}>
            {t.settings.restartNow}
          </Button>
        )}
      </div>
    </div>
  )
}
