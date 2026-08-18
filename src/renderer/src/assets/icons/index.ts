import { DEFAULT_APP_ICON_ID } from '@shared/appIcons'
import base from './base.png'
import azul from './azul.png'
import preto from './preto.png'
import rosa from './rosa.png'
import roxo from './roxo.png'
import turquesa from './turquesa.png'
import verde from './verde.png'
import baseSmall from './small/base.png'
import azulSmall from './small/azul.png'
import pretoSmall from './small/preto.png'
import rosaSmall from './small/rosa.png'
import roxoSmall from './small/roxo.png'
import turquesaSmall from './small/turquesa.png'
import verdeSmall from './small/verde.png'

/** Miniaturas por id de ícone (ver `shared/appIcons.ts` pra lista de ids válidos/labels). */
export const APP_ICON_IMAGES: Record<string, string> = {
  base,
  azul,
  preto,
  rosa,
  roxo,
  turquesa,
  verde
}

/**
 * Imagem do ícone escolhido, caindo no ÍCONE PRINCIPAL do app quando o id não existe (valor
 * persistido de uma versão anterior, ver `isValidAppIconId`).
 *
 * Existe porque cada tela escrevia seu próprio fallback à mão e eles saíram de sincronia: quando o
 * padrão passou de azul pra vermelho, o splash continuou com `?? APP_ICON_IMAGES.azul` e teria
 * mostrado a cor errada justamente no caso em que o fallback importa. Amarrado a
 * `DEFAULT_APP_ICON_ID`, isso não pode mais acontecer.
 */
export function appIconImage(iconId: string): string {
  return APP_ICON_IMAGES[iconId] ?? APP_ICON_IMAGES[DEFAULT_APP_ICON_ID]
}

/**
 * Mesmos ícones em 36px, pra quem os desenha PEQUENOS: a barra de título (16px) e a aba Rolagem
 * (18px).
 *
 * A arte original tem 512px e reduzi-la em um passo até 15-18px derretia o dado num borrão colorido
 * — foi o "está meio bugado quando clica pra mudar o png dos dados" que o usuário relatou assim que
 * o ícone entrou na aba. Navegador nenhum filtra bem uma redução de 28×; reduzindo antes (com
 * `lanczos`, no arquivo) sobra uma redução de 2× pra ele fazer, que é a faixa em que ele acerta.
 * Custa 2,5KB por ícone.
 */
const APP_ICON_IMAGES_SMALL: Record<string, string> = {
  base: baseSmall,
  azul: azulSmall,
  preto: pretoSmall,
  rosa: rosaSmall,
  roxo: roxoSmall,
  turquesa: turquesaSmall,
  verde: verdeSmall
}

export function appIconImageSmall(iconId: string): string {
  return APP_ICON_IMAGES_SMALL[iconId] ?? APP_ICON_IMAGES_SMALL[DEFAULT_APP_ICON_ID]
}
