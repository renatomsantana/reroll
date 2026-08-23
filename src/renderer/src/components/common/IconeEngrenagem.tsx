/**
 * A engrenagem das Preferências, DESENHADA em vez de emoji.
 *
 * O ⚙️ que estava aqui é um bitmap colorido do Segoe UI Emoji, e a cor dele é prata claro: medido
 * contra o cinza `--win-face` (#c0c0c0) do modo dia, a cor média do glifo dava rgb(194, 185, 208) —
 * **contraste 1.02**, onde 1.0 é literalmente invisível. Era o que o usuário relatou: "no modo dia
 * ninguém enxerga". Emoji colorido não aceita `color`, então não havia como escurecê-lo: ou se troca
 * o desenho, ou se aceita um botão que some.
 *
 * Desenhado em `currentColor`, ele herda `--win-text` e resolve os dois temas de uma vez: preto
 * sobre o cinza do dia, claro sobre o grafite da noite. É também mais fiel ao Windows 98, que não
 * tinha emoji em lugar nenhum — os ícones eram desenhos chapados de uma cor só.
 *
 * A FORMA sai de quatro medidas, não de um `path` mágico copiado de algum lugar: número de dentes,
 * raio da ponta do dente, raio da raiz (o corpo entre os dentes) e raio do furo. Mudar o tamanho do
 * furo é mexer num número, e não redesenhar cinquenta coordenadas na mão.
 */

/** Oito dentes: o suficiente pra ler como engrenagem a 15px, e poucos o bastante pra não virar serra. */
const DENTES = 8
/** Tudo num quadrado de 16, com o centro em (8, 8) — a mesma grade de um ícone de 16px do 98. */
const CENTRO = 8
const RAIO_PONTA = 7.6
const RAIO_RAIZ = 5.6
/**
 * O furo é VAZADO (o `fill-rule="evenodd"` faz o buraco), e não pintado da cor do fundo: pintado, ele
 * ficaria cinza-claro em cima do botão escuro do modo noite — o mesmo tipo de defeito que este
 * arquivo existe pra consertar.
 */
const RAIO_FURO = 2.5

/** Metade da largura angular do dente, e a folga entre o dente e o vale, ambas em fração do passo. */
const LARGURA_DO_DENTE = 0.19
const FOLGA = 0.08

function pontoDaEngrenagem(angulo: number, raio: number): string {
  const x = CENTRO + Math.cos(angulo) * raio
  const y = CENTRO + Math.sin(angulo) * raio
  return `${x.toFixed(2)} ${y.toFixed(2)}`
}

/**
 * O contorno: pra cada dente, sobe pra ponta, atravessa a ponta, desce pra raiz e caminha pelo vale
 * até o próximo. Quatro cantos por dente é o que dá o degrau seco do ícone antigo — curva de Bézier
 * aqui deixaria a engrenagem redondinha, que é vocabulário de outra época.
 */
function contornoDaEngrenagem(): string {
  const passo = (Math.PI * 2) / DENTES
  const meiaLargura = passo * LARGURA_DO_DENTE
  const folga = passo * FOLGA
  const cantos: string[] = []

  for (let dente = 0; dente < DENTES; dente++) {
    const centroDoDente = dente * passo
    cantos.push(pontoDaEngrenagem(centroDoDente - meiaLargura, RAIO_PONTA))
    cantos.push(pontoDaEngrenagem(centroDoDente + meiaLargura, RAIO_PONTA))
    cantos.push(pontoDaEngrenagem(centroDoDente + meiaLargura + folga, RAIO_RAIZ))
    cantos.push(pontoDaEngrenagem(centroDoDente + passo - meiaLargura - folga, RAIO_RAIZ))
  }

  return `M ${cantos.join(' L ')} Z`
}

/** O furo, como subcaminho próprio — dois arcos de meia volta fecham o círculo. */
function furoDaEngrenagem(): string {
  const esquerda = CENTRO - RAIO_FURO
  const direita = CENTRO + RAIO_FURO
  return (
    `M ${esquerda} ${CENTRO} ` +
    `A ${RAIO_FURO} ${RAIO_FURO} 0 1 0 ${direita} ${CENTRO} ` +
    `A ${RAIO_FURO} ${RAIO_FURO} 0 1 0 ${esquerda} ${CENTRO} Z`
  )
}

const CAMINHO = `${contornoDaEngrenagem()} ${furoDaEngrenagem()}`

export function IconeEngrenagem({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={CAMINHO} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}
