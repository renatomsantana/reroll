// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

/**
 * As texturas de tijolo da torre são pintadas num canvas 2D, e o jsdom não implementa `getContext`.
 * Dublê inerte, como no teste da orientação de vitrine: o que se confere aqui é GEOMETRIA — onde a
 * folha e as correntes param em cada ângulo —, e não um pixel de pedra.
 */
const imagem = (largura = 1, altura = 1): { data: Uint8ClampedArray; width: number; height: number } => ({
  data: new Uint8ClampedArray(Math.max(1, largura * altura * 4)),
  width: largura,
  height: altura
})

const contexto2dInerte = new Proxy(
  {
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    // O mapa de normais do tijolo escreve pixel a pixel num buffer de verdade: devolver um buffer
    // do tamanho pedido é o mínimo pra ele rodar — o conteúdo não importa pra este teste.
    createImageData: (largura: number, altura: number) => imagem(largura, altura),
    getImageData: (_x: number, _y: number, largura: number, altura: number) => imagem(largura, altura)
  },
  {
    get: (alvo, chave) => (chave in alvo ? alvo[chave as keyof typeof alvo] : () => undefined),
    set: () => true
  }
)
HTMLCanvasElement.prototype.getContext = (() => contexto2dInerte) as never

const { createTowerBesideTray } = await import('./createTowerBesideTray')

/**
 * A PONTE LEVADIÇA da torre abre e fecha com um clique (só na torre de enfeite — a regra de QUANDO
 * mora na cena, ver `bridgeUnderPointer`). O que se confere aqui é o movimento em si:
 *
 * - levantada, a folha fica EM PÉ e tampa o vão do portão;
 * - as correntes acompanham a ponta que se move, em vez de ficarem apontando pro vazio;
 * - abaixada, tudo volta exatamente pra onde estava — é o estado em que a ponte sempre existiu, e
 *   em que o dado passa por cima dela no modo torre.
 */
describe('ponte levadiça', () => {
  /** Ponta da folha (a borda de fora do tabuleiro) no espaço da própria folha. */
  function pontaDaFolha(folha: THREE.Group): THREE.Vector3 {
    const caixa = new THREE.Box3().setFromObject(folha)
    return new THREE.Vector3(caixa.max.x, caixa.max.y, 0)
  }

  function elosVisiveis(grupo: THREE.Group): THREE.Mesh[] {
    const visiveis: THREE.Mesh[] = []
    grupo.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.TorusGeometry && obj.visible) {
        visiveis.push(obj)
      }
    })
    return visiveis
  }

  it('nasce abaixada — é como a ponte sempre existiu', () => {
    const { ponte } = createTowerBesideTray()
    expect(ponte.folha.rotation.z).toBeCloseTo(0, 6)
  })

  it('levantada, a folha fica em pé', () => {
    const { ponte } = createTowerBesideTray()
    ponte.definirAbertura(0)
    expect(ponte.folha.rotation.z).toBeCloseTo(Math.PI / 2, 6)
  })

  it('a ponta da folha SOBE ao fechar, em vez de avançar sobre a bandeja', () => {
    const { ponte } = createTowerBesideTray()
    const abaixada = pontaDaFolha(ponte.folha)
    ponte.folha.updateMatrixWorld(true)

    ponte.definirAbertura(0)
    ponte.folha.updateMatrixWorld(true)
    const levantada = pontaDaFolha(ponte.folha).applyMatrix4(ponte.folha.matrix)

    // Abaixada a ponta está no plano do tabuleiro; levantada, ela está lá em cima.
    expect(levantada.y).toBeGreaterThan(abaixada.x * 0.5)
    expect(levantada.y).toBeGreaterThan(1)
  })

  it('as correntes ENCURTAM ao levantar, com o mesmo passo entre elos', () => {
    const { ponte } = createTowerBesideTray()
    const abaixada = elosVisiveis(ponte.grupo).length
    expect(abaixada).toBeGreaterThan(10)

    ponte.definirAbertura(0)
    const levantada = elosVisiveis(ponte.grupo).length
    expect(levantada).toBeLessThan(abaixada)
    expect(levantada).toBeGreaterThanOrEqual(2)
  })

  it('a corrente continua presa NA PAREDE nas duas pontas do movimento', () => {
    const { ponte } = createTowerBesideTray()

    /** O elo mais alto de cada corrente tem que ficar junto da âncora, aconteça o que acontecer. */
    function alturaDoEloMaisAlto(): number {
      return Math.max(...elosVisiveis(ponte.grupo).map((malha) => malha.position.y))
    }

    const comAPonteAbaixada = alturaDoEloMaisAlto()
    ponte.definirAbertura(0)
    const comAPonteLevantada = alturaDoEloMaisAlto()

    // A âncora está a 1.93 de altura; o primeiro elo nasce logo abaixo dela nos dois casos. Se a
    // corrente tivesse sido esquecida no lugar antigo, ou girado junto com a folha, esta altura
    // mudaria de patamar.
    expect(comAPonteAbaixada).toBeGreaterThan(1.5)
    expect(comAPonteLevantada).toBeGreaterThan(1.5)
    expect(Math.abs(comAPonteLevantada - comAPonteAbaixada)).toBeLessThan(0.35)
  })

  it('abaixar de volta devolve a folha ao lugar exato de onde ela saiu', () => {
    const { ponte } = createTowerBesideTray()
    const antes = pontaDaFolha(ponte.folha)
    const elosAntes = elosVisiveis(ponte.grupo).length

    ponte.definirAbertura(0)
    ponte.definirAbertura(1)

    const depois = pontaDaFolha(ponte.folha)
    expect(ponte.folha.rotation.z).toBeCloseTo(0, 6)
    expect(depois.x).toBeCloseTo(antes.x, 6)
    expect(elosVisiveis(ponte.grupo).length).toBe(elosAntes)
  })

  it('a abertura é presa entre 0 e 1 — valor fora da faixa não torce a ponte', () => {
    const { ponte } = createTowerBesideTray()
    ponte.definirAbertura(5)
    expect(ponte.folha.rotation.z).toBeCloseTo(0, 6)
    ponte.definirAbertura(-3)
    expect(ponte.folha.rotation.z).toBeCloseTo(Math.PI / 2, 6)
  })
})
