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

/**
 * Teto de 1.5 em vez de 2. A prévia é um quadrado de uns 240 px: a 2× ela renderiza 480×480 e a
 * 1.5× renderiza 360×360 — 44% menos pixels por quadro, numa diferença que não dá pra ver num
 * objeto girando desse tamanho.
 */
export function previewPixelRatio(): number {
  return Math.min(window.devicePixelRatio, 1.5)
}

/**
 * Laço de animação das prévias. `render` recebe o tempo desde o quadro anterior DESENHADO, e não desde
 * o último `requestAnimationFrame`, então a velocidade de rotação não depende da taxa do monitor nem
 * do limite acima.
 *
 * Com a janela oculta nada é desenhado: `document.hidden` já pausa o rAF na maioria dos casos, mas o
 * Electron mantém o laço rodando em algumas situações. O relógio é reiniciado ao voltar, pra não dar
 * um salto de rotação proporcional ao tempo escondida. Devolve a função que para o laço.
 */
export function startPreviewLoop(render: (deltaSeconds: number) => void, fps = PREVIEW_FPS): () => void {
  let frameId = 0
  let lastDrawnAt = performance.now()
  const frameIntervalMs = 1000 / fps

  function tick() {
    frameId = requestAnimationFrame(tick)

    const now = performance.now()
    if (document.hidden) {
      lastDrawnAt = now
      return
    }
    const elapsed = now - lastDrawnAt
    // O rAF de 60 Hz oscila por alguns décimos de milissegundo. Sem esta folga, 16,5 ms falha
    // contra o alvo de 16,67 e a prévia de 60 FPS cai para 30 alternando quadros.
    if (elapsed < frameIntervalMs - 0.75) return

    lastDrawnAt = now
    render(elapsed / 1000)
  }

  tick()
  return () => cancelAnimationFrame(frameId)
}

/**
 * Descarte do renderer da prévia. O `forceContextLoss()` é o ponto que não é óbvio: `dispose()` sozinho
 * libera os recursos do three, mas o CONTEXTO WebGL só é recolhido quando o navegador resolve coletar o
 * canvas. Estas prévias montam e desmontam a cada troca de seção e de aba, e o Chromium mantém um
 * limite pequeno de contextos vivos — passando dele, ele derruba os mais antigos, o que aparece como
 * engasgo ou canvas preto.
 */
export function disposePreviewRenderer(
  renderer: THREE.WebGLRenderer,
  container: HTMLElement
): void {
  renderer.dispose()
  renderer.forceContextLoss()
  container.removeChild(renderer.domElement)
}
