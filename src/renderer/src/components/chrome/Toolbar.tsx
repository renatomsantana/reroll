import { useTranslation } from '@renderer/i18n/useTranslation'
import { useSettings } from '@renderer/settings/SettingsContext'
import { appIconImageSmall } from '@renderer/assets/icons'
import { IconeEngrenagem } from '@renderer/components/common/IconeEngrenagem'
import './Toolbar.css'

export type AppTab = 'roll' | 'style' | 'sheet' | 'notes'

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
          {/*
            FICHA e ANOTAÇÕES são abas separadas a pedido do usuário. A ficha vem antes porque é o
            que o personagem É; as anotações são o que aconteceu com ele.

            Ela ficou FORA do alfa (ver o commit "A aba Ficha fica de fora do alfa") porque a
            importação errava em sistema que ela não conhece, e ficha lida errado é o nome e a
            história do personagem de alguém saindo trocados. Volta no 1.1.0 marcada como BETA, que
            é a resposta honesta ao que foi medido nas fichas reais: Ordem Paranormal e Oblívio saem
            certas, e ficha que é ARTE ACHATADA (sem camada de texto, como a de Kids on Bikes) não
            rende nada — nenhum importador resolve isso sem OCR. O rótulo avisa antes, e a tela de
            conferência avisa de novo na hora de confirmar.
          */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sheet'}
            className={`toolbar-tab ${activeTab === 'sheet' ? 'toolbar-tab-active' : ''}`}
            onClick={() => onTabChange('sheet')}
          >
            {t.tabs.sheet}
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
        <IconeEngrenagem />
        {hasUpdate && <span className="toolbar-update-dot" aria-hidden="true" />}
      </button>
    </div>
  )
}
