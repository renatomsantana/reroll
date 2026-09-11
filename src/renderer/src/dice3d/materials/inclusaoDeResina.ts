import * as THREE from 'three'
import { getCachedTexture, type DiceTextureCache } from './textureCache'

/**
 * O DADO DE RESINA COM FLOR: um corpo translúcido com flores e folhas de verdade lá dentro, que
 * giram junto quando ele rola (a referência é o dado de resina com flor seca que ele trouxe).
 *
 * Três peças, todas filhas da malha do dado, então física, leitura da face e prateleira não sabem
 * que existem:
 *
 * 1. a CASCA DE TRÁS: a mesma geometria com `BackSide`, desenhada antes de tudo, pra que ao olhar
 *    através do dado se veja a parede de trás tingida, e não o fundo preto da cena;
 * 2. as INCLUSÕES: planos com a textura de flor ou folha, espalhados dentro da esfera inscrita;
 * 3. a casca da FRENTE é a própria malha do dado, desenhada por último, com o corpo a 55% e os
 *    NÚMEROS opacos (o alfa está pintado no atlas, não no material, é o que deixa o número
 *    inteiro por cima da flor, como o cobre da referência).
 *
 * A ordem é por `renderOrder`, porque a ordenação por distância do three olha o centro de cada
 * objeto, e o centro das inclusões e o centro do dado são o mesmo ponto. Nada aqui escreve no
 * z-buffer: com `depthWrite` ligado na casca, uma flor atrás da face da frente sumiria.
 */

/** Quanto do corpo se vê através: 0,55 deixa a flor nítida e ainda tinge com a cor escolhida. */
export const OPACIDADE_DO_CORPO_DE_RESINA = 0.55

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
  tipo: 'flor-lilas' | 'flor-rosa' | 'folha'
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

/**
 * Onde cada flor e cada folha fica. Tudo cabe na esfera inscrita: o centro do plano fica a no
 * máximo 36% do raio e o plano tem no máximo 86% do raio de lado, então a meia diagonal (61%)
 * mais o deslocamento (36%) nunca passa de 97%. Na referência a flor ocupa quase o dado inteiro,
 * e foi por isso que o tamanho subiu de 70% pra 86% depois da primeira olhada.
 */
export function arranjoDaInclusao(raio: number, semente: number): Inclusao[] {
  const sorteio = geradorDe(semente)
  const tipos: Inclusao['tipo'][] = ['folha', 'flor-lilas', 'folha', 'flor-rosa', 'folha', 'flor-lilas', 'folha']
  return tipos.map((tipo, i) => {
    // Direção uniforme na esfera; o deslocamento cresce com o índice pra não empilhar no centro.
    const u = sorteio() * 2 - 1
    const angulo = sorteio() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    const distancia = raio * 0.36 * ((i + 1) / tipos.length)
    const posicao = new THREE.Vector3(r * Math.cos(angulo), u, r * Math.sin(angulo)).multiplyScalar(distancia)
    const rotacao = new THREE.Euler(sorteio() * Math.PI, sorteio() * Math.PI, sorteio() * Math.PI)
    const tamanho = raio * 0.86
    return { tipo, posicao, rotacao, tamanho }
  })
}

const LADO_DA_TEXTURA = 256

