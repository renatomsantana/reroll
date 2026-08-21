/**
 * Estado da checagem de atualização, compartilhado entre o processo main (que fala com o
 * `electron-updater`) e a interface (que mostra a linha nas Preferências).
 *
 * Uma união discriminada em vez de um punhado de booleanos: "procurando" e "baixando" e "pronta"
 * são estados exclusivos, e a alternativa (`isChecking`, `isDownloading`, `hasUpdate`…) permite
 * combinações que não existem.
 */
export type UpdateStatus =
  /** Nada aconteceu ainda nesta sessão (ou o app não está empacotado, onde não há o que atualizar). */
  | { state: 'idle' }
  | { state: 'checking' }
  /** Já está na versão mais recente. */
  | { state: 'upToDate' }
  /** Existe versão nova, e ela NÃO foi baixada — o download só começa se a pessoa pedir e confirmar. */
  | { state: 'available'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  /** Baixada e pronta. Como o download só acontece a pedido, daqui o app reinicia sozinho pra aplicar. */
  | { state: 'ready'; version: string }
  /**
   * O instalador está RODANDO. Existe por causa do "a tela trava quando atualiza": entre o app
   * fechar e a versão nova abrir há alguns segundos em que não há nada na tela, e sem aviso isso é
   * lido como travamento. Este estado é o que põe o aviso na tela ANTES de o app sumir.
   */
  | { state: 'installing'; version: string }
  | { state: 'error'; message: string }
