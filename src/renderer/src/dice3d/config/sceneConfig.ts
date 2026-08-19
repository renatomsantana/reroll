import { TRAY_CONFIG } from './physicsConfig'
import { regularPolygonCircumradius } from '../physics/regularPolygon'

/**
 * Constantes puramente visuais da cena (câmera, luzes, materiais da bandeja).
 * Dimensões da bandeja vêm de `physicsConfig.TRAY_CONFIG` — um só lugar define
 * "o tamanho da bandeja", tanto pra colisão (Fase 3) quanto pro visual (aqui).
 */

export const CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 100,
  /**
   * Posição fixa, olhando de cima em ângulo — não reage à física. Escalada
   * junto com `TRAY_CONFIG.apothem` sempre que a bandeja muda de tamanho —
   * como a câmera olha pra origem nos dois casos, escalar a distância na
   * mesma proporção da bandeja mantém o enquadramento (o "zoom" aparente não
   * muda, só o alcance). O usuário também ganhou controle de órbita/zoom
   * manual desde então (`OrbitControls` em `DiceCanvasMulti.tsx`), então isso
   * é só o enquadramento inicial, não o único ângulo possível.
   */
  position: [0, 13, 14.65] as const,
  /**
   * A mira NÃO é o centro da bandeja (que fica na origem), é um ponto ATRÁS dela, na direção do
   * estojo (z ≈ -10, ver `computeShelfPositions`). Recuar a mira gira a câmera pra cima, o que
   * empurra o hexágono pra BAIXO no quadro e abre espaço em cima pro estojo — pedido do usuário,
   * que queria ver melhor a caixinha. Mesma ideia da prévia da aba Estilo (`TrayPreview.tsx`).
   *
   * Por que -1.5 e não mais: a bandeja já ocupa quase toda a altura do quadro. Com `fov` vertical
   * de 45° e a câmera em (0, 13, 14.65), a borda de baixo do quadro cruza o chão em z ≈ 8.3,
   * enquanto a quina da frente da bandeja está em z ≈ 7.5 (circunraio de um hexágono de apótema
   * 6.5) — ou seja, sobram só ~0.8 de grama embaixo dela, uns 6% da altura da tela. Recuar a mira
   * consome exatamente essa sobra: em -1.6 a quina da frente encosta na borda de baixo, e daí em
   * diante a parede da frente da bandeja começa a ser CORTADA. -1.5 pega quase toda a folga sem
   * chegar lá.
   *
   * Se ainda faltar espaço pro estojo, o próximo passo não é recuar mais a mira (só corta a
   * bandeja): é afastar a câmera, que encolhe a cena inteira e libera margem dos dois lados, ou
   * aproximar o estojo da bandeja (o 2.5 em `computeShelfPositions`), que o deixa MAIOR em vez de
   * menor.
   *
   * Também é o alvo da órbita (`controls.target`), e faz sentido que seja: o que se orbita é a
   * cena — bandeja e estojo —, não só a bandeja.
   */
  lookAt: [0, 0, -1.5] as const
}

/**
 * Câmera do modo "torre" (ver `TOWER_CONFIG`) — mais recuada/alta que `CAMERA_CONFIG` porque a
 * torre continua mais alta que a bandeja aberta, mesmo depois de várias rodadas reduzindo
 * `turns`/`centerlineRadius` (pedido repetido do usuário: torre "bem menor e mais fina"). Mira
 * num ponto elevado (não na origem) pra enquadrar a torre inteira, não só a base. Reescalada
 * proporcionalmente à queda de altura (~0.28×, mesma técnica já usada em toda mudança de tamanho
 * da torre/bandeja neste projeto) a partir do enquadramento original da sessão 8 (`topY≈14.35`)
 * pra manter a MESMA framing relativa de sempre, em vez de compor arredondamentos de reescalas
 * anteriores.
 */
/**
 * `TOWER_CONFIG.turns`/tamanho da torre voltaram ao valor histórico bem testado nesta sessão
 * (ver comentário de `turns` em `physicsConfig.ts` — a versão mais baixa/atarracada tentada
 * derrubava a confiabilidade da rampa). A base/praça ficou um pouco mais larga (`baseFloorRadius`
 * 5.5→6.5, pra caber a área de aterrissagem um pouco mais afastada da porta) — posição/distância
 * escaladas levemente sobre o enquadramento original pra caber essa praça maior.
 */
export const TOWER_CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 100,
  position: [0, 6.4, 9.5] as const,
  lookAt: [0, 1, 0] as const
}

/**
 * Só o que NÃO muda por tema (ver `trayThemes.ts` pra cor de luz/ambiente/parede/chão/fundo,
 * que variam por tema) — posição da luz direcional e configuração de sombra são iguais em
 * qualquer tema, só a cor/intensidade da luz em si muda.
 */
export const LIGHT_CONFIG = {
  directional: {
    position: [5, 10, 5] as const,
    shadowMapSize: 2048,
    /** Frustum da câmera de sombra precisa cobrir a bandeja inteira, senão a sombra corta. */
    shadowFrustum: regularPolygonCircumradius(TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments) + 2
  }
}

/**
 * Câmera do arranjo "torre AO LADO da bandeja" (ver `createTowerBesideTray.ts`): a bandeja de
 * sempre, com a torre encostada numa das faces do hexágono.
 *
 * É a `CAMERA_CONFIG` com a posição multiplicada por 1.12 e a MESMA mira — a técnica que este
 * projeto já usa em toda mudança de tamanho de cena (escalar a distância mantém o enquadramento
 * relativo, só muda o alcance).
 *
 * O 1.37 saiu de medição, não de tentativa: bisseccionando sobre a caixa real da torre
 * (`Box3.setFromObject` — não uma fórmula do "ponto mais alto", que envelhece a cada peça nova), o
 * topo da flâmula fica em 9.42 e é esse o recuo que o põe dentro do quadro.
 *
 * Era 1.12 quando a torre terminava numa tampa chata. O telhado cônico e a flâmula da versão de
 * fantasia somam quase 4 acima da casca, e foi isso que empurrou o recuo. O preço é a bandeja
 * aparecer menor: cada ponto de recuo encolhe a superfície de jogo junto. Se um dia a torre baixar,
 * este número tem que baixar junto — eles são um par, não dois ajustes independentes.
 *
 * O aspecto da janela não entra na conta: o `fov` do three.js é VERTICAL, então o que corta em cima
 * independe da largura.
 */
export const TOWER_BESIDE_CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 100,
  position: [0, 17.81, 20.07] as const,
  lookAt: [0, 0, -1.5] as const
}
