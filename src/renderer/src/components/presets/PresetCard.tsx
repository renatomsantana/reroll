import type { Preset } from '@shared/types/preset'
import { expressionLabel } from '@renderer/domain/dice/diceEngine'
import { useTranslation } from '@renderer/i18n/useTranslation'
import './PresetCard.css'
import { IconeReroll } from '../common/IconeReroll'
import { IconeLapis } from '../common/IconeLapis'

interface PresetCardProps {
  preset: Preset
  onRoll: (preset: Preset) => void
  onEdit: (preset: Preset) => void
  onDelete: (preset: Preset) => void
  /**
   * A ESTRELA (spec §3.9). `onToggleFavorite` marca/desmarca; `favoriteBlocked` é o teto atingido
   * (a estrela some do que não é favorito, com o motivo no `title`); `onMoveFavorite` só existe
   * pra favorito, e `isFirstFavorite`/`isLastFavorite` travam a seta da ponta.
   */
  onToggleFavorite?: (preset: Preset) => void
  favoriteBlocked?: boolean
  onMoveFavorite?: (preset: Preset, direcao: -1 | 1) => void
  isFirstFavorite?: boolean
  isLastFavorite?: boolean
  /** Desabilita rolar/editar/excluir enquanto uma rolagem está em andamento — evita abrir o
   * editor de um preset (e cancelar) enquanto a rolagem que ele mesmo disparou ainda anima. */
  disabled?: boolean
  /**
   * Só o botão de ROLAR, separado do `disabled` que trava editar/excluir.
   *
   * Na bandeja, clicar um preset por cima de uma rolagem em andamento passou a ser permitido
   * (pedido do usuário: "que aconteça a qualquer momento") — sem o remount da cena, arremessar por
   * cima é só arremessar de novo. Editar e excluir continuam travados durante a rolagem: é outro
   * problema, e o travamento deles existe pra fechar um bug real de interface.
   */
  rollDisabled?: boolean
}

export function PresetCard({
  preset,
  onRoll,
  onEdit,
  onDelete,
  onToggleFavorite,
  favoriteBlocked,
  onMoveFavorite,
  isFirstFavorite,
  isLastFavorite,
  disabled,
  rollDisabled
}: PresetCardProps) {
  const t = useTranslation()
  const favorito = preset.favorito !== undefined

  return (
    <div className={`preset-card ${favorito ? 'preset-card-favorito' : ''}`}>
      {/*
        A coluna da ESTRELA (spec §3.9), à esquerda e fora do botão de rolar — senão favoritar
        rolaria. No favorito, as setas ▲▼ ficam embaixo dela: a ordem dos favoritos é a ordem dos
        botões no modo compacto, e é a pessoa que decide qual golpe vem primeiro.
      */}
      {onToggleFavorite && (
        <div className="preset-card-favorito-coluna">
          <button
            type="button"
            className="preset-card-action preset-card-estrela"
            onClick={() => onToggleFavorite(preset)}
            aria-label={favorito ? t.presets.unfavorite : t.presets.favorite}
            aria-pressed={favorito}
            title={!favorito && favoriteBlocked ? t.presets.favoriteLimit : favorito ? t.presets.unfavorite : t.presets.favorite}
            disabled={disabled || (!favorito && favoriteBlocked)}
          >
            {favorito ? '★' : '☆'}
          </button>
          {favorito && onMoveFavorite && (
            <>
              <button
                type="button"
                className="preset-card-action preset-card-seta"
                onClick={() => onMoveFavorite(preset, -1)}
                aria-label={t.presets.moveUp}
                title={t.presets.moveUp}
                disabled={disabled || isFirstFavorite}
              >
                ▲
              </button>
              <button
                type="button"
                className="preset-card-action preset-card-seta"
                onClick={() => onMoveFavorite(preset, 1)}
                aria-label={t.presets.moveDown}
                title={t.presets.moveDown}
                disabled={disabled || isLastFavorite}
              >
                ▼
              </button>
            </>
          )}
        </div>
      )}
      {/*
        Uma LINHA só: emoji à esquerda, nome com a descrição dos dados embaixo dele, e as duas ações
        à direita. Antes o cartão era uma coluna com o emoji, o nome e a expressão empilhados e uma
        barra de "Editar | Excluir" embaixo — quatro andares pra três informações, e a barra sozinha
        custava mais altura que o resto do cartão junto.
      */}
      <button
        className="preset-card-main"
        onClick={() => onRoll(preset)}
        disabled={rollDisabled ?? disabled}
      >
        <span className="preset-card-icon">{preset.icon || <IconeReroll tamanho={17} />}</span>
        <span className="preset-card-text">
          <span className="preset-card-name">{preset.name}</span>
          {/* Preset de fórmula mostra a própria fórmula — ela É a descrição da rolagem. */}
          <span className="preset-card-expression">
            {preset.formula ?? (preset.expression ? expressionLabel(preset.expression) : '')}
          </span>
        </span>
      </button>
      {/*
        Ícones no lugar das palavras "Editar" e "Excluir": são o que sobra pra cortar depois que o
        cartão virou uma linha, e ✏️/✕ dizem a mesma coisa em 18px. O texto traduzido continua no
        `aria-label` (pra leitor de tela) e no `title` (pra quem para o mouse em cima), então nada
        se perde — só deixa de ocupar espaço o tempo todo.
      */}
      <div className="preset-card-actions">
        <button
          type="button"
          className="preset-card-action"
          onClick={() => onEdit(preset)}
          aria-label={t.presets.edit}
          title={t.presets.edit}
          disabled={disabled}
        >
          <IconeLapis />
        </button>
        <button
          type="button"
          className="preset-card-action preset-card-action-delete"
          onClick={() => onDelete(preset)}
          aria-label={t.presets.delete}
          title={t.presets.delete}
          disabled={disabled}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
