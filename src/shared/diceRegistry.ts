/**
 * Tipos de dado disponíveis na interface — apenas os que existem como dado
 * físico de verdade (e têm imagem em src/renderer/src/assets/dice/).
 * Adicionar um novo tipo de dado é só incluir o número aqui (e
 * opcionalmente uma cor abaixo) — nenhum outro lugar do código depende de
 * uma lista fixa de lados.
 */
export const DEFAULT_DICE_SIDES: readonly number[] = [4, 6, 8, 10, 12, 20, 100]

/**
 * Limite de dados simultâneos numa rolagem física. Vive aqui, em `shared`, porque tanto o main
 * (validação de presets) quanto o renderer (editor, física 3D) precisam do mesmo número: sem isso, um
 * preset com mais dados que o limite passa pela validação e só é truncado em silêncio na hora de
 * rolar, com o rótulo batendo com a contagem original e não com o que foi rolado.
 *
 * O número foi MEDIDO três vezes, e a história importa porque é o argumento contra mexer nele no
 * chute:
 *
 * - 24 → 10. Com o arremesso de fora e de cima, quantidades grandes convergindo ao mesmo tempo tinham
 *   chance real de um dado ficar preso do lado de fora depois de esbarrar noutro na entrada; faltava o
 *   teto de tempo fantasma sem colidir com a parede (`ENTRY_FORCE_PUSH_TIMEOUT_MS`);
 * - 10 → 15. Com aquele teto no lugar, um sweep de 10 e 15 dados (15 rodadas cada) passou a mostrar
 *   100% de assentamento e zero escapes, contra a degradação que aparecia a partir de 12;
 * - 15 → 20, a pedido dele. Medido nas QUATRO formas de bandeja e em 15/18/20/22 dados, 6 rodadas
 *   cada: 100% de assentamento e zero escapes nas 16 combinações, com a distribuição das faces nesses
 *   1800 dados entre 15,4% e 17,5% (o esperado é 16,7%) — a física não vicia número nem com a bandeja
 *   cheia.
 *
 * PRA MEXER DE NOVO: repita a medição. `trayShapes.test.ts` e `diceEscape.test.ts` rodam no limite
 * atual e falham se ele passar do que a bandeja aguenta, mas eles conferem o limite, não descobrem
 * qual deveria ser.
 */
export const MAX_SIMULTANEOUS_DICE = 20

/**
 * Quantos presets um personagem pode ter, e o tamanho do nome e do ícone de cada um.
 *
 * Vale pros TRÊS caminhos que gravam preset e é cobrado no repositório, que é onde eles se encontram.
 * A revisão de código pegou o teto anterior no lugar errado: só a importação de arquivo era limitada
 * (500 por vez), então o próprio ciclo do app quebrava — exportar um personagem com 600 presets e não
 * conseguir importar o próprio backup.
 *
 * Dois mil é vinte vezes o que uma mesa acumula; o nome tem o mesmo teto do nome de personagem; e o
 * ícone é um emoji, cujas sequências mais longas não passam de uma dúzia de unidades.
 */
export const MAXIMO_DE_PRESETS_POR_PERSONAGEM = 2_000
export const TAMANHO_MAXIMO_DO_NOME_DO_PRESET = 200
export const TAMANHO_MAXIMO_DO_ICONE_DO_PRESET = 32

/**
 * Quantas vezes um MESMO dado pode explodir em cadeia. Vive junto do outro teto porque os dois
 * protegem da mesma coisa por caminhos diferentes: um limita quantos dados entram, o outro quantas
 * vezes cada um volta. Sem este, um d4 — que tem 25% de chance de continuar a cada lançamento — é uma
 * cadeia que termina "quase sempre", e "quase sempre" dentro de um laço é um app travado na vez em que
 * não terminar. Dez: a chance de um d4 chegar lá é uma em um milhão, e o dado vale no máximo 44.
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
