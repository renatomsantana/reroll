/**
 * O VOLUME GERAL do app, pedido do usuário (05/09/2026): "uma barrinha para medir o som do jogo e a
 * pessoa diminuir ou aumentar".
 *
 * Um número só, de 0 a 100, que vale pra TODOS os sons: a rolagem (`rollSound.ts`), a fanfarra e o
 * "womp" (`efeitosDeCritico.ts`) e a abertura (`SplashScreen.tsx`). Mora aqui, fora do React, porque
 * quem toca som não é componente: o som de rolagem dispara de um `setTimeout` no meio da física, e
 * ler o contexto de lá seria carregar o React pra dentro do áudio. O `SettingsContext` grava o valor
 * aqui toda vez que a preferência muda, e os sons leem na hora de tocar.
 *
 * 100 é o padrão porque é o volume que o app sempre teve: quem nunca mexer não ouve diferença.
 */

export const VOLUME_MINIMO = 0
export const VOLUME_MAXIMO = 100
export const VOLUME_PADRAO = 100

let volume = VOLUME_PADRAO

/** O volume como número inteiro de 0 a 100, ou `null` se o valor não serve (texto, NaN, fora da faixa). */
export function volumeValido(bruto: unknown): number | null {
  if (typeof bruto !== 'number' || !Number.isFinite(bruto)) return null
  if (bruto < VOLUME_MINIMO || bruto > VOLUME_MAXIMO) return null
  return Math.round(bruto)
}

/** Grava o volume geral. Valor que não serve é ignorado, e o que estava fica. */
export function definirVolume(porcento: number): void {
  const valido = volumeValido(porcento)
  if (valido !== null) volume = valido
}

/**
 * O ganho que cada som multiplica no seu: 0 a 1. O `HTMLMediaElement.volume` recusa fora dessa
 * faixa (lança `IndexSizeError`), por isso a régua de entrada é estreita.
 */
export function ganhoDoVolume(): number {
  return volume / VOLUME_MAXIMO
}
