import { TRAY_SHAPES } from '@renderer/dice3d/geometry/trayShape'

/**
 * Higiene do que veio do `localStorage`.
 *
 * As preferências são gravadas e lidas como JSON solto, e a leitura era um `as Settings` — uma
 * promessa ao compilador que ninguém verifica em tempo de execução. Funciona enquanto o arquivo
 * tiver sido escrito por ESTA versão do app, e é justamente isso que não se pode supor: quem tem o
 * Reroll instalado há meses tem preferências gravadas por versões em que a lista de opções era
 * outra.
 *
 * O app já fazia essa higiene em dois campos — `appIconId` (o ícone branco foi removido) e `fontId`
 * (a lista caiu de catorze pra nove) — cada um consertado depois de aparecer. Os campos que vieram
 * depois ficaram de fora, e o pior deles é a FORMA DA BANDEJA: um valor desconhecido ali não dá erro
 * nenhum, vira `undefined` no mapa de lados, e daí em diante é NaN. Medido: apótema NaN, rotação
 * NaN, e as posições de nascimento dos dados viram `{x: null, z: null}`. Os dados nascem em lugar
 * nenhum, a página de rolagem morre, e não há botão no app que conserte — a pessoa teria que limpar
 * o `localStorage` por fora.
 *
 * Por isso a régua aqui é: campo de VALOR FECHADO que não bate com a lista volta pro padrão. Cor,
 * texto e booleano continuam passando direto — errar neles é feio, não é fatal.
 */

const VALORES_FECHADOS = {
  theme: ['day', 'night'],
  language: ['pt-BR', 'en-US'],
  diceMaterial: ['matte', 'metallic', 'plastic', 'glass'],
  launchMode: ['tray', 'tower', 'towerDecor'],
  trayShape: [...TRAY_SHAPES],
  cameraMode: ['table', 'dice', 'free']
} as const satisfies Record<string, readonly string[]>

/**
 * Devolve uma cópia SEM os campos de valor fechado que não são reconhecidos.
 *
 * Remove em vez de corrigir de propósito: quem chama sempre mescla isto por cima de um padrão (ou do
 * estado atual), então tirar o campo torto faz o valor bom de baixo aparecer. Corrigir aqui exigiria
 * conhecer o padrão, e este módulo não precisa conhecer.
 */
export function sanearPreferencias<T extends Record<string, unknown>>(bruto: T): Partial<T> {
  const limpo: Record<string, unknown> = { ...bruto }
  for (const [campo, aceitos] of Object.entries(VALORES_FECHADOS)) {
    if (!(campo in limpo)) continue
    const valor = limpo[campo]
    if (typeof valor !== 'string' || !(aceitos as readonly string[]).includes(valor)) {
      delete limpo[campo]
    }
  }
  return limpo as Partial<T>
}
