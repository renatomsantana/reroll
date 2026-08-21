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
 * O número foi MEDIDO três vezes, e a história importa porque ela é o argumento contra mexer nele
 * no chute:
 *
 * - 24 → 10. Com o arremesso de fora e de CIMA da bandeja (os dados nascem bem acima e do lado de
 *   fora, como alguém em pé jogando pra dentro — ver `SPAWN_CONFIG.launchHeightRange`), quantidades
 *   grandes convergindo ao mesmo tempo tinham chance real de um dado ficar preso do lado de fora
 *   depois de esbarrar noutro no meio da entrada. Faltava o teto de tempo "fantasma" sem colidir
 *   com a parede (`ENTRY_FORCE_PUSH_TIMEOUT_MS` em `collisionGroups.ts`).
 * - 10 → 15. Com aquele teto no lugar, um sweep de 10 e 15 dados (15 rodadas cada) passou a mostrar
 *   100% de assentamento e zero escapes, contra a degradação que aparecia a partir de 12.
 * - 15 → 20, a pedido do usuário. Medido de novo, agora nas QUATRO formas de bandeja (triângulo,
 *   quadrado, hexágono e círculo) e em 15/18/20/22 dados, 6 rodadas cada, reaproveitando os mesmos
 *   corpos entre rodadas: 100% de assentamento e ZERO escapes em todas as 16 combinações. A
 *   distribuição das faces observadas nesses 1800 dados ficou entre 15,4% e 17,5% (o esperado é
 *   16,7%), ou seja, a física não vicia número nenhum nem com a bandeja cheia.
 *
 * PRA MEXER DE NOVO: repita a medição. `trayShapes.test.ts`, `towerShapes.test.ts` e
 * `diceEscape.test.ts` já rodam no limite atual e falham se ele passar do que a bandeja aguenta —
 * mas eles conferem o limite, não descobrem qual deveria ser.
 */
export const MAX_SIMULTANEOUS_DICE = 20

/**
 * Quantas vezes um MESMO dado pode explodir em cadeia (ver `ExplodeRule` em `types/dice.ts`).
 *
 * Vive aqui, junto do outro teto, porque os dois protegem da mesma coisa por caminhos diferentes: um
 * limita quantos dados entram, o outro quantas vezes cada um pode voltar. Sem este, um d4 — que tem
 * 25% de chance de continuar a cada lançamento — é uma cadeia que termina "quase sempre", e "quase
 * sempre" dentro de um laço é um app travado na vez em que não terminar.
 *
 * Dez: a chance de um d4 chegar lá é uma em um milhão, e mesmo assim o dado vale no máximo 44 —
 * grande o bastante pra ser a história da noite, pequeno o bastante pra caber na tela.
 */
export const MAX_EXPLOSOES_POR_DADO = 10

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
