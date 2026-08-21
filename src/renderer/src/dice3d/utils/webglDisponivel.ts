/**
 * A MÁQUINA CONSEGUE DESENHAR A BANDEJA 3D?
 *
 * A spec pede degradação graciosa (5.8): "se OCR ou renderização 3D não estiverem disponíveis numa
 * máquina, caia num modo alternativo em vez de quebrar". Até aqui o app não tinha alternativa
 * NENHUMA — sem WebGL utilizável, a cena falhava na inicialização, o roller mostrava "não foi
 * possível rolar" e não havia como rolar um dado no programa de rolar dados.
 *
 * Isso não é hipótese distante pro público deste app ("vou mandar para muitos amigos e pessoas que
 * não manjam muito de pc"): notebook velho com driver de vídeo que o Windows nunca atualizou,
 * máquina virtual, área de trabalho remota. Nesses lugares o Chromium desliga a aceleração e o
 * `WebGLRenderingContext` simplesmente não vem.
 *
 * O teste é feito UMA VEZ e o contexto é descartado na hora: cada contexto WebGL custa memória de
 * vídeo, e o Chromium tem um teto pequeno de contextos simultâneos — deixar um pendurado aqui
 * roubaria da cena de verdade.
 */

let resposta: boolean | null = null

export function webglDisponivel(): boolean {
  if (resposta !== null) return resposta

  try {
    const teste = document.createElement('canvas')
    /**
     * `webgl2` primeiro e `webgl` depois: o three.js aceita os dois, e há máquinas em que o 2 não
     * vem e o 1 vem. Recusar por causa do 2 seria mandar pro modo rápido gente que consegue ver a
     * bandeja.
     */
    const contexto = teste.getContext('webgl2') ?? teste.getContext('webgl')
    resposta = contexto !== null

    /**
     * Devolve o contexto NA HORA. `WEBGL_lose_context` é a única forma de liberar de verdade — sem
     * ela o contexto fica vivo até o coletor de lixo passar, e até lá é um dos poucos slots que o
     * navegador dá.
     */
    if (contexto) {
      const perder = contexto.getExtension('WEBGL_lose_context')
      perder?.loseContext()
    }
  } catch {
    // `document` ausente (teste em Node), canvas bloqueado por política, driver estourando na
    // criação: qualquer um deles significa a mesma coisa pra quem pergunta.
    resposta = false
  }

  return resposta
}

/** Só pros testes: esquece a resposta guardada. */
export function esquecerRespostaDeWebgl(): void {
  resposta = null
}
