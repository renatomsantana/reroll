import { TRAY_CONFIG } from '../config/physicsConfig'
import { nearestFaceAngle, trayApothem } from './trayShape'

/**
 * Onde a torre ao lado da bandeja fica e onde exatamente é a BOCA dela. Fonte ÚNICA, lida pela cena
 * (`createTowerBesideTray.ts`, que constrói a pedra) e pela física (`tossDieFromMouth.ts`, que lança
 * o dado dali): um número duplicado aqui vira dado nascendo dentro da parede, ou no ar a meio metro
 * da soleira, sem nada na tela explicando por quê.
 */

export const TOWER_BESIDE_CONFIG = {
  /**
   * Ângulo do assento, convenção `(cos θ, sin θ)` sobre `(x, z)`. -30° é o centro da face
   * traseira-direita do hexágono, e encostar numa face apoia a torre num plano, não numa quina. Por
   * que não ±90°: em -90° a boca ficaria virada pra câmera, que é o melhor ângulo pra ver o dado
   * saindo, mas é lá que mora o estojo; em +90° ela tampa a bandeja.
   */
  angleRad: -Math.PI / 6,
  /** Raio da casca. */
  radius: 1.45,
  /**
   * Altura da CASCA, da base até a borda das ameias; o telhado cônico e a flâmula somam quase 4 em
   * cima disso. Casada com a câmera e medida sobre a caixa real do grupo (`Box3.setFromObject`, e não
   * fórmula escrita à mão, que envelhece a cada peça nova): com 3.6 o ponto mais alto fica em 9.42 e
   * a câmera precisa recuar 37%; com 4.4 seriam 48%, e a bandeja encolhe demais.
   */
  height: 3.6,
  /**
   * Altura do PISO DA BOCA acima do topo da parede do hexágono. A conta corre ao contrário do que
   * parece: não se escolhe onde a torre se apoia, escolhe-se onde fica a boca, e o pedestal preenche
   * o resto até a mesa — apoiada direto na mesa, a boca ficaria uns 2.3 ABAIXO da borda que o dado
   * precisa transpor, e ele sairia batendo na parede por fora.
   *
   * Subiu de 0.35 junto com a correção do dado-fantasma: o dado sai na HORIZONTAL e nasce APOIADO no
   * piso, ocupando de 0.6 a 1.72 acima da parede; com os 0.35 antigos, a barriga dele passava por
   * dentro do topo da parede na saída.
   */
  mouthClearance: 0.6,
  /**
   * Folga horizontal entre a face externa da parede do hexágono e a casca da torre. Era 0.15, e o
   * resultado era a torre "engolindo o hexágono": encostada na parede ela invade a silhueta da
   * bandeja vista de cima, e o tabuleiro da ponte ainda avançava 0.55 sobre a área de jogo. Com 0.75
   * ela fica claramente do LADO, e a folga vira o vão que a ponte levadiça atravessa.
   *
   * Isto move a boca junto (ela é medida como `apótema + espessura + folga`), e é seguro porque a
   * velocidade sai da DISTÂNCIA real até o slot, não de um impulso fixo.
   */
  shellGap: 0.75,
  /**
   * Quanto o pedestal passa do raio da casca. ZERO: a torre sobe reta da mesa ao telhado. Era 0.12, e
   * foi o que ele viu como "parece que tem dois cilindros diferentes" — um degrau de 12cm na altura
   * em que o pedestal encontra a casca, agravado pela contagem de faces (32 contra 48). Os dois
   * números andam juntos; mexer num sem o outro deixa a emenda visível do mesmo jeito.
   *
   * Se um dia voltar a ser positivo, precisa ser MENOR que `shellGap`, senão a borda do pedestal
   * cruza a parede do hexágono (com 0.3 ela caía em 6.55 contra os 6.7 da face externa da parede).
   */
  plinthOverhang: 0,
  /** Largura do vão do portão, em fração do raio. */
  gateWidthFraction: 1.3,
  /**
   * Altura do vão do portão, em fração do raio. Era 0.78 (1.13 de vão), justificada por um "o maior
   * dado tem ~0.7 de diâmetro" que estava errado: o maior raio circunscrito entre os sete tipos é
   * 0.56, ou seja 1.12 de DIÂMETRO — o dado passava com 0.01 de folga no vão inteiro e, nascendo
   * afundado, atravessava a pedra. Com 1.03 o vão vai a 1.49 e sobra folga de verdade.
   */
  gateHeightFraction: 1.03,
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
  /** Apótema da bandeja NA FORMA em uso — quem desenha a ponte precisa saber onde a parede está. */
  apothem: number
  /** Distância do centro do hexágono ao EIXO da torre. */
  seatDistance: number
  /** Y da base da torre (topo do pedestal). */
  baseY: number
  /**
   * Y do PISO da boca — a superfície de onde o dado sai, e não o centro dele. Quem lança soma o
   * raio do próprio dado (ver `tossDieFromMouth`), porque cada tipo tem um.
   */
  mouthY: number
  /** Posição da boca no mundo, na altura do PISO dela. */
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
 * hexágono termina no apótema, a parede acrescenta `wallThickness` pra fora e a casca acrescenta o
 * próprio raio; só `shellGap` e `mouthClearance` são números de gosto. Consequência útil: a boca cai
 * sempre a `apothem + wallThickness + shellGap` do centro (6.85), qualquer que seja o raio da torre,
 * então mudar o tamanho dela não move o ponto de lançamento nem exige retunar o impulso.
 */
export function computeTowerBesideLayout(
  overrides: Partial<typeof TOWER_BESIDE_CONFIG> = {},
  /**
   * Lados da bandeja. A torre encosta no MEIO DE UMA FACE, nunca numa quina, e tanto a distância
   * quanto o ângulo dependem da forma escolhida: num quadrado os centros de face estão em 0°, 90°,
   * 180° e 270°, e o -30° do hexágono cairia bem na quina, com a boca virada pro vazio.
   */
  sides = TRAY_CONFIG.wallSegments
): TowerBesideLayout {
  const config = { ...TOWER_BESIDE_CONFIG, ...overrides }
  const { radius, height } = config
  const apothem = trayApothem(sides)
  const angleRad = nearestFaceAngle(sides, config.angleRad)

  const seatDistance = apothem + TRAY_CONFIG.wallThickness + radius + config.shellGap
  const sillY = radius * config.sillFraction
  const mouthY = TRAY_CONFIG.wallHeight + config.mouthClearance
  /**
   * A base da torre É o piso da boca. Era `mouthY - sillY`, de quando existia uma soleira de pedra
   * como degrau acima da base; ela saiu quando a ponte levadiça entrou. Sem esta linha o piso do arco
   * ficava 0.32 acima do que o dado pisa, e ele saía cortado pela pedra do batente.
   */
  const baseY = mouthY

  const outward = { x: Math.cos(angleRad), z: Math.sin(angleRad) }
  const mouthDistance = seatDistance - radius

  return {
    apothem,
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
