import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { applyCameraKeys, type CameraFrame, type CameraLimits } from './applyCameraKeys'

/**
 * A câmera do WASD é a única parte da cena que NÃO dá pra conferir com uma captura de tela:
 * teclado sintético não chega numa janela do Electron que não está em primeiro plano, então
 * "apertei W e olhei" não é um teste possível aqui. Estes casos são o que substitui isso.
 */

const LIMITS: CameraLimits = {
  minDistance: 6,
  maxDistance: 35,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI / 2 - 0.17,
  panRadius: 15,
  /** O tampo da mesa fica em -0.78 na cena; aqui vale o mesmo piso com a folga que ela usa. */
  minCameraY: -0.28
}

/**
 * Enquadramento de partida representativo, na mesma ordem de grandeza do padrão da bandeja
 * (`CAMERA_CONFIG`). A mira fica na ORIGEM de propósito, e não no ponto recuado que o padrão usa
 * hoje: metade dos casos abaixo mede o deslocamento do alvo a partir do zero (ex.: "andar pra
 * frente deixa `target.z` negativo"), e escrevê-los relativos a um alvo que não é zero só
 * esconderia a conta que está sendo verificada. O que se testa aqui é a matemática do WASD, não o
 * valor do enquadramento inicial.
 */
function defaultFrame(): CameraFrame {
  return {
    position: new THREE.Vector3(0, 13, 14.65),
    target: new THREE.Vector3(0, 0, 0)
  }
}

const NO_KEYS = { forward: 0, horizontal: 0, polar: 0 }

