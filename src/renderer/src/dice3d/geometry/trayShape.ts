import { TRAY_CONFIG } from '../config/physicsConfig'

/**
 * A FORMA da bandeja, escolhida pelo usuário e guardada por personagem.
 *
 * Um círculo é um polígono de muitos lados: a parede física (`createRingWall`) e a malha visual já
 * eram construídas a partir do número de lados, então "círculo" aqui é só um número alto o bastante
 * pra a quina sumir. 64 é o menor que não mostra faceta no tamanho em que a bandeja aparece —
 * medido aumentando até a silhueta parar de mudar.
 */
export const TRAY_SHAPES = ['triangle', 'square', 'hexagon', 'circle'] as const
export type TrayShape = (typeof TRAY_SHAPES)[number]

export const TRAY_SHAPE_SIDES: Record<TrayShape, number> = {
  triangle: 3,
  square: 4,
  hexagon: 6,
  circle: 64
}

/**
 * Apótema de cada forma, derivado do raio CIRCUNSCRITO fixo (`TRAY_CONFIG.circumradius`).
 *
 * Manter o circunscrito, e não o apótema, é o que faz todas as formas ocuparem a mesma pegada na
 * mesa — ver o comentário de `circumradius`. Consequência direta: o triângulo tem o apótema menor
 * de todos (3.75 contra 7.5 do círculo), ou seja, área de jogo menor. Isso é geometria, não bug:
 * dentro do mesmo círculo, o triângulo é a forma que menos aproveita o espaço.
 */
export function trayApothem(sides: number): number {
  return TRAY_CONFIG.circumradius * Math.cos(Math.PI / sides)
}

/**
 * Ângulo do centro de uma FACE do polígono, o mais próximo possível de `preferido`.
 *
 * A torre encosta no meio de uma face, nunca numa quina (ver `TOWER_BESIDE_CONFIG.angleRad`), e
 * onde ficam os centros de face muda com a forma: no hexágono estão em ±30°, ±90°, ±150°; num
 * quadrado, em 0°, 90°, 180°, 270°. Sem isto, trocar a bandeja pra quadrado deixaria a torre
 * apontando pra uma quina, com a boca virada pro vazio entre duas paredes.
 */
export function nearestFaceAngle(sides: number, preferido: number): number {
  const passo = (2 * Math.PI) / sides
  /**
   * Os centros de face caem no MEIO entre vértices (meio passo adiante de cada múltiplo), mais a
   * rotação da bandeja — senão a torre encostaria onde a face estava ANTES de a forma ser girada.
   */
  const giro = trayRotation(sides)
  const indice = Math.round((preferido - giro - passo / 2) / passo)
  return indice * passo + passo / 2 + giro
}

/**
 * Quanto girar a bandeja pra ela ficar "de frente" pra câmera: uma FACE virada pro observador
 * (+90°), e não uma ponta.
 *
 * Sem isso o triângulo nasce com uma quina apontando pra câmera e outra pra direita, que é o que o
 * usuário viu como "o triângulo ficou mt bugado". Girado, ele apoia uma face na frente e manda a
 * ponta pro fundo — onde fica o estojo, que foi o pedido dele ("coloca o bico para o estojo").
 *
 * O HEXÁGONO dá zero: as normais dele já caem em 30°, 90°, 150°... e o 90° está lá. É de
 * propósito — a forma que já existia não pode mudar por causa das novas.
 */
export function trayRotation(sides: number): number {
  const passo = (2 * Math.PI) / sides
  const frente = Math.PI / 2
  // Normais em `i·passo + passo/2`; acha a mais próxima da frente e mede o quanto falta.
  const indice = Math.round((frente - passo / 2) / passo)
  return frente - (indice * passo + passo / 2)
}

/**
 * Meia-largura do quadrado onde os ALVOS do arremesso são distribuídos (`computeSpawnSlots`),
 * ajustada à forma da bandeja.
 *
 * `SPAWN_CONFIG.slotSafeHalfExtent` é um número fixo (4.25) calibrado pro hexágono. Num triângulo,
 * cujo apótema é 3.75, aquele quadrado tem quinas a 6.0 do centro — muito além da parede. Foi
 * exatamente o que o usuário viu: "quando spawna os dados nos outros formatos estão spawnando fora
 * das caixas".
 *
 * A escala é a razão entre o apótema da forma e o do hexágono, e isso basta pra garantir que o
 * alvo cai DENTRO de qualquer uma delas: a quina do quadrado de alvos fica a `extent·√2` do
 * centro, e essa distância continua menor que o apótema em todas as quatro (no triângulo, 3.47
 * contra 3.75). Um ponto dentro do círculo inscrito está dentro do polígono, qualquer que seja ele.
 *
 * O HEXÁGONO dá exatamente 4.25 de volta — a forma que já existia não muda.
 */
export function traySafeHalfExtent(sides: number, base: number): number {
  return base * (trayApothem(sides) / trayApothem(6))
}
