import { TRAY_CONFIG } from '../config/physicsConfig'

/**
 * Onde a torre-ao-lado-da-bandeja fica e onde exatamente é a BOCA dela — fonte ÚNICA, lida tanto
 * pela cena (`createTowerBesideTray.ts`, que constrói a pedra) quanto pela física
 * (`tossDieFromMouth.ts`, que lança o dado dali). Mesmo motivo pelo qual `computeBaffleTransforms`
 * é compartilhado entre mesh e collider na torre antiga: um número duplicado aqui vira dado
 * nascendo dentro da parede, ou no ar a meio metro da soleira, sem nada na tela explicando por quê.
 */

export const TOWER_BESIDE_CONFIG = {
  /**
   * Ângulo (radianos) do assento, convenção `(cos θ, sin θ)` sobre `(x, z)`. -30° é o centro da
   * face TRASEIRA-DIREITA do hexágono: os centros de face ficam em ±30°, ±90° e ±150° (os vértices
   * em 0°, ±60°, ±120° e 180°), e encostar numa face apoia a torre num plano, não numa quina.
   *
   * Por que não ±90°: em -90° (fundo) a boca ficaria virada direto pra câmera, que é o melhor
   * ângulo pra ver o dado saindo — mas é exatamente onde mora o estojo (`computeShelfPositions`,
   * z ≈ -10), e a torre passaria na frente dele. Em +90° (frente) ela tampa a bandeja.
   */
  angleRad: -Math.PI / 6,
  /** Raio da casca. */
  radius: 1.45,
  /**
   * Altura da casca, da base da torre até a borda das ameias.
   *
   * Casada com a câmera, e é a CASCA — o telhado cônico e a flâmula somam quase 4 em cima disso.
   * Medido bisseccionando sobre a caixa real do grupo (`Box3.setFromObject`, não fórmula escrita à
   * mão, que envelhece a cada peça nova): com 3.6 de casca o ponto mais alto fica em 9.42 e a câmera
   * precisa recuar 37% pra ele caber no quadro. Com 4.4 seriam 48%, e a bandeja — que é a superfície
   * de jogo — encolhe demais. Ver `TOWER_BESIDE_CAMERA_CONFIG`.
   */
  height: 3.6,
  /**
   * Altura da BOCA acima do topo da parede do hexágono.
   *
   * A conta corre ao contrário do que parece: não se escolhe onde a torre se apoia, escolhe-se onde
   * fica a boca, e o pedestal preenche o resto até a mesa. É que a mesa está em `TABLE_SURFACE_Y`
   * (-0.78) e o topo da parede, em 1.8 — uma torre apoiada direto na mesa teria a boca uns 2.3
   * ABAIXO da borda que o dado precisa transpor, e o dado sairia batendo na parede por fora.
   */
  mouthClearance: 0.35,
  /** Folga horizontal entre a face EXTERNA da parede do hexágono e a casca da torre. */
  shellGap: 0.15,
  /**
   * Quanto o pedestal passa do raio da casca. ZERO: o pedestal tem exatamente o raio da casca, e a
   * torre sobe reta da mesa ao telhado.
   *
   * Era 0.12, e foi o que o usuário viu como "parece que tem dois cilindros diferentes" — um degrau
   * de 12cm no meio da torre, na altura em que o pedestal encontra a casca. Somava-se a isso a
   * contagem de faces: o pedestal era desenhado com 32 segmentos e a casca com 48, então mesmo com
   * raios iguais a silhueta quebraria ali. Os dois números andam juntos; mexer num sem o outro
   * deixa a emenda visível do mesmo jeito.
   *
   * TETO, se um dia voltar a ser positivo: precisa ser MENOR que `shellGap`, senão a borda do
   * pedestal cruza a parede do hexágono (com 0.3 ela caía em 6.55 contra os 6.7 da face externa da
   * parede — o disco de pedra aparecia por dentro da bandeja).
   */
  plinthOverhang: 0,
  /** Largura do vão do portão, em fração do raio. */
  gateWidthFraction: 1.3,
  /** Altura do vão do portão, em fração do raio. O maior dado tem ~0.7 de diâmetro. */
  gateHeightFraction: 0.78,
  /** Altura da soleira acima da base da torre, em fração do raio — degrau curto, o dado sai rolando. */
  sillFraction: 0.22
}

/**
 * O portão aponta pro -X no referencial LOCAL da torre — fixo, e não vindo de
 * `computeTowerExitAngle()`: aquele ângulo é o da última prateleira do mecanismo antigo, e esta
 * torre não tem mecanismo nenhum.
 */
export const TOWER_BESIDE_GATE_ANGLE = Math.PI

export interface TowerBesideLayout {
  /** Distância do centro do hexágono ao EIXO da torre. */
  seatDistance: number
  /** Y da base da torre (topo do pedestal). */
  baseY: number
  /** Y da boca — onde o dado nasce. */
  mouthY: number
  /** Posição da boca no mundo. */
  mouth: { x: number; y: number; z: number }
  /** Unitário horizontal da boca em direção ao centro do hexágono. */
  mouthDirection: { x: number; z: number }
  /** Unitário horizontal do centro pra fora, na direção do assento. */
  outward: { x: number; z: number }
  gateArcWidth: number
  gateHeight: number
  sillY: number
  radius: number
  height: number
}

/**
 * Distância e alturas MEDIDAS a partir da bandeja, não escolhidas: numa direção de centro de face o
 * hexágono termina no apótema, a parede acrescenta `wallThickness` pra fora, e a casca acrescenta o
 * próprio raio. Só `shellGap` e `mouthClearance` são números de gosto.
 *
 * Consequência útil de a boca ser medida assim: ela cai SEMPRE a `apothem + wallThickness +
 * shellGap` do centro (6.85), qualquer que seja o raio da torre. Mudar o tamanho da torre não move
 * o ponto de lançamento nem exige retunar o impulso.
 */
export function computeTowerBesideLayout(
  overrides: Partial<typeof TOWER_BESIDE_CONFIG> = {}
): TowerBesideLayout {
  const config = { ...TOWER_BESIDE_CONFIG, ...overrides }
  const { angleRad, radius, height } = config

  const seatDistance = TRAY_CONFIG.apothem + TRAY_CONFIG.wallThickness + radius + config.shellGap
  const sillY = radius * config.sillFraction
  const mouthY = TRAY_CONFIG.wallHeight + config.mouthClearance
  const baseY = mouthY - sillY

  const outward = { x: Math.cos(angleRad), z: Math.sin(angleRad) }
  const mouthDistance = seatDistance - radius

  return {
    seatDistance,
    baseY,
    mouthY,
    mouth: { x: outward.x * mouthDistance, y: mouthY, z: outward.z * mouthDistance },
    mouthDirection: { x: -outward.x, z: -outward.z },
    outward,
    gateArcWidth: radius * config.gateWidthFraction,
    gateHeight: radius * config.gateHeightFraction,
    sillY,
    radius,
    height
  }
}
