import { useTranslation } from '@renderer/i18n/useTranslation'
import { useSettings } from '@renderer/settings/SettingsContext'
import { appIconImageSmall } from '@renderer/assets/icons'
import './TitleBar.css'

export function TitleBar() {
  const t = useTranslation()
  const { appIconId, compactMode, setCompactMode } = useSettings()

  function handleMaximize() {
    /**
     * `void` nos três botões da barra de título (aqui, minimizar e fechar): são chamadas de IPC, ou
     * seja, promessas. Se o processo principal cair, a rejeição não tem dono — e como estes três não
     * TÊM o que mostrar em caso de falha (a janela não minimizou, a pessoa está vendo), o console é
     * o lugar certo do recado.
     */
    void window.api.windowControls.maximize().catch((causa: unknown) => {
      console.error('Falha ao maximizar a janela:', causa)
    })
  }

  /**
   * Só vira a preferência: quem redimensiona a janela é o efeito de `App.tsx` que observa
   * `compactMode` e chama `windowControls.setCompact`. Chamar o IPC daqui também faria a janela
   * animar duas vezes.
   *
   * O botão mora na barra de título, junto de minimizar/maximizar, porque entrar e sair do modo
   * compacto era coisa de abrir Preferências e caçar uma caixinha — e no modo compacto, onde a
   * janela tem 280×240, o painel de Preferências mal cabe. Ele é a única saída do modo, então
   * aparece SEMPRE, não só quando o modo está ligado.
   */
  function handleToggleCompact() {
    setCompactMode(!compactMode)
  }

  return (
    <div className="titlebar" onDoubleClick={handleMaximize}>
      <div className="titlebar-title">
        <img
          className="titlebar-icon"
          src={appIconImageSmall(appIconId)}
          alt=""
          draggable={false}
        />
        {t.appTitle}
      </div>
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Minimizar"
          onClick={() => void window.api.windowControls.minimize()}
        >
          &#x2013;
        </button>
        <button
          type="button"
          className={`titlebar-btn titlebar-btn-compact ${compactMode ? 'titlebar-btn-on' : ''}`}
          aria-label={compactMode ? t.settings.compactExit : t.settings.compactEnter}
          title={compactMode ? t.settings.compactExit : t.settings.compactEnter}
          aria-pressed={compactMode}
          onClick={handleToggleCompact}
        >
          {/* Duas setas apontando pra dentro (encolher) e pra fora (voltar) — o mesmo par que o
              Windows usa em restaurar/maximizar, sem depender de emoji. */}
          {compactMode ? '⤢' : '⤡'}
        </button>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Maximizar"
          onClick={handleMaximize}
        >
          &#x25A1;
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          aria-label="Fechar"
          onClick={() => void window.api.windowControls.close()}
        >
          &#x2715;
        </button>
      </div>
    </div>
  )
}
