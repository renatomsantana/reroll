/** Identificadores estáveis das fontes que podem ser gravadas nas preferências. */
export const DICE_NUMBER_FONT_IDS = ['rounded', 'classic', 'serif', 'mono'] as const

export type DiceNumberFontId = (typeof DICE_NUMBER_FONT_IDS)[number]
