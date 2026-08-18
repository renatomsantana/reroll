import * as THREE from 'three'
import type { CameraMode } from '@renderer/settings/SettingsContext'

/**
 * A matemática de câmera do WASD, separada do componente pra poder ser TESTADA.
 *
 * Ela mora aqui, e não solta dentro de `DiceCanvasMulti.tsx`, por um motivo prático: a única forma
 * de conferir câmera olhando é dirigir o app pelo teclado, e teclado sintético não chega numa
 * janela do Electron que não está em primeiro plano. Sem isto, "o WASD funciona" seria uma
 * afirmação sem prova nenhuma por trás.
 *
 * Os três modos vêm do pedido do usuário — andar pela mesa, travar nos dados, ou voar livre (ver
 * `CameraMode`).
 */

export interface CameraKeys {
  /** +1 = W (pra frente), -1 = S. */
  forward: number
  /** +1 = D (direita), -1 = A. */
  horizontal: number
  /** +1 = E, -1 = Q. */
  polar: number
}

export interface CameraLimits {
  minDistance: number
  maxDistance: number
  minPolarAngle: number
  maxPolarAngle: number
  /** Até onde o alvo pode passear no plano da mesa (modo `table`). */
  panRadius: number
  /**
   * Piso da câmera: altura de mundo abaixo da qual ela não desce. É o tampo da mesa — pedido do
   * usuário, "ver tudo da mesa MENOS debaixo dela".
   *
   * Só o ângulo polar não resolvia isso. Ele impede INCLINAR a vista de baixo pra cima, mas no modo
   * livre o Q/E TRANSLADA a câmera: dava pra descer reto, atravessar o tampo e sair embaixo dele,
   * olhando pra baixo o tempo todo — nenhum ângulo proibido em nenhum momento, e ainda assim
   * embaixo da mesa, vendo a face de baixo do tampo e o vazio preto em volta.
   */
  minCameraY: number
}

export interface CameraSpeeds {
  orbit: number
  dolly: number
  polar: number
  pan: number
}

export const DEFAULT_CAMERA_SPEEDS: CameraSpeeds = {
  orbit: 1.6,
  dolly: 9,
  polar: 1.1,
  pan: 9
}

/** Posição da câmera e ponto pra onde ela olha. Ambos são MUTADOS no lugar. */
export interface CameraFrame {
  position: THREE.Vector3
  target: THREE.Vector3
}

const forwardVec = new THREE.Vector3()
const rightVec = new THREE.Vector3()
const stepVec = new THREE.Vector3()
const offsetVec = new THREE.Vector3()
const spherical = new THREE.Spherical()
const WORLD_UP = new THREE.Vector3(0, 1, 0)

/**
 * Gira a câmera em volta do alvo sem mexer nele — o Q/E dos modos que ANDAM. Sozinho, mudar o
 * ângulo polar é o que sobe e desce a vista sem tirá-la de cima do que está sendo olhado.
 */
function orbitPolar(frame: CameraFrame, polar: number, limits: CameraLimits, amount: number): void {
  if (polar === 0) return
  offsetVec.copy(frame.position).sub(frame.target)
  spherical.setFromVector3(offsetVec)
  spherical.phi = Math.min(
    limits.maxPolarAngle,
    Math.max(limits.minPolarAngle, spherical.phi - polar * amount)
  )
  frame.position.copy(frame.target).add(offsetVec.setFromSpherical(spherical))
}

/**
 * Move câmera e alvo JUNTOS. É o que faz o enquadramento deslizar em vez de girar: mexendo só na
 * câmera, o vetor até o alvo muda e a cena roda em torno do ponto antigo.
 */
function translate(frame: CameraFrame, step: THREE.Vector3): void {
  frame.position.add(step)
  frame.target.add(step)
}

/**
 * Empurra o enquadramento INTEIRO de volta pra cima se a câmera afundou abaixo do tampo.
 *
 * Sobe câmera E alvo pelo mesmo tanto, e não só a câmera, pelo mesmo motivo do limite de passeio:
 * corrigir só a posição mudaria a direção do olhar, e descer até o piso passaria a INCLINAR a vista
 * sozinho em vez de simplesmente parar.
 */
