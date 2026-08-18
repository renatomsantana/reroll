/**
 * Tipos de dado disponíveis na interface — apenas os que existem como dado
 * físico de verdade (e têm imagem em src/renderer/src/assets/dice/).
 * Adicionar um novo tipo de dado é só incluir o número aqui (e
 * opcionalmente uma cor abaixo) — nenhum outro lugar do código depende de
 * uma lista fixa de lados.
 */
export const DEFAULT_DICE_SIDES: readonly number[] = [4, 6, 8, 10, 12, 20, 100]

/**
 * Limite de dados simultâneos numa única rolagem física (ver `MAX_SIMULTANEOUS_DICE` em
 * `dice3d/config/physicsConfig.ts`, que reexporta este valor). Vive aqui, em `shared`,
 * porque tanto o main process (validação de presets ao criar/editar/importar) quanto o
 * renderer (editor de presets, física 3D) precisam do mesmo número — sem isso, um preset
 * com mais dados que o limite passa despercebido pela validação e só é truncado
 * silenciosamente na hora de rolar, com o total/rótulo batendo com a contagem original,
 * não com o que de fato foi rolado.
 *
 * Reduzido de 24 pra 10 originalmente: com o arremesso de fora e de CIMA da bandeja (dados
 * nascem bem acima e do lado de fora, como alguém em pé jogando pra dentro — ver
 * `SPAWN_CONFIG.launchHeightRange`), quantidades grandes convergindo ao mesmo tempo tinham
 * uma chance real de um dado ficar preso do lado de fora depois de esbarrar noutro no meio
 * da entrada (ver `ENTRY_FORCE_PUSH_TIMEOUT_MS` em `collisionGroups.ts` — o teto de tempo
 * "fantasma" sem colidir com a parede não existia ainda). Reavaliado depois de corrigir
 * esse teto: `diceEscape.test.ts` e um sweep de contagens (10 e 15, 15 rodadas cada) passaram
 * a mostrar 100% de assentamento e ZERO escapes em ambos, contra a degradação observada
 * antes a partir de 12. Subido de 10 pra 15 com essa validação.
 */
export const MAX_SIMULTANEOUS_DICE = 15

export interface DiceColor {
  bg: string
  text: string
}

export const DICE_COLORS: Record<number, DiceColor> = {
  4: { bg: '#f2f2f2', text: '#1a1a1a' },
  6: { bg: '#e08a2b', text: '#1a1a1a' },
  8: { bg: '#2e8b57', text: '#ffffff' },
  10: { bg: '#7a4fd6', text: '#ffffff' },
  12: { bg: '#c0392b', text: '#ffffff' },
  20: { bg: '#1a1a1a', text: '#ffffff' },
  100: { bg: '#707070', text: '#ffffff' }
}

export const DEFAULT_DICE_COLOR: DiceColor = { bg: '#c0c0c0', text: '#000000' }

export function colorForDice(sides: number): DiceColor {
  return DICE_COLORS[sides] ?? DEFAULT_DICE_COLOR
}
