/**
 * Aumentado de 1100×720 pra 1300×800 (mínimo de 820×560 pra 900×600 junto) a pedido do
 * usuário — a aba "Estilo" (`StyleTab.tsx`) tem bastante opção agora (cor do corpo/número,
 * acabamento, presets metálicos, cor de parede/fundo) e a ideia é caber tudo confortável sem
 * precisar redimensionar a janela na primeira vez que abre.
 */
export const FULL_SIZE = { width: 1300, height: 800, minWidth: 900, minHeight: 600 }
/**
 * Janelinha de canto de monitor. Foi 300×230 (com o construtor de rolagem dentro), depois 260×200
 * (só presets + resultado em texto) e agora 280×240, que é o que o arranjo do rolador do Google
 * pede: um dado de 86px girando num painel, o total grande no canto e a faixa de presets embaixo.
 *
 * O número não é gosto — foi medido numa janela oculta no tamanho real. Abaixo disto o painel do
 * dado começa a espremer a ilustração contra o total. Ver `CompactWidget.css`.
 */
export const COMPACT_SIZE = { width: 280, height: 240, minWidth: 250, minHeight: 210 }
export const SPLASH_SIZE = { width: 360, height: 320, minWidth: 360, minHeight: 320 }
