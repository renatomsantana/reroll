/**
 * Foi 1100×720, subiu pra 1300×800 (pra aba "Estilo" caber folgada) e desceu pra 1200×760 a
 * pedido do usuário — "um pouco menor e compacto". O tamanho daqui é um ALVO, não uma garantia:
 * num monitor com menos área útil que isso (notebook 1366×768, ou 1920×1080 com escala 150% =
 * 1280×672 úteis), quem manda é o `workArea` — ver o aperto em `registerWindowHandlers.ts`.
 * Antes desse aperto a janela "cheia" saía MAIOR que a tela nesses monitores, com barra de
 * título e borda pra fora — o "full screen buga dependendo do monitor" reportado por tester.
 */
export const FULL_SIZE = { width: 1200, height: 760, minWidth: 900, minHeight: 600 }
/**
 * Janelinha de canto de monitor. Foi 300×230 (com o construtor de rolagem dentro), depois 260×200
 * (só presets + resultado em texto) e agora 280×240, que é o que o arranjo do rolador do Google
 * pede: um dado de 86px girando num painel, o total grande no canto e a faixa de presets embaixo.
 *
 * O número não é gosto — foi medido numa janela oculta no tamanho real. Abaixo disto o painel do
 * dado começa a espremer a ilustração contra o total. Ver `CompactWidget.css`.
 */
export const COMPACT_SIZE = { width: 280, height: 240, minWidth: 250, minHeight: 210 }

/**
 * Quanto a janelinha compacta CRESCE por barra de recurso (spec §3.4: as barras aparecem no modo
 * compacto também). Os 240px acima foram medidos SEM barra; cada uma é uma linha de 16px mais o vão
 * de 3px entre elas (ver `.barras-compactas` em `BarrasDeRecurso.css`), e a faixa inteira ainda
 * soma o vão de 6px do widget que a separa do painel do dado. Sem crescer, três barras espremeriam
 * o dado pra 30px.
 *
 * A conta: n barras são `16n + 3(n − 1)` de faixa, mais 6 de vão = `19n + 3`. O "+ 3" foi MEDIDO
 * (`scripts/medirBarrasCompactas.mjs`): a primeira versão somava 6 e o painel do dado ficava 3px
 * maior com barra do que sem — o contrário do espremer, mas ainda uma janela que mente o tamanho.
 */
export const ALTURA_DA_BARRA_COMPACTA = 19
export function alturaExtraCompacta(quantidadeDeBarras: number): number {
  if (quantidadeDeBarras <= 0) return 0
  return Math.min(quantidadeDeBarras * ALTURA_DA_BARRA_COMPACTA + 3, TETO_DA_ALTURA_EXTRA_COMPACTA)
}
/** Doze barras (`MAXIMO_DE_RECURSOS`) — acima disso não é janelinha de canto. */
export const TETO_DA_ALTURA_EXTRA_COMPACTA = 12 * ALTURA_DA_BARRA_COMPACTA + 3
/**
 * Mora em `shared` (e não em `main`) porque o SPLASH também precisa deste número: a tela de
 * carregamento trava a própria caixa neste tamanho pra não ser esticada enquanto a janela cresce
 * (ver `SplashScreen.tsx`). Duplicar 360×320 no CSS deixaria os dois livres pra divergir, e o
 * sintoma disso seria justamente uma tira de fundo aparecendo em volta do splash logo na abertura.
 */
export const SPLASH_SIZE = { width: 360, height: 320, minWidth: 360, minHeight: 320 }
