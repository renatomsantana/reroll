import type { DiceDefinition } from '@shared/types/dice3d'
import { DICE_DEFAULT_PHYSICS } from '../config/physicsConfig'

/**
 * A ordem deste array é a ordem dos grupos de material do `BoxGeometry` do
 * Three.js: +x, -x, +y, -y, +z, -z. Essa ordem é parte da API pública e
 * documentada do BoxGeometry (estável há anos) — não é "ordem de triângulo"
 * interna e frágil. `buildD6Visual.ts` consome este array nessa mesma ordem
 * pra construir os materiais, então a face N desta definição SEMPRE
 * corresponde ao grupo de material N da malha: geometria e numeração nunca
 * podem dessincronizar.
 *
 * Soma das faces opostas = 7, como em qualquer d6 padrão (2+5, 3+4, 1+6).
 */
export const D6_DEFINITION: DiceDefinition = {
  type: 6,
  resultMode: 'topFace',
  /**
   * Reduzida de 1 pra 0.7 (mesma proporção aplicada a todos os dados) — pedido do usuário: dados
   * menores pra caber melhor na torre e deixar vários descerem juntos pelo tobogã sem amontoar
   * contra as guias (ver `TOWER_CONFIG.pathWidth`/`maxConcurrentOnRamp`).
   *
   * E de 0.7 pra 0.62, e depois pra 0.55, com o usuário reportando o d6 maior que os outros. Não
   * era impressão: `scale` aqui é a ARESTA do cubo, e o raio circunscrito sai dela multiplicado
   * por `boundingRadius` (√3/2). Com 0.7 isso dava 0.606, contra 0.56 dos dados que usam `scale`
   * já como raio (d4/d8/d10/d20) — o d6 era mesmo o maior de todos.
   *
   * Igualar o RAIO não bastou (0.62 dava 0.537, já abaixo do d20, e ele continuou parecendo
   * grande), porque raio igual não é tamanho igual: um cubo enche ~37% do volume da esfera que o
   * circunscreve, contra ~61% do icosaedro. Pra PARECER do mesmo tamanho, o cubo precisa de raio
   * menor. Com 0.55 o raio cai pra 0.476, uns 15% abaixo do d20.
   */
  scale: 0.55,
  boundingRadius: Math.sqrt(3) / 2,
  physics: { ...DICE_DEFAULT_PHYSICS },
  faces: [
    { id: 0, value: 2, normal: [1, 0, 0] },
    { id: 1, value: 5, normal: [-1, 0, 0] },
    { id: 2, value: 3, normal: [0, 1, 0] },
    { id: 3, value: 4, normal: [0, -1, 0] },
    { id: 4, value: 1, normal: [0, 0, 1] },
    { id: 5, value: 6, normal: [0, 0, -1] }
  ]
}
