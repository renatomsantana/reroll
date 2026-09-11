import * as THREE from 'three'
import { FLORES, FOLHAS, IMAGENS, type TipoDeInclusao } from './inclusoes'

export { FLORES, FOLHAS, type TipoDeInclusao }

/**
 * O DADO DE RESINA COM FLOR: um corpo translúcido com plantas de verdade lá dentro, que giram junto
 * quando ele rola (a referência é o dado de resina com flor seca que ele trouxe).
 *
 * Três peças, todas filhas da malha do dado, então física, leitura da face e prateleira não sabem
 * que existem:
 *
 * 1. a CASCA DE TRÁS: a mesma geometria com `BackSide`, desenhada antes de tudo, pra que ao olhar
 *    através do dado se veja a parede de trás tingida, e não o fundo preto da cena;
 * 2. as INCLUSÕES: planos com a foto de uma planta prensada (ver `inclusoes/`), espalhados dentro
 *    da esfera inscrita;
 * 3. a casca da FRENTE é a própria malha do dado, desenhada por último, com o corpo translúcido e
 *    os NÚMEROS opacos (o alfa está pintado no atlas, não no material, é o que deixa o número
 *    inteiro por cima da flor, como o cobre da referência).
 *
 * A ordem é por `renderOrder`, porque a ordenação por distância do three olha o centro de cada
 * objeto, e o centro das inclusões e o centro do dado são o mesmo ponto. Nada aqui escreve no
 * z-buffer: com `depthWrite` ligado na casca, uma flor atrás da face da frente sumiria.
 */

/**
 * Quanto do corpo se vê através. Começou em 0,55; ele pediu "mais transparente" na primeira olhada
 * (11/09/2026) e ficou em 0,4, que ainda tinge com a cor escolhida.
 */
export const OPACIDADE_DO_CORPO_DE_RESINA = 0.4
/** A parede de trás, mais fraca ainda: o número dela aparece espelhado e não pode disputar a leitura. */
const OPACIDADE_DA_CASCA_DE_TRAS = 0.3

const ORDEM_CASCA_DE_TRAS = 0
const ORDEM_INCLUSOES = 1
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

export interface Inclusao {
  tipo: TipoDeInclusao
  posicao: THREE.Vector3
  rotacao: THREE.Euler
  tamanho: number
}

/** Gerador determinístico: a mesma semente dá o mesmo arranjo, então trocar a cor não rearruma a flor. */
function geradorDe(semente: number): () => number {
  let estado = (semente * 2654435761) >>> 0 || 1
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0
    return estado / 4294967296
  }
}

/** Seis por dado: um dado de resina de verdade tem duas ou três plantas grandes, não um buquê. */
const QUANTIDADE = 6
/** Lado do plano em fração do raio inscrito. */
const TAMANHO = 0.86
/** Até onde o centro de um plano se afasta do centro do dado, em fração do raio. */
const DESLOCAMENTO = 0.36

const NOMES_DAS_FLORES = Object.keys(FLORES) as TipoDeInclusao[]
const NOMES_DAS_FOLHAS = Object.keys(FOLHAS) as TipoDeInclusao[]

/**
 * Onde cada planta fica, e qual é. Alterna flor e folha, sorteando qual na lista, então cada tipo
 * de dado tem a sua mistura.
 *
 * Tudo cabe na esfera inscrita: o centro do plano fica a no máximo 36% do raio e o plano tem 86%
 * do raio de lado, então a meia diagonal (61%) mais o deslocamento (36%) nunca passa de 97%. Na
 * referência a flor ocupa quase o dado inteiro, e foi por isso que o tamanho subiu de 70% pra 86%
 * depois da primeira olhada.
 */
export function arranjoDaInclusao(raio: number, semente: number): Inclusao[] {
  const sorteio = geradorDe(semente)
  return Array.from({ length: QUANTIDADE }, (_, i) => {
    const lista = i % 2 === 0 ? NOMES_DAS_FLORES : NOMES_DAS_FOLHAS
    const tipo = lista[Math.floor(sorteio() * lista.length)]
    // Direção uniforme na esfera; o deslocamento cresce com o índice pra não empilhar no centro.
    const u = sorteio() * 2 - 1
    const angulo = sorteio() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    const distancia = raio * DESLOCAMENTO * ((i + 1) / QUANTIDADE)
    const posicao = new THREE.Vector3(r * Math.cos(angulo), u, r * Math.sin(angulo)).multiplyScalar(distancia)
    const rotacao = new THREE.Euler(sorteio() * Math.PI, sorteio() * Math.PI, sorteio() * Math.PI)
    return { tipo, posicao, rotacao, tamanho: raio * TAMANHO }
  })
}

/**
 * Uma textura por planta, carregada uma vez e compartilhada por todo dado. `disposeMesh` dispensa
 * a textura junto com o material do plano; isso só solta a cópia da GPU, e o three sobe de novo no
 * próximo quadro em que ela for usada, porque a imagem continua aqui.
 */
const texturas = new Map<TipoDeInclusao, THREE.Texture>()
const carregador = new THREE.TextureLoader()

function texturaDaInclusao(tipo: TipoDeInclusao): THREE.Texture {
  let textura = texturas.get(tipo)
  if (!textura) {
    textura = carregador.load(IMAGENS[tipo])
    textura.colorSpace = THREE.SRGBColorSpace
    texturas.set(tipo, textura)
  }
  return textura
}

/**
 * Transforma a malha de um dado no dado de resina: a casca de trás, as inclusões e a ordem de
 * desenho. O material da malha já tem que ser o de resina (`createDiceMaterial` com `resin`), e o
 * atlas já tem que ter o corpo pintado com alfa; aqui só entra o que é filho.
 */
export function montarDadoDeResina(mesh: THREE.Mesh): void {
  const material = mesh.material as THREE.MeshPhysicalMaterial
  mesh.renderOrder = ORDEM_CASCA_DA_FRENTE

  const materialDeTras = material.clone()
  materialDeTras.side = THREE.BackSide
  materialDeTras.opacity = OPACIDADE_DA_CASCA_DE_TRAS
  const cascaDeTras = new THREE.Mesh(mesh.geometry, materialDeTras)
  cascaDeTras.renderOrder = ORDEM_CASCA_DE_TRAS
  mesh.add(cascaDeTras)

  const raio = raioInscrito(mesh.geometry)
  const semente = mesh.geometry.getAttribute('position').count
  for (const inclusao of arranjoDaInclusao(raio, semente)) {
    const plano = new THREE.Mesh(
      new THREE.PlaneGeometry(inclusao.tamanho, inclusao.tamanho),
      new THREE.MeshStandardMaterial({
        map: texturaDaInclusao(inclusao.tipo),
        // A planta brilha um pouco por conta própria: atrás de duas camadas de resina tingida, só
        // com a luz da cena ela ficava apagada.
        emissive: 0xffffff,
        emissiveMap: texturaDaInclusao(inclusao.tipo),
        emissiveIntensity: 0.4,
        transparent: true,
        alphaTest: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide,
        roughness: 0.9,
        metalness: 0
      })
    )
    plano.position.copy(inclusao.posicao)
    plano.rotation.copy(inclusao.rotacao)
    plano.renderOrder = ORDEM_INCLUSOES
    mesh.add(plano)
  }
}
