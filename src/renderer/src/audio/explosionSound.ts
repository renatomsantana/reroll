import explosionUrl from '../assets/sounds/explosao-pixel.mp3'
import { ganhoDoVolume } from './volume'

const EXPLOSION_DURATION_MS = 1700

let explosionAudio: HTMLAudioElement | null = null
let stopTimer: number | null = null

/**
 * Toca o boom no próprio quadro do primeiro impacto e o corta depois de 1,7 segundo. O GIF some
 * antes, em 0,7 segundo; separar os dois tempos deixa o impacto visual curto e a cauda grave soar.
 * Reiniciar antes disso também para o toque anterior, então nunca há dois booms somados.
 */
export function playExplosionSound(): void {
  explosionAudio ??= new Audio(explosionUrl)
  explosionAudio.volume = ganhoDoVolume()
  explosionAudio.currentTime = 0
  void explosionAudio.play().catch(() => {
    // Autoplay bloqueado ou arquivo ausente: o efeito visual continua normalmente.
  })

  if (stopTimer !== null) window.clearTimeout(stopTimer)
  stopTimer = window.setTimeout(() => {
    explosionAudio?.pause()
    if (explosionAudio) explosionAudio.currentTime = 0
    stopTimer = null
  }, EXPLOSION_DURATION_MS)
}
