import { DEFAULT_APP_ICON_ID } from '@shared/appIcons'
import { appIconImageSmall } from '@renderer/assets/icons'
import './IconeReroll.css'

/**
 * O d20 VERMELHO do Reroll no lugar de emoji.
 *
 * Pedido do usuário ("vamos mudar todas as imagens de emoji para o png vermelho do Reroll"): os
 * emojis — 🎲 nos presets e nos botões de rolar da ficha, 💥 no Explode e no histórico, 🎨📜📝 nas
 * abas — eram bitmaps do Segoe UI Emoji, cada um de uma cor e nenhum com a cara do app; e bitmap de
 * emoji já sumiu uma vez no modo dia (a engrenagem, ver `IconeEngrenagem.tsx`).
 *
 * É sempre o ícone PADRÃO (o vermelho), e não o que a pessoa escolheu pra janela nas Preferências:
 * o ícone da janela é identidade da instalação; este é a marca de "aqui rola dado", igual em todo
 * lugar do app.
 */
interface IconeRerollProps {
  /** Lado do quadrado, em px. 18 é o das abas; 14 o dos botões de rolar; 12 a marca do histórico. */
  tamanho?: number
  className?: string
}

export function IconeReroll({ tamanho = 18, className = '' }: IconeRerollProps) {
  return (
    <img
      className={`icone-reroll ${className}`.trim()}
      src={appIconImageSmall(DEFAULT_APP_ICON_ID)}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={tamanho}
      height={tamanho}
    />
  )
}
