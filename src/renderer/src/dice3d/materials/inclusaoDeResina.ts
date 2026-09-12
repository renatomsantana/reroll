import * as THREE from 'three'
import { jardim } from './florDeResina'

/**
 * O DADO DE RESINA COM FLOR: um corpo translúcido com um jardim em 3D lá dentro (ver
 * `florDeResina.ts`), que gira junto quando ele rola. A referência é o dado de resina com flor
 * seca que ele trouxe.
 *
 * Três peças, todas filhas da malha do dado, então física, leitura da face e prateleira não sabem
 * que existem:
 *
 * 1. a CASCA DE TRÁS: a mesma geometria com `BackSide`, pra que ao olhar através do dado se veja a
 *    parede de trás tingida, e não o fundo preto da cena;
 * 2. o JARDIM: malhas OPACAS (pétala, folha, caule, raiz), que escrevem no z-buffer como qualquer
 *    objeto sólido, então a casca de trás não pinta por cima delas (está atrás) e a da frente pinta
 *    (está na frente), sem nenhuma ordenação especial;
 * 3. a casca da FRENTE é a própria malha do dado, com o corpo translúcido e os NÚMEROS opacos (o
 *    alfa está pintado no atlas, não no material, é o que deixa o número inteiro por cima da flor,
 *    como o cobre da referência).
 *
 * As duas cascas são transparentes e não escrevem no z-buffer: com `depthWrite` ligado na casca da
 * frente, o jardim inteiro sumiria atrás dela.
 */

/**
 * Quanto do corpo se vê através. Começou em 0,55; ele pediu "mais transparente" na primeira olhada
 * (11/09/2026) e foi pra 0,4; gostou do jardim e pediu "15% menos opaco": 0,34.
 */
export const OPACIDADE_DO_CORPO_DE_RESINA = 0.34
/** A parede de trás, mais fraca ainda: o número dela aparece espelhado e não pode disputar a leitura. */
const OPACIDADE_DA_CASCA_DE_TRAS = 0.26

const ORDEM_CASCA_DE_TRAS = 0
const ORDEM_CASCA_DA_FRENTE = 2

/**
 * O RAIO INSCRITO da geometria: a menor distância do centro a uma face. É o espaço que existe lá
 * dentro. O raio de contorno não serve: num d4 ele é o triplo do inscrito, e a flor sairia pela
 * face.
 */
export function raioInscrito(geometry: THREE.BufferGeometry): number {
  const posicoes = geometry.getAttribute('position')
  const indice = geometry.getIndex()
  const triangulos = indice ? indice.count / 3 : posicoes.count / 3
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const normal = new THREE.Vector3()
  let menor = Infinity
  for (let t = 0; t < triangulos; t++) {
    const i0 = indice ? indice.getX(t * 3) : t * 3
    const i1 = indice ? indice.getX(t * 3 + 1) : t * 3 + 1
    const i2 = indice ? indice.getX(t * 3 + 2) : t * 3 + 2
    a.fromBufferAttribute(posicoes, i0)
    b.fromBufferAttribute(posicoes, i1)
    c.fromBufferAttribute(posicoes, i2)
    normal.crossVectors(b.clone().sub(a), c.clone().sub(a))
    if (normal.lengthSq() === 0) continue
    normal.normalize()
    const distancia = Math.abs(normal.dot(a))
    if (distancia < menor) menor = distancia
  }
  return Number.isFinite(menor) ? menor : 0
}

/**
 * Transforma a malha de um dado no dado de resina: a casca de trás, o jardim e a ordem de desenho.
 * O material da malha já tem que ser o de resina (`createDiceMaterial` com `resin`), e o atlas já
 * tem que ter o corpo pintado com alfa; aqui só entra o que é filho.
 */
export function montarDadoDeResina(mesh: THREE.Mesh, flores?: [string, string]): void {
  const material = mesh.material as THREE.MeshPhysicalMaterial
  mesh.renderOrder = ORDEM_CASCA_DA_FRENTE

  const materialDeTras = material.clone()
  materialDeTras.side = THREE.BackSide
  materialDeTras.opacity = OPACIDADE_DA_CASCA_DE_TRAS
  const cascaDeTras = new THREE.Mesh(mesh.geometry, materialDeTras)
  cascaDeTras.renderOrder = ORDEM_CASCA_DE_TRAS
  mesh.add(cascaDeTras)

  // A semente é a contagem de vértices: cada tipo de dado tem o seu jardim, sempre o mesmo.
  const raio = raioInscrito(mesh.geometry)
  mesh.add(jardim(raio, mesh.geometry.getAttribute('position').count, flores))
}
