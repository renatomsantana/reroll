// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * O DADO DA ABA ESTILO PRECISA APARECER SOZINHO.
 *
 * Este arquivo existe por um defeito relatado: "o dado quando vou em estilo, não está aparecendo". A
 * bandeja aparecia, o dado não, e ele surgia assim que se mexia numa cor ou no tipo do dado, o que
 * fazia o defeito parecer intermitente.
 *
 * A causa era ORDEM, não desenho: o efeito de MONTAGEM cria cena, câmera e renderer e passou a esperar
 * dois quadros (por um engasgo medido de 66ms ao trocar de aba), enquanto o efeito de APARÊNCIA, que é
 * quem cria a malha, desiste na primeira linha se a cena ainda não existe. Na primeira passagem os
 * dois rodam juntos, e as dependências do segundo são props que não mudam sozinhas — então ele não
 * rodava de novo, e o dado ficava por criar numa cena vazia já sendo desenhada.
 *
 * O teste é a ordem, e nada mais: montar e conferir que a malha foi construída sem ninguém tocar em
 * nada. Não há WebGL aqui — o `three` e as peças da cena são dublês, porque o que se fixa é a
 * coreografia dos efeitos.
 */

/**
 * O jsdom não tem `ResizeObserver`, e a prévia observa o container pra manter o quadrado. Dublê
 * inerte: aqui nada muda de tamanho, então nunca há o que notificar.
 */
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const buildVisual = vi.fn(() => criarObjeto3D())

/** Dublê de `THREE.Mesh`/`Object3D` — só o que `StylePreview` toca nele. */
function criarObjeto3D() {
  return {
    rotation: { x: 0, y: 0, z: 0, copy: vi.fn(), set: vi.fn(), clone: () => ({}) },
    updateMatrixWorld: vi.fn(),
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() }
  }
}

vi.mock('three', () => {
  class Vector3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0
    ) {}
    normalize() {
      return this
    }
    copy() {
      return this
    }
    multiplyScalar() {
      return this
    }
    length() {
      return 1
    }
  }
  class Box3 {
    setFromObject() {
      return this
    }
    getBoundingSphere(alvo: unknown) {
      return alvo
    }
  }
  class Sphere {
    center = new Vector3()
    radius = 1
  }
  return {
    Scene: class {
      add = vi.fn()
      remove = vi.fn()
      traverse = vi.fn()
    },
    PerspectiveCamera: class {
      fov = 40
      aspect = 1
      position = new Vector3()
      lookAt = vi.fn()
      updateProjectionMatrix = vi.fn()
    },
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      setPixelRatio = vi.fn()
      setSize = vi.fn()
      render = vi.fn()
      dispose = vi.fn()
      forceContextLoss = vi.fn()
    },
    AmbientLight: class {},
    DirectionalLight: class {
      position = { set: vi.fn() }
    },
    Vector3,
    Box3,
    Sphere,
    MathUtils: { degToRad: (graus: number) => (graus * Math.PI) / 180 }
  }
})

vi.mock('@renderer/dice3d/dice-defs/registry', () => ({
  DICE_REGISTRY: new Proxy({}, { get: () => ({ buildVisual }) })
}))
vi.mock('@renderer/dice3d/scene/createDiceEnvironment', () => ({
  setupDiceEnvironment: () => ({ dispose: vi.fn() })
}))
vi.mock('@renderer/dice3d/scene/disposeScene', () => ({
  disposeScene: vi.fn(),
  disposeMesh: vi.fn()
}))

const { StylePreview } = await import('./StylePreview')

afterEach(() => {
  cleanup()
  buildVisual.mockClear()
})

/**
 * A montagem espera DOIS `requestAnimationFrame` aninhados. O jsdom não pinta nada, então aqui eles
 * são só duas voltas do laço de eventos — o que o teste precisa é que os dois tenham acontecido.
 */
async function deixarPassarOsDoisQuadros() {
  for (let volta = 0; volta < 4; volta++) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  }
}

describe('a prévia do dado na aba Estilo', () => {
  it('cria o dado sozinha, sem ninguém mexer em cor nem em tipo', async () => {
    render(<StylePreview sides={20} bodyColor="#ff0000" numberColor="#ffffff" material="matte" flor1="#b48ae0" flor2="#ea7fb0" moonColor="#f3dd9c" crystalColor="#9b5de5" />)

    /**
     * ANTES dos quadros o dado ainda não existe, e isso é esperado: é justamente o adiamento que
     * deixa a aba pintar primeiro. O defeito não era ele demorar — era ele nunca chegar.
     */
    expect(buildVisual).not.toHaveBeenCalled()

    await deixarPassarOsDoisQuadros()

    // E é ESTA linha que falha na versão com o defeito: a cena nascia e o dado não.
    expect(buildVisual).toHaveBeenCalled()
  })
})
