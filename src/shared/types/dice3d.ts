/**
 * Definição geométrica e física de um dado 3D, independente de engine de renderização
 * ou de física. Nada aqui importa Three.js nem Rapier — isso é o que permite testar a
 * leitura de resultado (Fase 6) sem abrir uma janela, sem WebGL e sem WASM.
 */

export type Vector3Tuple = [x: number, y: number, z: number]

export type PhysicalDiceSides = 4 | 6 | 8 | 10 | 12 | 20 | 100

export interface DiceFace {
  /** Identificador estável da face (não é índice de triângulo do Three.js). */
  id: number
  /**
   * Valor produzido por esta face quando ela é a "decisiva", conforme `resultMode`.
   * Para dados com `resultMode: 'topFace'`, é o número impresso nesta face.
   * Para dados com `resultMode: 'bottomFace'` (ex.: d4), é o valor que o dado mostra
   * quando ESTA face fica encostada na mesa (ver comentário em `FaceResultMode`).
   */
  value: number
  /** Normal desta face no espaço local do dado, na orientação de repouso do modelo, unitária. */
  normal: Vector3Tuple
}

export type FaceResultMode =
  /**
   * A face decisiva é a que tem maior alinhamento (produto escalar) com o vetor
   * mundial "para cima". Vale para d6, d8, d10, d12, d20 — poliedros onde o número
   * sorteado é lido diretamente na face voltada para cima.
   */
  | 'topFace'
  /**
   * A face decisiva é a que tem maior alinhamento com o vetor mundial "para baixo"
   * (a face encostada na mesa). Existe só por causa do d4: um tetraedro descansa
   * sobre uma face e o resultado tradicionalmente é o número do VÉRTICE que aponta
   * para cima — vértice esse que é justamente o único que não pertence à face de
   * baixo. Em vez de modelar vértices como uma entidade separada, cada face guarda
   * em `value` o resultado correspondente a "essa face embaixo", resolvido durante
   * a Fase 7 com a numeração real do modelo usado.
   */
  | 'bottomFace'

export interface DicePhysicsProfile {
  mass: number
  restitution: number
  friction: number
  linearDamping: number
  angularDamping: number
}

export interface DiceDefinition {
  type: PhysicalDiceSides
  faces: DiceFace[]
  resultMode: FaceResultMode
  /** Raio da esfera envolvente no espaço local (unidades do modelo), usado para espaçar o spawn. */
  boundingRadius: number
  /** Fator de escala aplicado ao modelo/collider ao instanciar o dado na cena. */
  scale: number
  physics: DicePhysicsProfile
  /**
   * Sobrescreve `SETTLE_CONFIG.ambiguousFaceDotMargin` pra este dado. Necessário pro d100
   * esférico (100 facetas pequenas e próximas — a margem global, calibrada pros poliedros
   * regulares de poucas faces, marcaria praticamente toda rolagem como ambígua). Ausente =
   * usa a margem global (ver `resolveAmbiguousMargin`).
   */
  ambiguousMarginOverride?: number
}
