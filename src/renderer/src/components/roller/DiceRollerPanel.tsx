import { useEffect, useState } from 'react'
import type { RollMode } from '@renderer/domain/dice/diceEngine'
import { DEFAULT_DICE_SIDES } from '@shared/diceRegistry'
import {
  modificadorDoTexto,
  textoDeModificadorAceito,
  textoDoModificadorAjustado
} from '@shared/dice/modificador'
import { DICE_IMAGES } from '@renderer/assets/dice'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { Button } from '../common/Button'
import './DiceRollerPanel.css'

export type { RollMode }

interface DiceRollerPanelProps {
  onRoll: (count: number, sides: number, mode: RollMode, modifier: number) => void
}

export function DiceRollerPanel({ onRoll }: DiceRollerPanelProps) {
  const t = useTranslation()
  const [count, setCount] = useState(1)
  const [sides, setSides] = useState(20)
  const [mode, setMode] = useState<RollMode>('normal')
  /** Texto, e não número — ver `shared/dice/modificador.ts`. */
  const [textoDoModificador, setTextoDoModificador] = useState('0')
  const modifier = modificadorDoTexto(textoDoModificador)
  const [spinTick, setSpinTick] = useState(0)

  function handleRoll() {
    setSpinTick((tick) => tick + 1)
    onRoll(count, sides, mode, modifier)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return
      if (e.repeat || document.querySelector('.modal-overlay')) return
      const active = document.activeElement
      if (active instanceof HTMLSelectElement) return
      if (active instanceof HTMLButtonElement && e.code === 'Space') return
      e.preventDefault()
      handleRoll()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Mesmo caso do roller 3D: `handleRoll` nasce de novo a cada render, e o que ele PRECISA
    // enxergar são estes quatro valores — que estão listados. Ver o comentário em `DiceRoller3D`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, sides, mode, modifier])

  return (
    <div className="dice-roller-panel">
      <div className="dice-roller-row">
        <input
          className="dice-roller-count"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
          aria-label={t.roller.quantityLabel}
        />
        <select
          className="dice-roller-sides"
          value={sides}
          onChange={(e) => setSides(Number(e.target.value))}
          aria-label={t.roller.typeLabel}
        >
          {DEFAULT_DICE_SIDES.map((s) => (
            <option key={s} value={s}>
              d{s}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={handleRoll}>
          {t.roller.rollButton}
        </Button>
        {DICE_IMAGES[sides] && (
          <img
            key={spinTick}
            className="dice-roller-preview dice-roller-preview-spin"
            src={DICE_IMAGES[sides]}
            alt={`d${sides}`}
          />
        )}
      </div>

      <div className="dice-roller-row">
        {/* `div` e não `label`: o rótulo roubaria o clique dos botões pro campo de dentro dele. */}
        <div className="dice-roller-modifier">
          <span>{t.roller.modifier}</span>
          {/*
            MENOS e MAIS no lugar das setinhas, e o estado é TEXTO — ver `shared/dice/modificador.ts`.
            No modo compacto a janela é minúscula e as setas do navegador eram praticamente
            inclicáveis; e sem o texto não dava pra digitar modificador negativo em canto nenhum.
          */}
          <div className="dice-roller-modifier-campo">
            <Button
              variant="ghost"
              className="dice-roller-modifier-btn"
              aria-label={t.roller.modifierMinus}
              title={t.roller.modifierMinus}
              onClick={() => setTextoDoModificador((atual) => textoDoModificadorAjustado(atual, -1))}
            >
              −
            </Button>
            <input
              type="text"
              inputMode="numeric"
              value={textoDoModificador}
              onChange={(e) => {
                const bruto = e.target.value.trim()
                if (textoDeModificadorAceito(bruto)) setTextoDoModificador(bruto)
              }}
              onBlur={() => setTextoDoModificador(String(modifier))}
              aria-label={t.roller.modifier}
            />
            <Button
              variant="ghost"
              className="dice-roller-modifier-btn"
              aria-label={t.roller.modifierPlus}
              title={t.roller.modifierPlus}
              onClick={() => setTextoDoModificador((atual) => textoDoModificadorAjustado(atual, 1))}
            >
              +
            </Button>
          </div>
        </div>

        <div className="dice-roller-mode">
          {(['normal', 'advantage', 'disadvantage'] as const).map((m) => (
            <Button
              key={m}
              selected={mode === m}
              onClick={() => setMode(m)}
            >
              {t.roller.mode[m]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
