import { TRAY_SHAPE_SIDES, trayRotation, type TrayShape } from '@renderer/dice3d/geometry/trayShape'

/** Lado do quadro do ícone, em px. Casa com a altura de linha do botão em que ele mora. */
const LADO = 22
/** Raio até os VÉRTICES, com uma folga de 1px de cada lado pro traço não encostar na borda. */
const RAIO = LADO / 2 - 1
/** Acima disto a quina some no tamanho do ícone e o desenho honesto é um círculo (ver `TRAY_SHAPES`). */
const LADOS_ATE_VIRAR_CIRCULO = 12

/**
 * A silhueta da bandeja VISTA DE CIMA, do jeito que ela aparece na mesa.
 *
 * Existe porque os quatro botões de forma eram só palavras — "Triângulo", "Quadrado" —, e escolher
 * a forma da própria mesa lendo o nome dela é o tipo de coisa que um desenho resolve num relance.
 *
 * A ORIENTAÇÃO não é decorativa: os vértices saem de `trayRotation`, a mesma função que gira a
 * bandeja na cena, então o triângulo do ícone aponta a ponta pro fundo e apoia uma face na frente
 * exatamente como o da mesa. Um ícone com a ponta pra outro lado ensinaria a forma errada.
 *
 * O mapa é o de cima: `(x, z)` da cena vira `(x, y)` do SVG direto, porque no SVG o `y` cresce pra
 * BAIXO e na cena o `z` cresce em direção à câmera — o fundo da cena é o topo do desenho.
 */
export function TrayShapeIcon({ shape }: { shape: TrayShape }) {
  const lados = TRAY_SHAPE_SIDES[shape]
  const centro = LADO / 2

  return (
    <svg
      className="style-tab-shape-icon"
      width={LADO}
      height={LADO}
      viewBox={`0 0 ${LADO} ${LADO}`}
      aria-hidden="true"
      focusable="false"
    >
      {lados > LADOS_ATE_VIRAR_CIRCULO ? (
        <circle cx={centro} cy={centro} r={RAIO} />
      ) : (
        <polygon points={verticesDoPoligono(lados)} />
      )}
    </svg>
  )
}

/**
 * Os vértices ficam em `i · passo + giro` — meio passo antes dos centros de face, que é onde
 * `nearestFaceAngle` os coloca. Mesma convenção `(cos θ, sin θ)` sobre `(x, z)` do resto da cena.
 */
function verticesDoPoligono(lados: number): string {
  const passo = (2 * Math.PI) / lados
  const giro = trayRotation(lados)
  const centro = LADO / 2
  const pontos: string[] = []
  for (let i = 0; i < lados; i++) {
    const angulo = i * passo + giro
    pontos.push(`${centro + RAIO * Math.cos(angulo)},${centro + RAIO * Math.sin(angulo)}`)
  }
  return pontos.join(' ')
}
