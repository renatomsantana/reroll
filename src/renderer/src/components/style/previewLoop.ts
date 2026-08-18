import type * as THREE from 'three'

/**
 * Peças compartilhadas pelas duas prévias da aba Estilo (`StylePreview` = o dado, `TrayPreview` =
 * a bandeja com o estojo). As duas são a mesma coisa por dentro — uma cena WebGL minúscula girando
 * um objeto devagar — e antes cada uma trazia sua própria cópia do laço de animação e do descarte.
 */

/**
 * As prévias giram devagar de propósito: a 30 quadros por segundo o movimento continua contínuo
 * aos olhos e o trabalho por segundo cai pela metade num monitor de 60 Hz (e pra um quarto num de
 * 120 Hz, que é onde a aba ficava mais pesada sem nenhum ganho visível). O laço antigo desenhava
 * em TODO `requestAnimationFrame`, na taxa do monitor, o tempo inteiro em que a aba estava aberta.
 */
const PREVIEW_FPS = 30
const FRAME_INTERVAL_MS = 1000 / PREVIEW_FPS

/**
 * Teto de 1.5 em vez de 2. A prévia é um quadrado de uns 240 px: a 2× ela renderiza 480×480 e a
 * 1.5× renderiza 360×360 — 44% menos pixels por quadro, numa diferença que não dá pra ver num
 * objeto girando desse tamanho.
 */
export function previewPixelRatio(): number {
  return Math.min(window.devicePixelRatio, 1.5)
}

/**
 * Laço de animação das prévias. `render` recebe o tempo decorrido em segundos desde o quadro
 * anterior DESENHADO (não desde o último `requestAnimationFrame`), então a velocidade de rotação
 * não depende da taxa do monitor nem do limite acima.
 *
 * Quando a janela está oculta (minimizada, ou outra janela por cima em tela cheia) nada é
 * desenhado: `document.hidden` já pausa o `requestAnimationFrame` na maioria dos casos, mas o
 * Electron mantém o laço rodando em algumas situações, e desenhar uma prévia que ninguém está
 * vendo é trabalho jogado fora. O relógio é reiniciado ao voltar pra não dar um salto de rotação
 * proporcional ao tempo em que ficou escondida.
 *
 * Retorna a função que para o laço — chamar no cleanup do efeito.
 */
export function startPreviewLoop(render: (deltaSeconds: number) => void): () => void {
  let frameId = 0
  let lastDrawnAt = performance.now()

  function tick() {
    frameId = requestAnimationFrame(tick)

    const now = performance.now()
    if (document.hidden) {
      lastDrawnAt = now
      return
    }
    const elapsed = now - lastDrawnAt
    if (elapsed < FRAME_INTERVAL_MS) return

    lastDrawnAt = now
    render(elapsed / 1000)
  }

  tick()
  return () => cancelAnimationFrame(frameId)
}

/**
 * Descarte do renderer da prévia. O `forceContextLoss()` é o ponto que não é óbvio: `dispose()`
 * sozinho libera os recursos do three, mas o CONTEXTO WebGL em si só é recolhido quando o
 * navegador resolve coletar o canvas. Estas prévias montam e desmontam a cada troca de seção
 * ("Dados" ↔ "Mesa e bandeja") e de aba, e o Chromium mantém um limite pequeno de contextos vivos
 * — passando dele, ele derruba os mais antigos, o que aparece como engasgo ou canvas preto. Pedir
 * a perda na hora mantém a conta sempre em zero fora da aba Estilo.
 */
export function disposePreviewRenderer(
  renderer: THREE.WebGLRenderer,
  container: HTMLElement
): void {
  renderer.dispose()
  renderer.forceContextLoss()
  container.removeChild(renderer.domElement)
}
