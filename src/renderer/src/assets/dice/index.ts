import d4 from './d4.png'
import d6 from './d6.png'
import d8 from './d8.png'
import d10 from './d10.png'
import d12 from './d12.png'
import d20 from './d20.png'
import d100 from './d100.png'

/**
 * Ilustrações estáticas por tipo de dado (não mostram o valor sorteado,
 * são só a "identidade visual" do tipo).
 */
export const DICE_IMAGES: Partial<Record<number, string>> = {
  4: d4,
  6: d6,
  8: d8,
  10: d10,
  12: d12,
  20: d20,
  100: d100
}
