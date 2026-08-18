import type { JSX } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useSettings } from '@renderer/settings/SettingsContext'
import './CameraModeSwitch.css'

/**
 * UM botão só, sobreposto à cena: o olho que trava e solta a câmera nos dados.
 *
 * Começou como três ícones (mesa / mira / olho) e o usuário achou estranho — pediu "apenas o olho,
 * lock nos dados liga, solto desliga". O motor de câmera continua com os três modos
 * (`applyCameraKeys.ts`), mas a tela expõe só o que ele usa de verdade: travado ou solto. Trocar
 * qual modo é o "solto" é uma linha (`LOOSE_MODE` abaixo).
 *
 * Solto = `table` (anda pela mesa, com o passeio preso ao tampo), e não `free`: o livre voa pra
 * fora da mesa e é fácil se perder nele, o que é ruim demais pro estado PADRÃO de um botão que se
 * aperta sem pensar.
 *
 * Desenhado em SVG inline, não emoji nem fonte de ícone: o app é 100% offline e emoji de olho muda
 * de desenho conforme o sistema.
 */

/** Pra qual modo o botão volta quando está desligado. */
const LOOSE_MODE = 'table' as const

const ICON_STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

/** Olho ABERTO: a câmera está de olho nos dados. */
function EyeOpenIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <g {...ICON_STROKE}>
        <path d="M1.8 10S5 4.8 10 4.8 18.2 10 18.2 10 15 15.2 10 15.2 1.8 10 1.8 10Z" />
        <circle cx="10" cy="10" r="2.4" />
      </g>
    </svg>
  )
}

/** Olho FECHADO (cortado): a câmera não está seguindo nada. */
function EyeClosedIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <g {...ICON_STROKE}>
        <path d="M1.8 10S5 4.8 10 4.8 18.2 10 18.2 10 15 15.2 10 15.2 1.8 10 1.8 10Z" />
        <circle cx="10" cy="10" r="2.4" />
        <path d="M3.5 16.5 16.5 3.5" />
      </g>
    </svg>
  )
}

export function CameraModeSwitch(): JSX.Element {
  const t = useTranslation()
  const { cameraMode, setCameraMode } = useSettings()
  const locked = cameraMode === 'dice'

  return (
    <button
      type="button"
      className={`camera-lock${locked ? ' camera-lock--on' : ''}`}
      // Só o ícone não diz o que ele faz, e este controle vive fora de qualquer rótulo de texto —
      // o `title` é o que explica, inclusive qual será o efeito do clique.
      title={locked ? t.styleTab.cameraLockOn : t.styleTab.cameraLockOff}
      aria-label={locked ? t.styleTab.cameraLockOn : t.styleTab.cameraLockOff}
      aria-pressed={locked}
      onClick={() => setCameraMode(locked ? LOOSE_MODE : 'dice')}
    >
      {locked ? <EyeOpenIcon /> : <EyeClosedIcon />}
    </button>
  )
}
