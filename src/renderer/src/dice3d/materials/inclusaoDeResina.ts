import * as THREE from 'three'
import { jardim } from './florDeResina'

/**
 * O DADO DE RESINA COM FLOR: um corpo quase transparente, TINGIDO como vidro colorido, com um jardim
 * em 3D lá dentro (ver `florDeResina.ts`), que gira junto quando ele rola. A referência é o dado de
 * resina com flor seca que ele trouxe.
 *
 * A cor NÃO vem de opacidade. Ele foi pedindo o dado cada vez mais transparente ("menos 15",
 * "menos 10", "tipo 5% opaco só") e sempre "mantendo a cor", e por mistura comum isso não fecha:
 * com 5% de alfa a cor some. Vidro tingido de verdade funciona de outro jeito: ele MULTIPLICA o
 * que está atrás pela cor dele, e a força do tingimento não depende de quanto ele tapa. É o que a
 * casca de tinta faz (`MultiplyBlending`).
 *
 * As peças, todas filhas da malha do dado, então física, leitura da face e prateleira não sabem que
 * existem:
 *
 * 1. a TINTA DE TRÁS: a geometria com `BackSide` e o filtro fraco, pra parede do fundo tingir;
 * 2. o JARDIM: malhas OPACAS (pétala, folha, caule), que escrevem no z-buffer como qualquer objeto
 *    sólido, então a tinta de trás fica atrás delas e a da frente pinta por cima;
 * 3. a TINTA DA FRENTE: a geometria com o filtro cheio, multiplicando a flor e a cena;
 * 4. os NÚMEROS: a própria malha do dado, com o atlas em que o corpo tem alfa `OPACIDADE_DO_CORPO`
 *    (5%, só um véu pra dar o brilho do vidro) e o número é opaco, por cima de tudo.
 *
 * Nenhuma das cascas escreve no z-buffer: com `depthWrite` ligado numa delas, o jardim sumiria.
 * E a tinta precisa de ALGO atrás pra multiplicar: num canvas transparente ela não tinge nada, por
 * isso a prévia da aba Estilo limpa o fundo com a cor do painel (ver `StylePreview.tsx`).
 */

/**
 * Quanto o corpo TAPA (alfa do véu no atlas). 0,05 a pedido dele ("tipo 5% opaco só"). Não é daqui
 * que vem a cor, ver o cabeçalho.
 */
export const OPACIDADE_DO_CORPO_DE_RESINA = 0.05

/**
 * Quanto a tinta puxa pra cor escolhida: 0 é vidro incolor, 1 é a cor pura multiplicando (que
 * escurece tudo atrás, como resina muito carregada). Em 0,7 a flor amarela virava teal (amarelo
 * vezes teal É teal) e sumia no corpo; 0,45 tinge e deixa a flor com a cor dela.
 */
const FORCA_DA_TINTA_DA_FRENTE = 0.45
const FORCA_DA_TINTA_DE_TRAS = 0.22

const ORDEM_TINTA_DE_TRAS = 0
const ORDEM_TINTA_DA_FRENTE = 1
const ORDEM_NUMEROS = 2

/**
 * A cor que o atlas pinta no corpo da resina. Com o alfa em 5% a compensação de saturação das
 * versões anteriores deixou de ter efeito; fica a cor crua, que é o que o véu mostra.
 */
export function corDoCorpoDeResina(css: string): string {
  return css
}

/** A cor do filtro: branco (não muda nada) puxado pra cor escolhida pela força. */
function filtro(css: string, forca: number): THREE.Color {
  return new THREE.Color('#ffffff').lerp(new THREE.Color(css), forca)
}

function tinta(geometry: THREE.BufferGeometry, css: string, forca: number, side: THREE.Side): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: filtro(css, forca),
    blending: THREE.MultiplyBlending,
    // Obrigatório com MultiplyBlending no three 0.185: sem isto ele registra erro e desenha OPACO.
    premultipliedAlpha: true,
    transparent: true,
    depthWrite: false,
    side
  })
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = false
  m.receiveShadow = false
  return m
}

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
 * Transforma a malha de um dado no dado de resina: as duas tintas, o jardim e a ordem de desenho.
 * O material da malha já tem que ser o de resina (`createDiceMaterial` com `resin`), e o atlas já
 * tem que ter o corpo pintado com alfa; aqui só entra o que é filho. `corDoCorpo` é a cor CSS que
 * a pessoa escolheu, e é dela que sai o filtro.
 */
export function montarDadoDeResina(mesh: THREE.Mesh, corDoCorpo: string, flores?: [string, string]): void {
  mesh.renderOrder = ORDEM_NUMEROS

  const tintaDeTras = tinta(mesh.geometry, corDoCorpo, FORCA_DA_TINTA_DE_TRAS, THREE.BackSide)
  tintaDeTras.renderOrder = ORDEM_TINTA_DE_TRAS
  mesh.add(tintaDeTras)

  const tintaDaFrente = tinta(mesh.geometry, corDoCorpo, FORCA_DA_TINTA_DA_FRENTE, THREE.FrontSide)
  tintaDaFrente.renderOrder = ORDEM_TINTA_DA_FRENTE
  mesh.add(tintaDaFrente)

  // A semente é a contagem de vértices: cada tipo de dado tem o seu jardim, sempre o mesmo.
  const raio = raioInscrito(mesh.geometry)
  mesh.add(jardim(raio, mesh.geometry.getAttribute('position').count, flores))
}
