import { TRAY_CONFIG } from './physicsConfig'
import { regularPolygonCircumradius } from '../physics/regularPolygon'

/**
 * Constantes visuais da cena (câmera, luz, materiais). O tamanho da bandeja vem de
 * `TRAY_CONFIG`: um lugar só define isso, pra colisão e pro visual.
 */

export const CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 100,
  /**
   * Enquadramento inicial (o usuário orbita e dá zoom por cima disso, ver `OrbitControls`).
   * Escalar a posição na mesma proporção da bandeja mantém o enquadramento quando ela muda de
   * tamanho: a câmera olha pra origem nos dois casos.
   */
  position: [0, 13, 14.65] as const,
  /**
   * A mira não é o centro da bandeja, é um ponto atrás dela, na direção do estojo. Recuar gira a
   * câmera pra cima, empurra o hexágono pra baixo no quadro e abre espaço pro estojo.
   *
   * Por que -1.5 e não mais: com `fov` vertical de 45° e a câmera em (0, 13, 14.65), a borda de
   * baixo do quadro cruza o chão em z ≈ 8.3 e a quina da frente da bandeja está em z ≈ 7.5 —
   * sobram ~0.8 de grama. Em -1.6 a quina encosta na borda e a parede da frente começa a ser
   * cortada. Se faltar espaço pro estojo, o caminho é afastar a câmera ou aproximar o estojo
   * (o 2.5 em `computeShelfPositions`), nunca recuar mais a mira.
   *
   * Também é o alvo da órbita: o que se orbita é a cena, bandeja e estojo, não só a bandeja.
   */
  lookAt: [0, 0, -1.5] as const
}

/**
 * Câmera do modo torre: mais alta e recuada que a da bandeja, mirando num ponto elevado pra
 * enquadrar a torre inteira e não só a base. A praça da base ficou mais larga pra caber a área de
 * pouso, e a distância acompanhou.
 */
export const TOWER_CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 100,
  position: [0, 6.4, 9.5] as const,
  lookAt: [0, 1, 0] as const
}

/**
 * Só o que não muda por tema; cor e intensidade da luz, parede, chão e fundo estão em
 * `trayThemes.ts`.
 */
export const LIGHT_CONFIG = {
  directional: {
    position: [5, 10, 5] as const,
    shadowMapSize: 2048,
    /** O frustum da sombra tem que cobrir a bandeja inteira, senão a sombra corta. */
    shadowFrustum: regularPolygonCircumradius(TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments) + 2
  }
}

/**
 * Câmera do arranjo "torre ao lado da bandeja" (`createTowerBesideTray.ts`): a `CAMERA_CONFIG`
 * com a posição multiplicada por 1.37 e a mesma mira.
 *
 * O 1.37 saiu de medição: bisseccionando sobre a caixa real da torre (`Box3.setFromObject`, e não
 * uma fórmula do ponto mais alto, que envelhece a cada peça nova), o topo da flâmula fica em 9.42
 * e é esse o recuo que o põe dentro do quadro. Era 1.12 quando a torre terminava numa tampa chata;
 * o telhado cônico e a flâmula somaram quase 4. O preço é a bandeja aparecer menor. Se a torre
 * baixar um dia, este número baixa junto: são um par.
 *
 * O aspecto da janela não entra na conta, o `fov` do three.js é vertical.
 */
export const TOWER_BESIDE_CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 100,
  position: [0, 17.81, 20.07] as const,
  lookAt: [0, 0, -1.5] as const
}
