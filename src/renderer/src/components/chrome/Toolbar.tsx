import { useTranslation } from '@renderer/i18n/useTranslation'
import { useSettings } from '@renderer/settings/SettingsContext'
import { appIconImageSmall } from '@renderer/assets/icons'
import './Toolbar.css'

export type AppTab = 'roll' | 'style' | 'notes'

interface ToolbarProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  onOpenSettings: () => void
  showTabs: boolean
  /** Marca a engrenagem quando existe versão nova — é lá dentro que se atualiza (ver `UpdateSection`). */
  hasUpdate?: boolean
}

export function Toolbar({
  activeTab,
  onTabChange,
  onOpenSettings,
  showTabs,
  hasUpdate = false
}: ToolbarProps) {
  const t = useTranslation()
  /**
   * O ícone da aba Rolagem é o ÍCONE DO APP escolhido nas Preferências (os d20 coloridos), e não
   * mais o `assets/dice/d20.png` fixo — pedido do usuário: "muda o png para algum dos dados
   * coloridos, para poder mudar quando você mexer nas configurações". Assim a cor escolhida lá
   * aparece também dentro da janela, não só na barra de tarefas.
   */
  const { appIconId } = useSettings()

  return (
    <div className="toolbar">
      {showTabs ? (
        <div className="toolbar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'roll'}
            className={`toolbar-tab ${activeTab === 'roll' ? 'toolbar-tab-active' : ''}`}
            onClick={() => onTabChange('roll')}
          >
            <img
              className="toolbar-tab-icon"
              src={appIconImageSmall(appIconId)}
              alt=""
              draggable={false}
            />
            {t.tabs.roll}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'style'}
            className={`toolbar-tab ${activeTab === 'style' ? 'toolbar-tab-active' : ''}`}
            onClick={() => onTabChange('style')}
          >
            {t.tabs.style}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notes'}
            className={`toolbar-tab ${activeTab === 'notes' ? 'toolbar-tab-active' : ''}`}
            onClick={() => onTabChange('notes')}
          >
            {t.tabs.notes}
          </button>
        </div>
      ) : (
        <div />
      )}

      <button
        type="button"
        className="toolbar-settings-btn"
        onClick={onOpenSettings}
        aria-label={t.settings.title}
      >
        ⚙️
        {hasUpdate && <span className="toolbar-update-dot" aria-hidden="true" />}
      </button>
    </div>
  )
}
