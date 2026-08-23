import type * as THREE from 'three'
import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import type { Quaternion } from '../faceReading/readTopFace'
import {
  compor,
  giroVerticalEntre,
  maiorValor,
  orientacaoDoMaiorValor,
  rotacionarVetor
} from '../faceReading/orientacaoDeExibicao'

/**
 * A pose de VITRINE de um dado parado: o maior número pra cima E virado pra quem olha.
 *
 * `orientacaoDeExibicao` resolve metade — qual face fica pra cima. Sobra um grau de liberdade, o
 * giro em torno do eixo vertical, e ele decide se o número aparece de frente ou deitado de lado.
 * Deixar esse giro no que o modelo trouxe de fábrica dava sete dados apontando cada um pra um lado,
 * que foi o que o usuário viu no estojo.
 *
 * A direção do número NÃO é adivinhada por tipo de dado: ela é lida da própria malha, pelo UV. Os
 * três construtores de visual (d4, d6 e o genérico dos poliedros) escrevem UV com contas diferentes,
 * e qualquer tabela escrita à mão aqui envelheceria calada no dia em que um deles mudasse. O UV é o
 * que a textura de verdade usa pra colar o número na face — logo, é a resposta certa por construção.
 */

/** De onde se olha a cena (`CAMERA_CONFIG.position`): o observador está no +Z, à frente do estojo. */
const FRENTE: Vector3Tuple = [0, 0, 1]

/**
 * Pra um número DEITADO numa face virada pra cima, "de frente" é o topo das letras apontando pra
 * LONGE de quem olha — é como se lê um papel em cima da mesa. Daí o oposto da frente.
 */
const TOPO_DAS_LETRAS: Vector3Tuple = [0, 0, -1]

function normalizar(v: Vector3Tuple): Vector3Tuple {
  const t = Math.hypot(v[0], v[1], v[2])
  return t < 1e-9 ? v : [v[0] / t, v[1] / t, v[2] / t]
}

function subtrair(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function produtoEscalar(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function produtoVetorial(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/**
 * A direção, no espaço do modelo, pra onde aponta o TOPO DAS LETRAS do número impresso na face de
 * normal `normalDaFace`.
 *
 * Sai da relação entre posição e UV dentro de um triângulo da face: se andar `dv` no eixo V da
 * textura corresponde a andar tanto no espaço do modelo, então a direção de V crescente é o topo do
 * glifo — a textura é desenhada num canvas e entregue ao Three.js com `flipY`, que é o que faz o
 * topo do desenho cair em V alto.
 *
 * Devolve `null` quando a face não é achada ou quando o triângulo é degenerado no UV (área zero),
 * e aí quem chama fica com o alinhamento sem giro em vez de um giro inventado.
 */
export function topoDasLetrasNaFace(
  geometry: THREE.BufferGeometry,
  normalDaFace: Vector3Tuple
): Vector3Tuple | null {
  const posicoes = geometry.getAttribute('position')
  const uvs = geometry.getAttribute('uv')
  const indices = geometry.getIndex()
  if (!posicoes || !uvs) return null

  const totalTriangulos = indices ? indices.count / 3 : posicoes.count / 3
  const indiceDe = (i: number): number => (indices ? indices.getX(i) : i)

  for (let t = 0; t < totalTriangulos; t++) {
    const i0 = indiceDe(t * 3)
    const i1 = indiceDe(t * 3 + 1)
    const i2 = indiceDe(t * 3 + 2)

    const p0: Vector3Tuple = [posicoes.getX(i0), posicoes.getY(i0), posicoes.getZ(i0)]
    const p1: Vector3Tuple = [posicoes.getX(i1), posicoes.getY(i1), posicoes.getZ(i1)]
    const p2: Vector3Tuple = [posicoes.getX(i2), posicoes.getY(i2), posicoes.getZ(i2)]

    const arestaA = subtrair(p1, p0)
    const arestaB = subtrair(p2, p0)
    const normal = normalizar(produtoVetorial(arestaA, arestaB))

    // A face pedida é a que o triângulo enxerga: mesmo lado, praticamente o mesmo vetor.
    if (produtoEscalar(normal, normalDaFace) < 0.999) continue

    const du1 = uvs.getX(i1) - uvs.getX(i0)
    const dv1 = uvs.getY(i1) - uvs.getY(i0)
    const du2 = uvs.getX(i2) - uvs.getX(i0)
    const dv2 = uvs.getY(i2) - uvs.getY(i0)

    const determinante = du1 * dv2 - du2 * dv1
    if (Math.abs(determinante) < 1e-12) continue

    /**
     * Isolando a direção de V crescente no sistema
     *   arestaA = T·du1 + B·dv1
     *   arestaB = T·du2 + B·dv2
     * (T é a direção de U crescente, e não interessa aqui).
     */
    const topo: Vector3Tuple = [
      (arestaB[0] * du1 - arestaA[0] * du2) / determinante,
      (arestaB[1] * du1 - arestaA[1] * du2) / determinante,
      (arestaB[2] * du1 - arestaA[2] * du2) / determinante
    ]
    return normalizar(topo)
  }

  return null
}

/**
 * A orientação de vitrine: o maior número do dado pra cima e legível de frente.
 *
 * O d4 é o de sempre a exceção, e por um motivo de dado e não de código: nele o resultado é o número
 * do VÉRTICE de cima, impresso nos cantos das três faces laterais (ver `FaceResultMode`). Não existe
 * "face de cima" pra endireitar — o que faz o 4 aparecer de frente é uma das laterais estar virada
 * pra quem olha. Então, pros dados de `bottomFace`, o giro alinha a lateral mais próxima da frente
 * em vez do topo das letras.
 */
export function orientacaoDeVitrine(
  definition: DiceDefinition,
  geometry: THREE.BufferGeometry
): Quaternion {
  const alinhamento = orientacaoDoMaiorValor(definition)

  if (definition.resultMode === 'bottomFace') {
    const lateralMaisAFrente = definition.faces
      .map((face) => rotacionarVetor(face.normal, alinhamento))
      .filter((normal) => normal[1] < 0.9)
      .sort((a, b) => produtoEscalar(b, FRENTE) - produtoEscalar(a, FRENTE))[0]

    if (!lateralMaisAFrente) return alinhamento
    return compor(giroVerticalEntre(lateralMaisAFrente, FRENTE), alinhamento)
  }

  const faceDoValor = definition.faces.find((f) => f.value === maiorValor(definition))
  if (!faceDoValor) return alinhamento

  const topoLocal = topoDasLetrasNaFace(geometry, faceDoValor.normal)
  if (!topoLocal) return alinhamento

  const topoDepoisDoAlinhamento = rotacionarVetor(topoLocal, alinhamento)
  return compor(giroVerticalEntre(topoDepoisDoAlinhamento, TOPO_DAS_LETRAS), alinhamento)
}
