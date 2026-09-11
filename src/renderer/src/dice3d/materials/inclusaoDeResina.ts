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

/**
 * Os formatos. Cinco flores e três folhas; ele pediu "mais formatos" depois da primeira leva, que
 * tinha uma margarida em duas cores e uma folha só.
 */
export const FLORES = ['margarida-lilas', 'flor-rosa', 'rosa', 'cinco-petalas', 'margarida-branca'] as const
export const FOLHAS = ['folha', 'folha-longa', 'samambaia'] as const
export type TipoDeInclusao = (typeof FLORES)[number] | (typeof FOLHAS)[number]

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

const QUANTIDADE = 8
/** Lado do plano em fração do raio inscrito. */
const TAMANHO = 0.86
/** Até onde o centro de um plano se afasta do centro do dado, em fração do raio. */
const DESLOCAMENTO = 0.36

/**
 * Onde cada flor e cada folha fica, e qual é. Alterna flor e folha, sorteando o formato de cada
 * uma na lista, então cada tipo de dado tem a sua mistura.
 *
 * Tudo cabe na esfera inscrita: o centro do plano fica a no máximo 36% do raio e o plano tem 86%
 * do raio de lado, então a meia diagonal (61%) mais o deslocamento (36%) nunca passa de 97%. Na
 * referência a flor ocupa quase o dado inteiro, e foi por isso que o tamanho subiu de 70% pra 86%
 * depois da primeira olhada.
 */
