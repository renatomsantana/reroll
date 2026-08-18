import { useState } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import './EmojiPicker.css'

/**
 * Agrupados por assunto, na ordem em que se procura um: primeiro com o que se ATACA, depois o que
 * se conjura, depois no que se bate, depois o resto da ficha. A lista anterior tinha 40 e vinha
 * meio embaralhada (arma, bicho, arma de novo); o usuário pediu mais opções, e triplicar uma lista
 * sem ordem só transformaria "poucas opções" em "não acho a que eu quero".
 *
 * Emoji dentro de aspas simples e um por vez de propósito: colar um bloco pronto da internet traz
 * seletores de variação invisíveis que quebram a comparação com o que está salvo no preset.
 */
const EMOJI_OPTIONS = [
  // Armas e combate
  '⚔️', '🗡️', '🛡️', '🏹', '🪓', '🔨', '🔪', '🪃', '🏺', '⛏️',
  '🤺', '👊', '🥊', '🎯', '💣', '🧨', '🪤', '⚙️', '🔱', '🪝',
  // Magia e elementos
  '🔥', '❄️', '⚡', '💥', '✨', '🌟', '⭐', '🪄', '🔮', '🧿',
  '🌪️', '🌈', '☄️', '🌋', '💧', '🌊', '🫧', '🌫️', '🕯️', '🪬',
  // Criaturas e vilões
  '🐉', '🐲', '☠️', '💀', '👹', '👺', '👻', '🧟', '🧛', '👽',
  '🦇', '🐍', '🕷️', '🦂', '🐺', '🦅', '🦉', '🐗', '🦈', '🦑',
  '🐙', '🦎', '🐀', '🦊', '🐻', '🦁', '🐦‍⬛', '🪱', '🦠', '🐌',
  // Personagens e papéis
  '🧙', '🧝', '🧚', '🧜', '🧞', '🦸', '🦹', '🤴', '👸', '🧑‍🌾',
  '🕵️', '🥷', '👤', '🫅', '🧌', '🤖', '👼', '🧑‍🚀', '🐾', '👣',
  // Corpo, vida e estado
  '❤️', '💔', '🩸', '🦴', '🧠', '👁️', '🫀', '🍖', '🧬', '☢️',
  '💤', '🤢', '🥶', '🥵', '😵', '🌡️', '⏳', '🔇', '🕸️', '⛓️',
  // Aventura, tesouro e cenário
  '💎', '👑', '💰', '🪙', '🗝️', '🔒', '📜', '📖', '🗺️', '🧭',
  '🎒', '⛺', '🏰', '🚪', '🪜', '🕳️', '🌲', '🍄', '🌙', '☀️',
  '🧪', '⚗️', '🍺', '🍷', '🥧', '🎵', '🪕', '🔔', '🍀', '🎲'
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const t = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="emoji-picker">
      <button
        type="button"
        className="emoji-picker-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Escolher emoji"
      >
        😀
      </button>
      {open && (
        <div className="emoji-picker-popover">
          <div className="emoji-picker-grid">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-picker-option"
                onClick={() => {
                  onSelect(emoji)
                  setOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="emoji-picker-hint">{t.emojiPicker.hint}</p>
        </div>
      )}
    </div>
  )
}
