import * as THREE from 'three'
import { geradorDe } from './florDeResina'

/**
 * O GLITTER dentro do dado de resina: flocos metálicos finos espalhados na esfera inscrita, uns
 * miúdos (o glitter) e uns maiores (os flocos de folha dourada), cada um numa inclinação, pra que
 * a luz pegue uns e não outros e o dado cintile quando gira. É o segundo tema de resina, depois da
 * flor ("vamo tentar o de glitter ou flocos", 11/09/2026).
 *
 * Um `InstancedMesh` só: uma geometria de hexágono chato e uma matriz por floco, então cento e
 * tanto flocos custam um desenho.
 */

/** Cor padrão do glitter: dourado. */
export const COR_PADRAO_DO_GLITTER = '#e0b23c'

const QUANTIDADE = 140
/** Fração dos flocos que são "folha", maiores. */
const FRACAO_DE_FOLHA = 0.15

export interface Floco {
  posicao: THREE.Vector3
  rotacao: THREE.Euler
  /** Raio do hexágono, em unidades do dado. */
  escala: number
  /** Variação de brilho por floco (multiplica a cor), pra não ficarem todos iguais. */
  brilho: number
}

/**
 * Onde cada floco fica. Uniforme na ESFERA (raiz cúbica no raio, senão empilha no centro), até 90%
 * do raio inscrito menos o próprio tamanho, pra nenhum sair pela face.
 */
export function flocosDeGlitter(raio: number, semente: number): Floco[] {
  const sorteio = geradorDe(semente)
  return Array.from({ length: QUANTIDADE }, (_, i) => {
    const folha = i < QUANTIDADE * FRACAO_DE_FOLHA
    const escala = raio * (folha ? 0.07 + sorteio() * 0.06 : 0.02 + sorteio() * 0.03)
    const u = sorteio() * 2 - 1
    const angulo = sorteio() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    const distancia = (raio * 0.9 - escala) * Math.cbrt(sorteio())
    const posicao = new THREE.Vector3(r * Math.cos(angulo), u, r * Math.sin(angulo)).multiplyScalar(distancia)
    const rotacao = new THREE.Euler(sorteio() * Math.PI, sorteio() * Math.PI, sorteio() * Math.PI)
    return { posicao, rotacao, escala, brilho: 0.7 + sorteio() * 0.5 }
  })
}

/** O `InstancedMesh` dos flocos, na cor escolhida. */
export function glitter(raio: number, semente: number, cor: string = COR_PADRAO_DO_GLITTER): THREE.InstancedMesh {
  const flocos = flocosDeGlitter(raio, semente)
  const geometria = new THREE.CircleGeometry(1, 6)
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.22,
    side: THREE.DoubleSide
  })
  const malha = new THREE.InstancedMesh(geometria, material, flocos.length)
  const matriz = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const escala = new THREE.Vector3()
  const base = new THREE.Color(cor)
  const c = new THREE.Color()
  flocos.forEach((floco, i) => {
    quaternion.setFromEuler(floco.rotacao)
    escala.setScalar(floco.escala)
    matriz.compose(floco.posicao, quaternion, escala)
    malha.setMatrixAt(i, matriz)
    c.copy(base).multiplyScalar(floco.brilho)
    malha.setColorAt(i, c)
  })
  malha.instanceMatrix.needsUpdate = true
  if (malha.instanceColor) malha.instanceColor.needsUpdate = true
  // A sombra do dado já é a do dado.
  malha.castShadow = false
  malha.receiveShadow = false
  return malha
}