export function arranjoDaInclusao(raio: number, semente: number): Inclusao[] {
  const sorteio = geradorDe(semente)
  return Array.from({ length: QUANTIDADE }, (_, i) => {
    const lista: readonly TipoDeInclusao[] = i % 2 === 0 ? FOLHAS : FLORES
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

const LADO_DA_TEXTURA = 256
const CENTRO = LADO_DA_TEXTURA / 2

/** Um anel de pétalas elípticas em volta do centro. `largura` e `comprimento` em fração do meio-lado. */
function anelDePetalas(
  ctx: CanvasRenderingContext2D,
  quantidade: number,
  comprimento: number,
  largura: number,
  cor: string,
  contorno: string,
  giro = 0
): void {
  ctx.lineWidth = 3
  for (let i = 0; i < quantidade; i++) {
    ctx.save()
    ctx.translate(CENTRO, CENTRO)
    ctx.rotate((i / quantidade) * Math.PI * 2 + giro)
    ctx.beginPath()
    ctx.ellipse(CENTRO * comprimento * 0.55, 0, CENTRO * comprimento * 0.45, CENTRO * largura, 0, 0, Math.PI * 2)
    ctx.fillStyle = cor
    ctx.fill()
    ctx.strokeStyle = contorno
    ctx.stroke()
    ctx.restore()
  }
}

/** O miolo amarelo com pontinhos alaranjados, como o da referência. */
function miolo(ctx: CanvasRenderingContext2D, raio: number, cor = '#f2c94c', pontos = '#d98a2b'): void {
  ctx.beginPath()
  ctx.arc(CENTRO, CENTRO, CENTRO * raio, 0, Math.PI * 2)
  ctx.fillStyle = cor
  ctx.fill()
  ctx.fillStyle = pontos
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const d = CENTRO * raio * (0.4 + (i % 3) * 0.2)
    ctx.beginPath()
    ctx.arc(CENTRO + Math.cos(a) * d, CENTRO + Math.sin(a) * d, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Margarida de pétalas finas. */
function desenharMargarida(ctx: CanvasRenderingContext2D, petala: string, contorno: string, quantidade = 11): void {
  anelDePetalas(ctx, quantidade, 1, 0.13, petala, contorno)
  miolo(ctx, 0.2)
}

/**
 * A flor rosa ENCORPADA: dois anéis de pétalas largas, o de dentro mais escuro e girado meio passo.
 * A primeira versão era uma margarida rosa de pétalas finas, e ele pediu "a rosa mais corporada".
 */
function desenharFlorEncorpada(ctx: CanvasRenderingContext2D): void {
  anelDePetalas(ctx, 8, 1, 0.24, '#ec7fb2', '#c9508c')
  anelDePetalas(ctx, 6, 0.7, 0.24, '#d95b98', '#a83d73', Math.PI / 8)
  miolo(ctx, 0.16, '#f6d35e', '#c9742a')
}

/** Rosa vista de cima: um disco com lóbulos na borda e pétalas em espiral por dentro. */
function desenharRosa(ctx: CanvasRenderingContext2D): void {
  const lobulos = 7
  ctx.fillStyle = '#d94f7a'
  ctx.strokeStyle = '#a3325a'
  ctx.lineWidth = 3
  for (let i = 0; i < lobulos; i++) {
    const a = (i / lobulos) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(CENTRO + Math.cos(a) * CENTRO * 0.5, CENTRO + Math.sin(a) * CENTRO * 0.5, CENTRO * 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(CENTRO, CENTRO, CENTRO * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = '#e0608a'
  ctx.fill()
  // A espiral: arcos cada vez menores, cada um começando um pouco à frente do anterior.
  ctx.strokeStyle = '#a3325a'
  ctx.lineWidth = 3
  for (let i = 0; i < 6; i++) {
    const raio = CENTRO * (0.5 - i * 0.08)
    const inicio = i * 1.9
    ctx.beginPath()
    ctx.arc(CENTRO, CENTRO, raio, inicio, inicio + Math.PI * 1.4)
    ctx.stroke()
  }
}

/** Flor de cinco pétalas gordas, laranja, miolo escuro. */
function desenharCincoPetalas(ctx: CanvasRenderingContext2D): void {
  anelDePetalas(ctx, 5, 1, 0.3, '#f5a14b', '#c9702a')
  miolo(ctx, 0.18, '#7a3b1e', '#f2c94c')
}

/** Margarida branca miúda. */
function desenharMargaridaBranca(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.translate(CENTRO * 0.2, CENTRO * 0.2)
  ctx.scale(0.8, 0.8)
  desenharMargarida(ctx, '#f6f2ea', '#c9c2b4', 13)
  ctx.restore()
}

/** Folha larga: dois arcos que se encontram nas pontas, nervura central e laterais. */
function desenharFolha(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.translate(CENTRO, CENTRO)
  ctx.rotate(-Math.PI / 5)
  ctx.beginPath()
  ctx.moveTo(-CENTRO * 0.85, 0)
  ctx.quadraticCurveTo(0, -CENTRO * 0.55, CENTRO * 0.85, 0)
  ctx.quadraticCurveTo(0, CENTRO * 0.55, -CENTRO * 0.85, 0)
  ctx.closePath()
  ctx.fillStyle = '#2f9c96'
  ctx.fill()
  ctx.strokeStyle = '#1d6b67'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.strokeStyle = '#8fd8d0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-CENTRO * 0.8, 0)
  ctx.lineTo(CENTRO * 0.8, 0)
  ctx.stroke()
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue
    const x = i * CENTRO * 0.2
    const altura = CENTRO * 0.5 * (1 - Math.abs(i) / 4.5)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + CENTRO * 0.15, -altura)
    ctx.moveTo(x, 0)
    ctx.lineTo(x + CENTRO * 0.15, altura)
    ctx.stroke()
  }
  ctx.restore()
}

/** Folha longa e fina, curvada como uma lâmina de capim. */
function desenharFolhaLonga(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.translate(CENTRO, CENTRO)
  ctx.rotate(Math.PI / 3)
  ctx.beginPath()
  ctx.moveTo(-CENTRO * 0.9, CENTRO * 0.1)
  ctx.quadraticCurveTo(0, -CENTRO * 0.35, CENTRO * 0.9, -CENTRO * 0.15)
  ctx.quadraticCurveTo(0, -CENTRO * 0.05, -CENTRO * 0.9, CENTRO * 0.1)
  ctx.closePath()
  ctx.fillStyle = '#3aa08f'
  ctx.fill()
  ctx.strokeStyle = '#237066'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.strokeStyle = '#9fe0d3'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-CENTRO * 0.85, CENTRO * 0.08)
  ctx.quadraticCurveTo(0, -CENTRO * 0.2, CENTRO * 0.85, -CENTRO * 0.13)
  ctx.stroke()
  ctx.restore()
}

/** Samambaia: uma haste com pares de folíolos que diminuem até a ponta. */
function desenharSamambaia(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.translate(CENTRO, CENTRO)
  ctx.rotate(-Math.PI / 4)
  ctx.strokeStyle = '#1f6f52'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-CENTRO * 0.85, 0)
  ctx.lineTo(CENTRO * 0.85, 0)
  ctx.stroke()
  ctx.fillStyle = '#3f9b6a'
  ctx.strokeStyle = '#1f6f52'
  ctx.lineWidth = 2
  const pares = 9
  for (let i = 0; i < pares; i++) {
    const x = -CENTRO * 0.75 + (i / (pares - 1)) * CENTRO * 1.5
    const comprimento = CENTRO * 0.32 * (1 - (i / pares) * 0.8)
    for (const lado of [-1, 1]) {
      ctx.save()
      ctx.translate(x, 0)
      ctx.rotate((lado * -Math.PI) / 3)
      ctx.beginPath()
      ctx.ellipse(comprimento / 2, 0, comprimento / 2, CENTRO * 0.06, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.restore()
}

const DESENHOS: Record<TipoDeInclusao, (ctx: CanvasRenderingContext2D) => void> = {
  'margarida-lilas': (ctx) => desenharMargarida(ctx, '#b58ee0', '#8a5fc2'),
  'flor-rosa': desenharFlorEncorpada,
  rosa: desenharRosa,
  'cinco-petalas': desenharCincoPetalas,
  'margarida-branca': desenharMargaridaBranca,
  folha: desenharFolha,
  'folha-longa': desenharFolhaLonga,
  samambaia: desenharSamambaia
}

function texturaDaInclusao(tipo: TipoDeInclusao, cache: DiceTextureCache | undefined): THREE.CanvasTexture {
  return getCachedTexture(cache, `inclusao|${tipo}`, () => {
    const canvas = document.createElement('canvas')
    canvas.width = LADO_DA_TEXTURA
    canvas.height = LADO_DA_TEXTURA
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para desenhar a inclusão')
    DESENHOS[tipo](ctx)
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
