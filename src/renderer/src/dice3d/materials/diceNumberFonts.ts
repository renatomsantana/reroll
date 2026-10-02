import type { DiceNumberFontId } from '@shared/types/diceNumberFont'

/** Fontes para os números gravados nos dados. A primeira aproxima os algarismos arredondados da referência. */
export const DICE_NUMBER_FONT_OPTIONS: { id: DiceNumberFontId; label: string; family: string }[] = [
  { id: 'rounded', label: 'Arredondada', family: "Nunito, 'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif" },
  { id: 'classic', label: 'Clássica', family: 'Arial, Helvetica, sans-serif' },
  { id: 'serif', label: 'Serifada', family: "Lora, Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Técnica', family: "'JetBrains Mono', Consolas, 'Courier New', monospace" },
  { id: 'rune', label: 'Rúnica', family: "Papyrus, 'Segoe Print', fantasy" }
]

export function diceNumberFontCss(font: DiceNumberFontId = 'rounded'): string {
  return DICE_NUMBER_FONT_OPTIONS.find((option) => option.id === font)?.family ?? DICE_NUMBER_FONT_OPTIONS[0].family
}
