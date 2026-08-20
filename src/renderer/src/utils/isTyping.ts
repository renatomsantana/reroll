/**
 * O foco está num lugar onde a pessoa está ESCREVENDO?
 *
 * Existe por um defeito que o usuário sentiu como duas coisas separadas: "o espaço está funcionando
 * mesmo quando estamos em outra aba" e "as anotações não estão funcionando, não consigo digitar em
 * nada". Era o mesmo atalho — Espaço/Enter rolam os dados — capturado na JANELA inteira, sem olhar
 * onde o cursor estava. Dentro de um campo de texto ele engolia a tecla (`preventDefault`) e rolava
 * os dados no lugar de escrever, o que faz a digitação parecer quebrada.
 *
 * `isContentEditable` entra junto: um dia algum bloco de texto pode deixar de ser `<textarea>`, e
 * essa checagem continua valendo sem ninguém lembrar de voltar aqui.
 */
export function isTypingTarget(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLInputElement) {
    // Caixa de seleção e botão de rádio não são digitação: espaço neles é o gesto de marcar.
    return element.type !== 'checkbox' && element.type !== 'radio'
  }
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLSelectElement) return true
  return element instanceof HTMLElement && element.isContentEditable
}
