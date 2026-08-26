import { useEffect, useRef } from 'react'
import { useSettings } from '@renderer/settings/SettingsContext'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { APP_ICON_OPTIONS, APP_ICONS_CREDIT } from '@shared/appIcons'
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
    themeSource,
    fontId,
    soundEnabled,
    compactMode,
    debugMode,
    appIconId,
    resultPopupEnabled,
    copyMarkdown,
    autoCopyRolls,
    setCopyMarkdown,
    setAutoCopyRolls,
    critVisualEnabled,
    critSoundEnabled,
    setCritVisualEnabled,
    setCritSoundEnabled,
    displayMode,
    setDisplayMode,
    toggleTheme,
    setFontId,
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

        {/*
          O seletor de IDIOMA saiu daqui a pedido do usuário ("vamo remover inglês, depois botamo"):
          o app é só em português por enquanto. O dicionário em inglês continua em `translations.ts`,
          testado, pra voltar quando ele mandar; e `loadInitial` força `pt-BR` pra quem já tinha
          escolhido inglês não ficar preso numa língua sem botão pra sair.
        */}
        <label className="settings-panel-field">
          <span>{t.settings.theme}</span>
          {/*
            Três estados num botão só, e não uma lista suspensa: o ciclo é Dia → Noite → Sistema, e
            o rótulo diz em qual está. Em "Sistema" ele mostra também o que está valendo agora
            ("Sistema (noite)"), senão a pessoa clica e nada muda na tela — porque o Windows já
            estava claro — e o botão parece quebrado.
          */}
          <Button variant="secondary" onClick={toggleTheme}>
            {themeSource === 'system'
              ? t.settings.themeSystem.replace(
                  '{mode}',
                  theme === 'day' ? t.settings.day : t.settings.night
                )
              : themeSource === 'day'
                ? t.settings.day
                : t.settings.night}
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

        {/*
          COMO O RESULTADO APARECE — a bandeja 3D ou o número na hora (ver `DisplayMode`).
          Fica logo acima do balão de total porque as duas linhas falam da mesma coisa: o que se vê
          quando a rolagem termina.
        */}
        {/*
          Em COLUNA (seletor embaixo do rótulo), e não em linha: o rótulo desta tem uma dica de duas
          frases, e ao lado de um seletor de 130px ela quebrava em quatro linhas — seis com uma
          fonte larga, que foi o "fontes bugaram quando trocando" do usuário. Uma linha inteira pra
          dica e o seletor embaixo cabe em qualquer fonte.
        */}
        <label className="settings-panel-field settings-panel-field-column">
          <span>
            {t.settings.displayMode}
            <br />
            <small className="settings-panel-hint">{t.settings.displayModeHint}</small>
          </span>
          <select
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as typeof displayMode)}
          >
            <option value="3d">{t.settings.displayMode3d}</option>
            <option value="quick">{t.settings.displayModeQuick}</option>
          </select>
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

        {/* A linha copiada pro chat (spec §3.5) — negrito Markdown e o copiar automático. */}
        <label className="settings-panel-field settings-panel-field-row">
          <span>
            {t.settings.copyMarkdown}
            <br />
            <small className="settings-panel-hint">{t.settings.copyMarkdownHint}</small>
          </span>
          <label className="settings-panel-checkbox">
            <input type="checkbox" checked={copyMarkdown} onChange={(e) => setCopyMarkdown(e.target.checked)} />
          </label>
        </label>

        <label className="settings-panel-field settings-panel-field-row">
          <span>
            {t.settings.autoCopy}
            <br />
            <small className="settings-panel-hint">{t.settings.autoCopyHint}</small>
          </span>
          <label className="settings-panel-checkbox">
            <input type="checkbox" checked={autoCopyRolls} onChange={(e) => setAutoCopyRolls(e.target.checked)} />
          </label>
        </label>

        {/* Crítico e falha (spec §3.7): o clarão e o som, separados — a regra de QUAL dado é por personagem, na Ficha. */}
        <label className="settings-panel-field settings-panel-field-row">
          <span>
            {t.settings.critVisual}
            <br />
            <small className="settings-panel-hint">{t.settings.critVisualHint}</small>
          </span>
          <label className="settings-panel-checkbox">
            <input type="checkbox" checked={critVisualEnabled} onChange={(e) => setCritVisualEnabled(e.target.checked)} />
          </label>
        </label>

        <label className="settings-panel-field settings-panel-field-row">
          <span>
            {t.settings.critSound}
            <br />
            <small className="settings-panel-hint">{t.settings.critSoundHint}</small>
          </span>
          <label className="settings-panel-checkbox">
            <input type="checkbox" checked={critSoundEnabled} onChange={(e) => setCritSoundEnabled(e.target.checked)} />
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
          <span>
            {t.settings.appIcon}
            {/* Mesmo desenho do crédito das fontes: pequeno, apagado e em itálico — é atribuição, não opção. */}
            <span className="settings-panel-credit">{APP_ICONS_CREDIT}</span>
          </span>
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
