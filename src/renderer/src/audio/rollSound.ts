import rollSingleUrl from '../assets/sounds/roll-single.mp3'
import rollManyUrl from '../assets/sounds/roll-many.mp3'

let singleAudio: HTMLAudioElement | null = null
let manyAudio: HTMLAudioElement | null = null

function play(audio: HTMLAudioElement): void {
  audio.currentTime = 0
  void audio.play().catch(() => {
    // Autoplay bloqueado ou arquivo ausente: ignora silenciosamente.
  })
}

/**
 * Toca o som de um dado único ou de vários dados, dependendo de quantos
 * dados fizeram parte da rolagem (soma de todos os grupos da expressão).
 */
export function playRollSound(diceCount: number): void {
  if (diceCount <= 1) {
    singleAudio ??= new Audio(rollSingleUrl)
    play(singleAudio)
  } else {
    manyAudio ??= new Audio(rollManyUrl)
    play(manyAudio)
  }
}
