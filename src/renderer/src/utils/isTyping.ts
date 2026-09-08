/**
 * O foco está num lugar onde a pessoa está ESCREVENDO?
 *
 * Existe por um defeito que ele sentiu como duas coisas separadas: "o espaço está funcionando mesmo
 * quando estamos em outra aba" e "as anotações não estão funcionando, não consigo digitar em nada".
 * Era o mesmo atalho — Espaço e Enter rolam os dados — capturado na JANELA inteira, sem olhar onde o
 * cursor estava: dentro de um campo ele engolia a tecla e rolava os dados no lugar de escrever.
 *
 * `isContentEditable` entra junto porque um dia algum bloco de texto pode deixar de ser `<textarea>`.
 */
export function isTypingTarget(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLInputElement) {
    // Caixa de seleção e botão de rádio não são digitação: espaço neles é o gesto de marcar.
    return element.type !== 'checkbox' && element.type !== 'radio'
  }
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLSelectElement) return true
  // `=== true` porque o jsdom dos testes não implementa `isContentEditable` (fica `undefined`),
  // e a função promete boolean.
  return element instanceof HTMLElement && element.isContentEditable === true
}

/**
 * A tecla NASCEU num campo de texto? Olha o foco de agora E o alvo original do evento.
 *
 * Só o foco não basta, e isso chegou como bug: "apertei enter para finalizar a condição do personagem
 * e acabou rolando". O Enter no campo da condição confirma e FECHA o editor, desmontando o `<input>`, e
 * o React descarrega esse estado ANTES de o evento nativo subir até a `window`, onde mora o atalho de
 * rolar — quando o atalho olha `document.activeElement`, o campo já não existe e o foco voltou pro
 * `body`. O `event.target` não tem esse problema: continua apontando pro campo em que a tecla caiu.
 */
export function teclaVeioDeDigitacao(event: KeyboardEvent): boolean {
  if (isTypingTarget(document.activeElement)) return true
  return event.target instanceof Element && isTypingTarget(event.target)
}