describe('applyCameraKeys', () => {
  it('não mexe em nada quando nenhuma tecla está apertada', () => {
    const frame = defaultFrame()
    applyCameraKeys(frame, 'table', NO_KEYS, 0.016, LIMITS)
    expect(frame.position.toArray()).toEqual([0, 13, 14.65])
    expect(frame.target.toArray()).toEqual([0, 0, 0])
  })

  describe('modo mesa', () => {
    it('anda pra frente sem mudar de altura nem girar o enquadramento', () => {
      const frame = defaultFrame()
      const before = frame.position.clone().sub(frame.target)

      applyCameraKeys(frame, 'table', { ...NO_KEYS, forward: 1 }, 0.5, LIMITS)

      // Deslizou: o alvo saiu do centro na direção pra onde a câmera olhava (-Z).
      expect(frame.target.z).toBeLessThan(-0.1)
      // Continua na mesma altura — no plano da mesa, não mergulhando nela.
      expect(frame.position.y).toBeCloseTo(13, 6)
      expect(frame.target.y).toBeCloseTo(0, 6)
      // E NÃO girou: o vetor da câmera até o alvo é o mesmo de antes. É isto que separa
      // "deslizar" de "orbitar", e o que quebra se alguém mover só a câmera e esquecer o alvo.
      const after = frame.position.clone().sub(frame.target)
      expect(after.distanceTo(before)).toBeLessThan(1e-6)
    })

    it('anda pro lado na perpendicular de onde a câmera olha', () => {
      const frame = defaultFrame()
      applyCameraKeys(frame, 'table', { ...NO_KEYS, horizontal: 1 }, 0.5, LIMITS)
      // Olhando de +Z pra origem, a direita é o +X.
      expect(frame.target.x).toBeGreaterThan(0.1)
      expect(Math.abs(frame.target.z)).toBeLessThan(1e-6)
    })

    it('não deixa o passeio sair da mesa, por mais que se segure a tecla', () => {
      const frame = defaultFrame()
      // 40 segundos de W: muito além do raio da mesa se não houvesse trava.
      for (let i = 0; i < 400; i++) {
        applyCameraKeys(frame, 'table', { ...NO_KEYS, forward: 1 }, 0.1, LIMITS)
      }
      expect(Math.hypot(frame.target.x, frame.target.z)).toBeLessThanOrEqual(LIMITS.panRadius + 1e-6)
    })

    it('mantém o enquadramento ao ser travado na beirada', () => {
      // A trava puxa câmera e alvo juntos: se puxasse só o alvo, chegar na beirada iria GIRAR a
      // cena, que é o tipo de desvio silencioso que já derrubou o enquadramento neste projeto.
      const frame = defaultFrame()
      const before = frame.position.clone().sub(frame.target)
      for (let i = 0; i < 400; i++) {
        applyCameraKeys(frame, 'table', { ...NO_KEYS, forward: 1 }, 0.1, LIMITS)
      }
      const after = frame.position.clone().sub(frame.target)
      expect(after.distanceTo(before)).toBeLessThan(1e-6)
    })

    it('respeita o limite de ângulo no Q/E', () => {
      const frame = defaultFrame()
      for (let i = 0; i < 200; i++) {
        applyCameraKeys(frame, 'table', { ...NO_KEYS, polar: -1 }, 0.1, LIMITS)
      }
      const offset = frame.position.clone().sub(frame.target)
      const phi = new THREE.Spherical().setFromVector3(offset).phi
      expect(phi).toBeGreaterThanOrEqual(LIMITS.minPolarAngle - 1e-6)
      expect(phi).toBeLessThanOrEqual(LIMITS.maxPolarAngle + 1e-6)
    })

    it('não produz NaN com a câmera olhando reto pra baixo', () => {
      // Nesse ângulo a projeção horizontal do olhar é NULA, e normalizar vetor nulo dá NaN — a
      // câmera sumiria da cena de vez, sem erro nenhum no console.
      const frame: CameraFrame = {
        position: new THREE.Vector3(0, 12, 0),
        target: new THREE.Vector3(0, 0, 0)
      }
      applyCameraKeys(frame, 'table', { ...NO_KEYS, forward: 1 }, 0.5, LIMITS)
      expect(Number.isFinite(frame.position.x)).toBe(true)
      expect(Number.isFinite(frame.position.z)).toBe(true)
      expect(Number.isFinite(frame.target.x)).toBe(true)
      expect(Number.isFinite(frame.target.z)).toBe(true)
    })
  })

  describe('modo livre', () => {
    it('voa na direção do olhar, descendo junto (ao contrário do modo mesa)', () => {
      const frame = defaultFrame()
      applyCameraKeys(frame, 'free', { ...NO_KEYS, forward: 1 }, 0.5, LIMITS)
      // A câmera olha pra baixo, então ir "pra frente" aqui também DESCE.
      expect(frame.position.y).toBeLessThan(13)
      expect(frame.position.z).toBeLessThan(14.65)
    })

    it('sobe e desce de verdade no Q/E, em vez de mudar o ângulo', () => {
      const frame = defaultFrame()
      const before = frame.position.clone().sub(frame.target)
      applyCameraKeys(frame, 'free', { ...NO_KEYS, polar: -1 }, 0.5, LIMITS)
      expect(frame.position.y).toBeGreaterThan(13)
      expect(frame.target.y).toBeGreaterThan(0)
      // Subiu em bloco: o ângulo de visão não mudou.
      const after = frame.position.clone().sub(frame.target)
      expect(after.distanceTo(before)).toBeLessThan(1e-6)
    })

    it('NÃO atravessa o tampo da mesa por baixo, por mais que se segure o Q', () => {
      /**
       * O buraco que este caso fecha: no modo livre o Q/E TRANSLADA a câmera, e o limite de ângulo
       * polar não vê isso passar. Dava pra descer reto, atravessar o tampo e continuar embaixo dele
       * — sempre olhando pra baixo, ou seja, sem nenhum ângulo proibido em momento nenhum. O
       * usuário pediu "ver tudo da mesa MENOS debaixo dela", e é a altura que garante isso.
       *
       * Segurar por 20 segundos simulados é bem mais do que precisaria pra furar: sem o piso, a
       * câmera desceria uns 180 de mundo, com o tampo em -0.78.
       */
      const frame = defaultFrame()
      for (let i = 0; i < 200; i++) {
        applyCameraKeys(frame, 'free', { ...NO_KEYS, polar: 1 }, 0.1, LIMITS)
      }
      expect(frame.position.y).toBeGreaterThanOrEqual(LIMITS.minCameraY - 1e-6)
    })

    it('sobe câmera e alvo JUNTOS ao bater no piso, sem torcer o enquadramento', () => {
      // Se o piso corrigisse só a posição, descer até o fundo passaria a INCLINAR a vista sozinho.
      const frame = defaultFrame()
      const before = frame.position.clone().sub(frame.target)
      for (let i = 0; i < 200; i++) {
        applyCameraKeys(frame, 'free', { ...NO_KEYS, polar: 1 }, 0.1, LIMITS)
      }
      const after = frame.position.clone().sub(frame.target)
      expect(after.distanceTo(before)).toBeLessThan(1e-6)
    })

    it('não fica preso ao raio da mesa', () => {
      const frame = defaultFrame()
      for (let i = 0; i < 200; i++) {
        applyCameraKeys(frame, 'free', { ...NO_KEYS, horizontal: 1 }, 0.1, LIMITS)
      }
      expect(Math.hypot(frame.target.x, frame.target.z)).toBeGreaterThan(LIMITS.panRadius)
    })
  })

  describe('modo travado nos dados', () => {
    it('orbita sem tirar o alvo do lugar', () => {
      const frame = defaultFrame()
      applyCameraKeys(frame, 'dice', { ...NO_KEYS, horizontal: 1 }, 0.5, LIMITS)
      expect(frame.target.toArray()).toEqual([0, 0, 0])
      expect(frame.position.x).not.toBeCloseTo(0, 3)
    })

    it('aproxima e afasta dentro dos limites de zoom', () => {
      const perto = defaultFrame()
      for (let i = 0; i < 200; i++) {
        applyCameraKeys(perto, 'dice', { ...NO_KEYS, forward: 1 }, 0.1, LIMITS)
      }
      expect(perto.position.distanceTo(perto.target)).toBeGreaterThanOrEqual(LIMITS.minDistance - 1e-6)

      const longe = defaultFrame()
      for (let i = 0; i < 200; i++) {
        applyCameraKeys(longe, 'dice', { ...NO_KEYS, forward: -1 }, 0.1, LIMITS)
      }
      expect(longe.position.distanceTo(longe.target)).toBeLessThanOrEqual(LIMITS.maxDistance + 1e-6)
    })
  })
})