function clampAboveTable(frame: CameraFrame, limits: CameraLimits): void {
  const below = limits.minCameraY - frame.position.y
  if (below <= 0) return
  frame.position.y += below
  frame.target.y += below
}

/**
 * Aplica um frame de teclado. `deltaSeconds` é o tempo desde o frame anterior, então a velocidade
 * não depende do FPS da máquina.
 */
export function applyCameraKeys(
  frame: CameraFrame,
  mode: CameraMode,
  keys: CameraKeys,
  deltaSeconds: number,
  limits: CameraLimits,
  speeds: CameraSpeeds = DEFAULT_CAMERA_SPEEDS
): void {
  const { forward, horizontal, polar } = keys
  if (forward === 0 && horizontal === 0 && polar === 0) return

  if (mode === 'table' || mode === 'free') {
    forwardVec.copy(frame.target).sub(frame.position)
    if (mode === 'table') {
      /**
       * Achatado no plano do chão: a câmera olha pra BAIXO, e sem zerar o Y a tecla de andar pra
       * frente enfiaria a câmera dentro da mesa em vez de deslizar por cima dela.
       */
      forwardVec.y = 0
    }
    // Câmera olhando reto pra baixo no modo mesa: a projeção horizontal zera e não existe "pra
    // frente" nenhum. Sem esta guarda, o `normalize()` de um vetor nulo devolve NaN e a câmera
    // some da cena de vez.
    if (forwardVec.lengthSq() < 1e-8) forwardVec.set(0, 0, -1)
    forwardVec.normalize()
    rightVec.crossVectors(forwardVec, WORLD_UP).normalize()

    stepVec.set(0, 0, 0).addScaledVector(forwardVec, forward).addScaledVector(rightVec, horizontal)
    if (stepVec.lengthSq() > 0) {
      stepVec.normalize().multiplyScalar(speeds.pan * deltaSeconds)
      translate(frame, stepVec)

      if (mode === 'table') {
        /**
         * Prende o passeio ao tampo da mesa. Sem isto, segurar o W leva o alvo pro vazio e a cena
         * inteira sai do quadro sem nenhuma pista de como voltar. Puxa a CÂMERA junto pelo mesmo
         * excesso — corrigir só o alvo giraria o enquadramento em vez de só travar o passeio.
         */
        const distance = Math.hypot(frame.target.x, frame.target.z)
        const overshoot = distance - limits.panRadius
        if (overshoot > 0) {
          stepVec
            .set(frame.target.x, 0, frame.target.z)
            .multiplyScalar(-overshoot / distance)
          translate(frame, stepVec)
        }
      }
    }

    // No modo livre, Q/E sobem e descem de verdade; no modo mesa, mudam o ângulo de visão.
    if (mode === 'free') {
      if (polar !== 0) translate(frame, stepVec.set(0, -polar * speeds.pan * deltaSeconds, 0))
    } else {
      orbitPolar(frame, polar, limits, speeds.polar * deltaSeconds)
    }
    // Depois de qualquer movimento dos dois modos que ANDAM — no livre é o Q/E que fura o tampo, no
    // mesa é o W/S quando a vista está bem baixa e o "pra frente" achatado ainda tem queda.
    clampAboveTable(frame, limits)
    return
  }

  // Modo `dice`: órbita clássica em volta do alvo (que persegue os dados em outro lugar).
  offsetVec.copy(frame.position).sub(frame.target)
  spherical.setFromVector3(offsetVec)
  spherical.theta -= horizontal * speeds.orbit * deltaSeconds
  spherical.phi = Math.min(
    limits.maxPolarAngle,
    Math.max(limits.minPolarAngle, spherical.phi - polar * speeds.polar * deltaSeconds)
  )
  spherical.radius = Math.min(
    limits.maxDistance,
    Math.max(limits.minDistance, spherical.radius - forward * speeds.dolly * deltaSeconds)
  )
  frame.position.copy(frame.target).add(offsetVec.setFromSpherical(spherical))
}
