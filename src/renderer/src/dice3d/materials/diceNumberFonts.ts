import type { DiceNumberFontId } from '@shared/types/diceNumberFont'

/** Fontes para os números gravados nos dados. A primeira aproxima os algarismos arredondados da referência. */
export const DICE_NUMBER_FONT_OPTIONS: { id: DiceNumberFontId; label: string; family: string }[] = [
  { id: 'rounded', label: 'Arredondada', family: "Nunito, 'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif" },
  { id: 'classic', label: 'Clássica', family: "Montserrat, Arial, sans-serif" },
  { id: 'serif', label: 'Serifada', family: "Lora, Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Técnica', family: "'JetBrains Mono', Consolas, 'Courier New', monospace" }
]

export function diceNumberFontCss(font: DiceNumberFontId = 'rounded'): string {
  return DICE_NUMBER_FONT_OPTIONS.find((option) => option.id === font)?.family ?? DICE_NUMBER_FONT_OPTIONS[0].family
}

/** Os números são pintados num canvas uma vez e guardados como textura. Carregar as fontes antes
 * dessa pintura evita gravar a fonte reserva para sempre quando a fonte real ainda está baixando. */
export async function carregarFontesDosDados(): Promise<void> {
  await Promise.allSettled(
    ['Nunito', 'Montserrat', 'Lora', 'JetBrains Mono'].map((family) =>
      document.fonts.load(`700 32px "${family}"`, '0123456789')
    )
  )
}
