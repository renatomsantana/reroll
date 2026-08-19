import { useEffect, useRef } from 'react'
import { useSettings, type Language } from '@renderer/settings/SettingsContext'
import { LANGUAGE_OPTIONS, useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { APP_ICON_OPTIONS } from '@shared/appIcons'
import { APP_ICON_IMAGES } from '@renderer/assets/icons'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { FontSelect } from './FontSelect'
import { UpdateSection } from './UpdateSection'
import './SettingsPanel.css'

interface SettingsPanelProps {
  onClose: () => void
  /** Fecha as Preferências e abre o histórico de rolagens (ver `HistoryModal`). */
  onOpenHistory: () => void
}

/**
 * Só preferências GERAIS do app (idioma, tema claro/escuro, fonte, som, modo compacto, debug)
 * — cor/acabamento dos dados e cor da bandeja moraram aqui antes, mas foram pra aba própria
 * "Estilo" (`StyleTab.tsx`), a pedido do usuário: eram muitas opções crescendo num modal
 * pequeno demais pra caber com conforto.
 */
export function SettingsPanel({ onClose, onOpenHistory }: SettingsPanelProps) {
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

  const {
    theme,
    fontId,
    language,
    soundEnabled,
    compactMode,
    debugMode,
    appIconId,
    resultPopupEnabled,
    toggleTheme,
    setFontId,
    setLanguage,
    setSoundEnabled,
    setCompactMode,
    setAppIconId,
    setDebugMode,
    setResultPopupEnabled,
    resetSettings
  } = useSettings()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <Card ref={cardRef} className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="settings-panel-title">{t.settings.title}</h2>

        <label className="settings-panel-field">
          <span>{t.settings.language}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-panel-field">
          <span>{t.settings.theme}</span>
          <Button variant="secondary" onClick={toggleTheme}>
            {theme === 'day' ? t.settings.day : t.settings.night}
          </Button>
        </label>

        {/*
          Seletor próprio, não `<select>`: a lista mostra a caveirinha do easter egg em cada linha
          (ver `FontSelect.tsx`), e `<option>` não desenha imagem. `div` em vez de `label` porque o
          `<label>` roubaria o clique do botão pro primeiro campo de dentro dele.
        */}
        <div className="settings-panel-field">
          <span>{t.settings.font}</span>
          {/* Sem `defaultLabel`: aqui é ONDE a fonte do app é escolhida, então "usar a do app" não existe. */}
          <FontSelect value={fontId} onChange={(value) => value && setFontId(value)} />
        </div>

        <label className="settings-panel-field settings-panel-field-row">
          <span>{t.settings.sound}</span>
          <label className="settings-panel-checkbox">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            {soundEnabled ? t.settings.soundOn : t.settings.soundOff}
          </label>
        </label>

        <label className="settings-panel-field settings-panel-field-row">
          <span>
            {t.settings.compactMode}
            <br />
            <small className="settings-panel-hint">{t.settings.compactModeHint}</small>
          </span>
          <label className="settings-panel-checkbox">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => setCompactMode(e.target.checked)}
            />
          </label>
        </label>

        <label className="settings-panel-field settings-panel-field-row">
          <span>
            {t.settings.resultPopup}
            <br />
            <small className="settings-panel-hint">{t.settings.resultPopupHint}</small>
          </span>
          <label className="settings-panel-checkbox">
            <input
              type="checkbox"
              checked={resultPopupEnabled}
              onChange={(e) => setResultPopupEnabled(e.target.checked)}
            />
          </label>
        </label>

        {/*
          O histórico saiu da coluna fixa da janela e passou a morar aqui atrás de um botão —
          pedido do usuário. Fica LOGO ANTES do ícone do app de propósito: é a única linha do painel
          que ABRE outra coisa em vez de mudar uma preferência, então separá-la das ações de baixo
          (restaurar/fechar) evita que pareça mais um botão de rodapé.
        */}
        <div className="settings-panel-field">
          <span>
            {t.settings.history}
            <br />
            <small className="settings-panel-hint">{t.settings.historyHint}</small>
          </span>
          <Button variant="secondary" onClick={onOpenHistory}>
            {t.settings.historyOpen}
          </Button>
        </div>

        <div className="settings-panel-field settings-panel-field-column">
          <span>{t.settings.appIcon}</span>
          <div className="settings-panel-icon-grid">
            {APP_ICON_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`settings-panel-icon-swatch${appIconId === option.id ? ' settings-panel-icon-swatch-active' : ''}`}
                style={{ backgroundImage: `url(${APP_ICON_IMAGES[option.id]})` }}
                title={option.label}
                aria-label={option.label}
                onClick={() => setAppIconId(option.id)}
              />
            ))}
          </div>
        </div>

        <UpdateSection />

        {/* Só em `npm run dev` (`import.meta.env.DEV`), nunca no app empacotado que os amigos do
            usuário recebem — modo debug é ferramenta de desenvolvimento, não uma preferência
            pra quem só joga. */}
        {import.meta.env.DEV && (
          <label className="settings-panel-field settings-panel-field-row">
            <span>
              {t.settings.debugMode}
              <br />
              <small className="settings-panel-hint">{t.settings.debugModeHint}</small>
            </span>
            <label className="settings-panel-checkbox">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
            </label>
          </label>
        )}

        <div className="settings-panel-actions">
          <Button variant="secondary" onClick={resetSettings}>
            {t.settings.reset}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t.settings.close}
          </Button>
        </div>
      </Card>
    </div>
  )
}
