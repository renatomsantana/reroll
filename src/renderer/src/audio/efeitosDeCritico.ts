/**
 * Os SONS de crítico e falha (spec §3.7), sintetizados na hora com Web Audio — sem arquivo.
 *
 * Sem mp3 de propósito: um efeito de meio segundo em onda quadrada é a linguagem sonora da época
 * que o visual do app imita (o Windows 98 e os jogos dele), e não depende de achar um sample com
 * licença que caiba no instalador. A fanfarra do crítico é um arpejo subindo (dó-mi-sol-dó); a
 * falha é um "womp" — uma serra descendo de 220 pra 55 Hz com o filtro fechando.
 *
 * O `AudioContext` nasce no primeiro uso, e não na importação do módulo: criado antes de um gesto
 * da pessoa ele nasce suspenso, e o `resume()` no clique é o que o destrava.
 */
let contexto: AudioContext | null = null

function obterContexto(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  contexto ??= new AudioContext()
  if (contexto.state === 'suspended') void contexto.resume()
  return contexto
}

/** Um bipe de onda quadrada com envelope curto — a nota de chiptune. */
function nota(ctx: AudioContext, frequencia: number, inicio: number, duracao: number, volume: number): void {
  const oscilador = ctx.createOscillator()
  const ganho = ctx.createGain()
  oscilador.type = 'square'
  oscilador.frequency.setValueAtTime(frequencia, inicio)
  ganho.gain.setValueAtTime(0, inicio)
  ganho.gain.linearRampToValueAtTime(volume, inicio + 0.01)
  ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracao)
  oscilador.connect(ganho)
  ganho.connect(ctx.destination)
  oscilador.start(inicio)
  oscilador.stop(inicio + duracao + 0.02)
}

export function tocarCritico(): void {
  const ctx = obterContexto()
  if (!ctx) return
  const agora = ctx.currentTime
  // Dó5, Mi5, Sol5 e Dó6 — o arpejo de "conseguiu" dos jogos de plataforma.
  const arpejo = [523.25, 659.25, 783.99, 1046.5]
  arpejo.forEach((frequencia, i) => nota(ctx, frequencia, agora + i * 0.09, i === arpejo.length - 1 ? 0.35 : 0.1, 0.12))
}

export function tocarFalha(): void {
  const ctx = obterContexto()
  if (!ctx) return
  const agora = ctx.currentTime
  const oscilador = ctx.createOscillator()
  const filtro = ctx.createBiquadFilter()
  const ganho = ctx.createGain()
  oscilador.type = 'sawtooth'
  oscilador.frequency.setValueAtTime(220, agora)
  oscilador.frequency.exponentialRampToValueAtTime(55, agora + 0.5)
  filtro.type = 'lowpass'
  filtro.frequency.setValueAtTime(1200, agora)
  filtro.frequency.exponentialRampToValueAtTime(120, agora + 0.5)
  ganho.gain.setValueAtTime(0.16, agora)
  ganho.gain.exponentialRampToValueAtTime(0.001, agora + 0.55)
  oscilador.connect(filtro)
  filtro.connect(ganho)
  ganho.connect(ctx.destination)
  oscilador.start(agora)
  oscilador.stop(agora + 0.6)
}
