import { useState } from 'react'
import type { UpdateStatus } from '@shared/types/update'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import './UpdatePrompt.css'

/**
 * Pergunta que o APP faz sozinho quando encontra versão nova — pedido do usuário ("pergunte ao
 * usuário se quer fazer a update assim que tiver uma nova").
 *
 * Janela do próprio app, e não o `confirm()` do sistema, justamente por ser não solicitada: um
 * diálogo nativo rouba o foco e aparece com a cara do Chrome no meio de uma rolagem. Este fica
 * dentro da janela, no vocabulário do 98 como o resto.
 *
 * Duas perguntas, na mesma janela, porque a partir do "sim" o app baixa ~100MB e reinicia — e isso
 * não pode acontecer por clique errado num aviso que apareceu sem ninguém pedir.
 */
interface UpdatePromptProps {
  status: UpdateStatus
  /** "Agora não": some até a próxima abertura. O aviso na barra de baixo continua lá. */
  onDismiss: () => void
}

export function UpdatePrompt({ status, onDismiss }: UpdatePromptProps) {
  const t = useTranslation()
  const [confirming, setConfirming] = useState(false)

  const version =
    status.state === 'available' ||
    status.state === 'downloading' ||
    status.state === 'ready' ||
    status.state === 'installing'
      ? status.version
      : ''

  /**
   * INSTALANDO: a última coisa que aparece antes de o app sumir da tela.
   *
   * Ela existe por causa do relato de "a tela trava quando atualiza". O app fecha, o instalador roda
   * em silêncio e por alguns segundos não há NADA — sem este aviso, quem está olhando não tem como
   * saber que aquilo é a atualização acontecendo, e não a máquina travando. Sem botão nenhum: não há
   * o que decidir aqui, e um botão que não faz nada é pior que nenhum.
   */
  if (status.state === 'installing') {
    return (
      <div className="modal-overlay update-prompt-overlay">
        <Card className="update-prompt">
          <h2 className="update-prompt-title">{t.settings.updatePromptTitle}</h2>
          <p className="update-prompt-text">
            {t.settings.updateInstalling.replace('{version}', version)}
          </p>
        </Card>
      </div>
    )
  }

  // Enquanto baixa, a janela FICA — com a barra de progresso. Some o botão de fechar junto: o app
  // vai reiniciar sozinho ao terminar, e desaparecer no meio disso pareceria que travou.
  if (status.state === 'downloading') {
    return (
      <div className="modal-overlay update-prompt-overlay">
        <Card className="update-prompt">
          <h2 className="update-prompt-title">{t.settings.updatePromptTitle}</h2>
          <p className="update-prompt-text">
            {t.settings.updateDownloading
              .replace('{version}', version)
              .replace('{percent}', String(status.percent))}
          </p>
          <div className="update-prompt-bar">
            <div className="update-prompt-bar-fill" style={{ width: `${status.percent}%` }} />
          </div>
        </Card>
      </div>
    )
  }

  if (status.state !== 'available') return null

  return (
    <div className="modal-overlay">
      <Card className="update-prompt">
        <h2 className="update-prompt-title">{t.settings.updatePromptTitle}</h2>
        <p className="update-prompt-text">
          {confirming
            ? t.settings.updateConfirmAgain
            : t.settings.updateConfirm.replace('{version}', version)}
        </p>
        {/*
          O CHANGELOG da versão nova, que a spec pede junto da pergunta (seção 4). Some na segunda
          confirmação: ali a decisão já foi tomada e o que falta é o aviso de que o app vai reiniciar.

          Renderizado como TEXTO, dentro de um `<pre>`, e nunca como marcação. O conteúdo vem de fora
          — é a descrição de uma release na internet —, e passá-lo por `dangerouslySetInnerHTML` seria
          dar a uma string remota o direito de virar HTML dentro do app. As tags já foram tiradas no
          processo principal (ver `textoDasNotas`); isto aqui é a segunda tranca.
        */}
        {!confirming && status.notes && (
          <>
            <p className="update-prompt-notes-title">{t.settings.updateNotesTitle}</p>
            <pre className="update-prompt-notes">{status.notes}</pre>
          </>
        )}
        <div className="update-prompt-actions">
          <Button variant="secondary" onClick={onDismiss}>
            {t.settings.updateLater}
          </Button>
          {confirming ? (
            <Button variant="primary" onClick={() => void window.api.update.download()}>
              {t.settings.updateConfirmYes}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setConfirming(true)}>
              {t.settings.updateNow}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
