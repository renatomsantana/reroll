import { useEffect, useRef, useState } from 'react'
import introUrl from '../../assets/sounds/balatro-theme.mp3'
import { appIconImage } from '../../assets/icons'
import { SPLASH_SIZE } from '@shared/windowSizes'
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
  const [version, setVersion] = useState('')
  const trackRef = useRef<HTMLDivElement>(null)
  /** Quantos tijolos cabem na barra e qual o passo (tijolo + vão) — medidos do CSS na montagem. */
  const [brickLayout, setBrickLayout] = useState({ count: 0, step: 0 })
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  // Mesmo ícone escolhido nas Preferências (ver `shared/appIcons.ts`) — era uma imagem própria
  // fixa (`icon-app.png`) antes, sem relação nenhuma com o ícone real do app/janela.
  const logoUrl = appIconImage(appIconId)

  // A versão vem do main (`app.getVersion()`, que lê o `package.json` do build). Aqui era o texto
  // fixo "v0.1.0-alpha", escrito na época da 0.1.0 e nunca mais tocado — e o splash é a primeira
  // tela depois de uma atualização se aplicar, ou seja, era justo o lugar que dizia a quem acabou
  // de atualizar que nada tinha mudado. Ler o `package.json` daqui não é opção: o renderer não
  // tem acesso a arquivo.
  useEffect(() => {
    void window.api.update.getVersion().then(setVersion)
  }, [])

  /**
   * Conta quantos tijolos INTEIROS cabem na barra, medindo o elemento de verdade — a janela do
   * splash tem tamanho fixo, mas a largura útil depende do padding e das bordas em degrau, e chutar
   * isso é como o bloco da ponta acabava cortado.
   *
   * `n` tijolos ocupam `n * tijolo + (n - 1) * vão`, porque o vão só existe ENTRE eles: daí o
   * `(útil + vão) / passo`. Esquecer esse detalhe tira um tijolo do fim da barra.
   */
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const styles = getComputedStyle(track)
    const brick = parseFloat(styles.getPropertyValue('--splash-brick-width'))
    const gap = parseFloat(styles.getPropertyValue('--splash-brick-gap'))
    if (!Number.isFinite(brick) || !Number.isFinite(gap)) return
    const step = brick + gap
    const usable = track.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
    setBrickLayout({ count: Math.max(1, Math.floor((usable + gap) / step)), step })
  }, [])

  useEffect(() => {
    const start = Date.now()
    let durationMs = FALLBACK_DURATION_MS
    let finished = false
    /**
     * `let` e não `const`, apesar de cada um receber valor uma vez só: o `finish` logo abaixo os
     * LIMPA, e ele precisa estar definido antes de os temporizadores serem criados (é ele que o
     * `setTimeout` chama). Declarar com `const` no ponto da criação deixaria o `finish` referenciando
     * uma variável que ainda não existe.
     */
    // eslint-disable-next-line prefer-const
    let progressInterval: ReturnType<typeof setInterval> | undefined
    // eslint-disable-next-line prefer-const
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
    // Efeito de MONTAGEM, deliberadamente sem dependências: o splash toca uma vez e acaba. Listar
    // `soundEnabled` faria a abertura reiniciar do zero se a preferência de som mudasse no meio —
    // uma sequência de dois segundos que a pessoa veria começar duas vezes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="splash-screen">
      {/*
        TRAVADA no tamanho da janela do splash, e centralizada.

        Sem isto a caixa era `100% × 100%` e crescia junto com a janela: ao terminar, o app pede o
        redimensionamento pro tamanho cheio (`FULL_SIZE`) e só ESCONDE o splash quando a animação de
        ~280ms acaba — ou seja, durante toda a animação o splash continua na tela sendo esticado de
        360×320 até o tamanho cheio. Era o "fica uma tela esticada" que o usuário reportou: a barra de
        título alongando, o logo e a barra de progresso se afastando.

        Com o teto, a caixa fica do tamanho que foi desenhada e o que cresce é só a área em volta.
        No tamanho de partida ela preenche a janela inteira exatamente, então nada de fundo aparece
        na abertura — que era o pedido original de "só a tela de carregamento, sem moldura".
      */}
      <div
        className="splash-window"
        style={{ maxWidth: SPLASH_SIZE.width, maxHeight: SPLASH_SIZE.height }}
      >
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
          {/* Espaço rígido enquanto o IPC não respondeu: vazio colapsaria a linha e faria a
              barra de progresso e o crédito saltarem pra cima no primeiro quadro. */}
          <div className="splash-version">{version ? `v${version}` : '\u00a0'}</div>
          {/*
            A largura vai em MÚLTIPLOS DE UM TIJOLO, não em porcentagem — pedido do usuário: "faz ser
            cada teco de carregamento, não apenas uma barra... tipo tijolo por tijolo".
            A barra já era desenhada com blocos (um gradiente repetido), mas a largura era contínua, e
            o gradiente é só pintura: ele não sabe onde a barra termina. O bloco da ponta vivia
            cortado no meio, e um bloco pela metade lê como barra deslizando.
            Enquanto a medição não terminou (`count` = 0) a barra fica vazia, em vez de cair na
            porcentagem contínua por um quadro.
          */}
          <div className="splash-progress-track" ref={trackRef}>
            <div
              className="splash-progress-fill"
              style={{
                width: `${Math.floor((progress / 100) * brickLayout.count) * brickLayout.step}px`
              }}
            />
          </div>
          <div className="splash-credit">{t.credit}</div>
        </div>
      </div>
    </div>
  )
}
