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
  // `=== true` porque o jsdom dos testes não implementa `isContentEditable` (fica `undefined`),
  // e a função promete boolean.
  return element instanceof HTMLElement && element.isContentEditable === true
}

/**
 * A tecla NASCEU num campo de texto? Olha o foco de agora E o alvo original do evento.
 *
 * Só o foco não basta, e isso chegou como bug: "apertei enter para finalizar a condição do
 * personagem e acabou rolando". O Enter no campo da condição (HUD) confirma e FECHA o editor —
 * `setNovaCondicao(null)` desmonta o `<input>` — e o React descarrega esse estado na raiz ANTES
 * de o evento nativo continuar subindo até a `window`, onde mora o atalho de rolar. Quando o
 * atalho olha `document.activeElement`, o campo já não existe e o foco voltou pro `body`: a
 * guarda de digitação não vê nada e a rolagem dispara. O mesmo vale pro Enter que confirma o
 * valor de uma barra (`BarrasDeRecurso`).
 *
 * O `event.target` não tem esse problema: ele fica apontando pro campo em que a tecla caiu,
 * mesmo que o campo já tenha saído do DOM.
 */
export function teclaVeioDeDigitacao(event: KeyboardEvent): boolean {
  if (isTypingTarget(document.activeElement)) return true
  return event.target instanceof Element && isTypingTarget(event.target)
}
