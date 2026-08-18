import { useEffect, useRef, useState } from 'react'
import introUrl from '../../assets/sounds/balatro-theme.mp3'
import { appIconImage } from '../../assets/icons'
import { useSettings } from '@renderer/settings/SettingsContext'
import { useTranslation } from '@renderer/i18n/useTranslation'
import './SplashScreen.css'

const FALLBACK_DURATION_MS = 2400
const MAX_DURATION_MS = 15000

interface SplashScreenProps {
  onFinish: () => void
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const t = useTranslation()
  const { soundEnabled, appIconId } = useSettings()
  const [progress, setProgress] = useState(0)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  // Mesmo ícone escolhido nas Preferências (ver `shared/appIcons.ts`) — era uma imagem própria
  // fixa (`icon-app.png`) antes, sem relação nenhuma com o ícone real do app/janela.
  const logoUrl = appIconImage(appIconId)

  useEffect(() => {
    const start = Date.now()
    let durationMs = FALLBACK_DURATION_MS
    let finished = false
    let progressInterval: ReturnType<typeof setInterval> | undefined
    let safetyTimeout: ReturnType<typeof setTimeout> | undefined

    function finish() {
      if (finished) return
      finished = true
      clearInterval(progressInterval)
      clearTimeout(safetyTimeout)
      setProgress(100)
      setTimeout(() => onFinishRef.current(), 200)
    }

    progressInterval = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.min(100, Math.round((elapsed / durationMs) * 100)))
      if (elapsed >= durationMs) finish()
    }, 40)

    safetyTimeout = setTimeout(finish, MAX_DURATION_MS)

    let audio: HTMLAudioElement | undefined
    if (soundEnabled) {
      audio = new Audio(introUrl)
      audio.volume = 0.6
      audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio!.duration) && audio!.duration > 0) {
          durationMs = audio!.duration * 1000
        }
      })
      audio.addEventListener('ended', finish)
      void audio.play().catch(() => {
        // Autoplay bloqueado: segue com a duração padrão.
      })
    }

    return () => {
      clearInterval(progressInterval)
      clearTimeout(safetyTimeout)
      audio?.pause()
    }
  }, [])

  return (
    <div className="splash-screen">
      <div className="splash-window">
        {/*
          O ícone do app, igual à barra de título da janela cheia (`TitleBar.tsx`). Aqui era um
          emoji 🎲 fixo — um dadinho branco de seis lados, que não é nem a arte do app nem sequer o
          tipo de dado dela (um d20), e que ignorava a cor escolhida nas Preferências. Como o splash
          é a PRIMEIRA coisa que aparece, era o único lugar em que o app se apresentava com um ícone
          que não é o dele.
        */}
        <div className="splash-titlebar">
          <img className="splash-titlebar-icon" src={logoUrl} alt="" draggable={false} />
          {t.appTitle}
        </div>
        <div className="splash-content">
          <div className="splash-logo-frame">
            <img className="splash-logo" src={logoUrl} alt="" draggable={false} />
          </div>
          <div className="splash-wordmark">{t.appTitle}</div>
          <div className="splash-version">v0.1.0-alpha</div>
          <div className="splash-progress-track">
            <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="splash-credit">{t.credit}</div>
        </div>
      </div>
    </div>
  )
}
