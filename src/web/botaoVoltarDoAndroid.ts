/**
 * O BOTÃO VOLTAR do Android, que no Reroll tem que fazer o que o Esc faz.
 *
 * O padrão do Capacitor é: voltar SAI DO APP quando não há histórico de navegação pra desfazer. E
 * este app é uma tela só — não há histórico nenhum —, então o padrão fecharia o Reroll no meio de um
 * combate porque a pessoa quis fechar o histórico de rolagens. É o gesto mais usado do aparelho
 * ligado à ação mais destrutiva da tela.
 *
 * O que ele faz aqui:
 *
 * 1. tem modal aberto? fecha o de cima. TODO modal do app já fecha no Esc e todos usam a mesma
 *    `.modal-overlay` (`SettingsPanel`, `HistoryModal`, os editores de preset, recurso e descanso, o
 *    recorte de foto, o `Dialogo`), então o Esc SINTÉTICO fecha o mesmo que o teclado fecharia — sem
 *    uma segunda lista de modais aqui pra alguém esquecer de atualizar ao criar o próximo;
 * 2. nada aberto: sai do app, que é o que o Android espera na tela inicial de um app.
 *
 * As anotações e a ficha se gravam sozinhas a cada mudança (ver `useNotes`), então sair não perde
 * texto. O que se perde é o histórico de rolagens da sessão, e é por isso que o passo 1 existe.
 */
import { App } from '@capacitor/app'

/** O Esc que o teclado mandaria. `bubbles` porque os modais escutam na `window`, não no elemento. */
function mandarEsc(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

export function ligarBotaoVoltar(): void {
  void App.addListener('backButton', () => {
    if (document.querySelector('.modal-overlay')) {
      mandarEsc()
      return
    }
    void App.exitApp()
  })
}