function desenharFlor(ctx: CanvasRenderingContext2D, petala: string, contorno: string): void {
  const centro = LADO_DA_TEXTURA / 2
  const petalas = 11
  ctx.lineWidth = 3
  for (let i = 0; i < petalas; i++) {
    ctx.save()
    ctx.translate(centro, centro)
    ctx.rotate((i / petalas) * Math.PI * 2)
    ctx.beginPath()
    ctx.ellipse(centro * 0.55, 0, centro * 0.42, centro * 0.13, 0, 0, Math.PI * 2)
    ctx.fillStyle = petala
    ctx.fill()
    ctx.strokeStyle = contorno
    ctx.stroke()
    ctx.restore()
  }
  // O miolo amarelo, com pontinhos alaranjados como o da referência.
  ctx.beginPath()
  ctx.arc(centro, centro, centro * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = '#f2c94c'
  ctx.fill()
  ctx.fillStyle = '#d98a2b'
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const d = centro * (0.08 + (i % 3) * 0.04)
    ctx.beginPath()
    ctx.arc(centro + Math.cos(a) * d, centro + Math.sin(a) * d, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function desenharFolha(ctx: CanvasRenderingContext2D): void {
  const centro = LADO_DA_TEXTURA / 2
  ctx.save()
  ctx.translate(centro, centro)
  ctx.rotate(-Math.PI / 5)
  // A folha é dois arcos que se encontram nas pontas.
  ctx.beginPath()
  ctx.moveTo(-centro * 0.85, 0)
  ctx.quadraticCurveTo(0, -centro * 0.55, centro * 0.85, 0)
  ctx.quadraticCurveTo(0, centro * 0.55, -centro * 0.85, 0)
  ctx.closePath()
  ctx.fillStyle = '#2f9c96'
  ctx.fill()
  ctx.strokeStyle = '#1d6b67'
  ctx.lineWidth = 3
  ctx.stroke()
  // Nervura central e as laterais, mais claras.
  ctx.strokeStyle = '#8fd8d0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-centro * 0.8, 0)
  ctx.lineTo(centro * 0.8, 0)
  ctx.stroke()
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue
    const x = i * centro * 0.2
    const altura = centro * 0.5 * (1 - Math.abs(i) / 4.5)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + centro * 0.15, -altura)
    ctx.moveTo(x, 0)
    ctx.lineTo(x + centro * 0.15, altura)
    ctx.stroke()
  }
  ctx.restore()
}

function texturaDaInclusao(tipo: Inclusao['tipo'], cache: DiceTextureCache | undefined): THREE.CanvasTexture {
  return getCachedTexture(cache, `inclusao|${tipo}`, () => {
    const canvas = document.createElement('canvas')
    canvas.width = LADO_DA_TEXTURA
    canvas.height = LADO_DA_TEXTURA
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para desenhar a inclusão')
    if (tipo === 'folha') desenharFolha(ctx)
    else if (tipo === 'flor-lilas') desenharFlor(ctx, '#b58ee0', '#8a5fc2')
    else desenharFlor(ctx, '#ea7fb0', '#c4508a')
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  })
}

/**
 * Transforma a malha de um dado no dado de resina: a casca de trás, as inclusões e a ordem de
 * desenho. O material da malha já tem que ser o de resina (`createDiceMaterial` com `resin`), e o
 * atlas já tem que ter o corpo pintado com alfa; aqui só entra o que é filho.
 */
export function montarDadoDeResina(mesh: THREE.Mesh, textureCache?: DiceTextureCache): void {
  const material = mesh.material as THREE.MeshPhysicalMaterial
  mesh.renderOrder = ORDEM_CASCA_DA_FRENTE

  const materialDeTras = material.clone()
  materialDeTras.side = THREE.BackSide
  // A parede de trás mais fraca: o número dela aparece espelhado através do dado, e a 40% ele é
  // uma sombra de cobre no fundo, não um segundo número disputando a leitura (a 60% disputava).
  materialDeTras.opacity = 0.4
  const cascaDeTras = new THREE.Mesh(mesh.geometry, materialDeTras)
  cascaDeTras.renderOrder = ORDEM_CASCA_DE_TRAS
  mesh.add(cascaDeTras)

  const raio = raioInscrito(mesh.geometry)
  const semente = mesh.geometry.getAttribute('position').count
  for (const inclusao of arranjoDaInclusao(raio, semente)) {
    const plano = new THREE.Mesh(
      new THREE.PlaneGeometry(inclusao.tamanho, inclusao.tamanho),
      new THREE.MeshStandardMaterial({
        map: texturaDaInclusao(inclusao.tipo, textureCache),
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
