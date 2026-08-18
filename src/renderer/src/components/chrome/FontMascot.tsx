import { FONT_MASCOTS } from '@renderer/assets/mascots'
import './FontMascot.css'

/**
 * Easter egg: as fontes Comic Sans e Papyrus aparecem com a cabecinha do irmão esqueleto
 * correspondente de Undertale — o Sans fala em Comic Sans, o Papyrus em Papyrus. Pedido do usuário,
 * com a instrução de ser "bem pequeno e ínfimo": 24px de altura, sem rótulo, sem dica, e escondido
 * de leitor de tela.
 *
 * Aparece nos DOIS lugares em que o nome da fonte aparece: em cada linha da lista e ao lado da
 * fonte já escolhida (ver `FontSelect.tsx`) — foi por causa da lista que o `<select>` nativo teve
 * de sair, porque `<option>` não desenha imagem.
 */
export function FontMascot({ fontId }: { fontId: string }) {
  const mascot = FONT_MASCOTS[fontId]
  if (!mascot) return null
  // Decorativo de propósito: um easter egg anunciado por leitor de tela deixa de ser easter egg.
  return <img className="font-mascot" src={mascot} alt="" aria-hidden="true" draggable={false} />
}
