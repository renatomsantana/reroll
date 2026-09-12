import * as THREE from 'three'
import { geradorDe } from './florDeResina'

/**
 * LUAS E CRISTAIS dentro do dado de resina: o segundo tema, no lugar do glitter que ele achou feio
 * ("coloca de luas e cristais tipo pedras ametistas", 11/09/2026).
 *
 * - CRISTAL: um prisma hexagonal com a ponta em pirâmide, sombreado plano (facetas visíveis), com a
 *   cor clareando da base pra ponta como ametista de verdade. Vêm em CACHOS de quatro a sete,
 *   irradiando de um ponto, e mais uns soltos, pequenos.
 * - LUA: uma crescente extrudada com chanfro, que é o que dá a borda arredondada de peça de resina.
 *
 * Tudo geometria opaca com cor por vértice, como as flores: escreve no z-buffer e a casca resolve
 * a ordem sozinha.
 */

export const COR_PADRAO_DA_LUA = '#f3dd9c'
export const COR_PADRAO_DO_CRISTAL = '#9b5de5'

type Sorteio = () => number

function pintar(geometria: THREE.BufferGeometry, cor: (y: number, alvo: THREE.Color) => void): THREE.BufferGeometry {
  const pos = geometria.getAttribute('position')
  const cores = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    cor(pos.getY(i), c)
    cores.set([c.r, c.g, c.b], i * 3)
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  return geometria
}

const MATERIAL_DE_CRISTAL = new THREE.MeshPhysicalMaterial({
  color: 0x9a9a9a,
  vertexColors: true,
  flatShading: true,
  roughness: 0.25,
  metalness: 0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.2
})

const MATERIAL_DE_LUA = new THREE.MeshStandardMaterial({
  color: 0x9a9a9a,
  vertexColors: true,
  roughness: 0.45,
  metalness: 0.35
})

function malha(geometria: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometria, material)
  m.castShadow = false
  m.receiveShadow = false
  return m
}

/**
 * UM CRISTAL de pé no eixo +Y, base na origem: corpo de `altura` e ponta de mais `altura * 0,35`.
 * A base é mais escura (a pedra é densa embaixo) e a ponta mais clara e mais viva.
 */
export function cristal(altura: number, raio: number, cor: string): THREE.Group {
  const base = new THREE.Color(cor).multiplyScalar(0.55)
  const ponta = new THREE.Color(cor).lerp(new THREE.Color('#ffffff'), 0.35)
  const corpo = new THREE.CylinderGeometry(raio, raio * 0.85, altura, 6, 1, false)
  corpo.translate(0, altura / 2, 0)
  const alturaDaPonta = altura * 0.35
  const bico = new THREE.ConeGeometry(raio, alturaDaPonta, 6, 1, false)
  bico.translate(0, altura + alturaDaPonta / 2, 0)
  const total = altura + alturaDaPonta
  const pinta = (g: THREE.BufferGeometry): THREE.BufferGeometry => pintar(g, (y, alvo) => alvo.copy(base).lerp(ponta, Math.min(1, Math.max(0, y / total))))
  const grupo = new THREE.Group()
  grupo.add(malha(pinta(corpo), MATERIAL_DE_CRISTAL), malha(pinta(bico), MATERIAL_DE_CRISTAL))
  return grupo
}

/** UM CACHO: de quatro a sete cristais saindo de um ponto, cada um numa inclinação, o do meio o maior. */
export function cacho(tamanho: number, cor: string, sorteio: Sorteio): THREE.Group {
  const grupo = new THREE.Group()
  const quantidade = 4 + Math.floor(sorteio() * 4)
  for (let i = 0; i < quantidade; i++) {
    const central = i === 0
    const altura = tamanho * (central ? 0.9 : 0.45 + sorteio() * 0.35)
    const raio = tamanho * (central ? 0.16 : 0.09 + sorteio() * 0.06)
    const c = cristal(altura, raio, cor)
    const inclinacao = central ? sorteio() * 0.15 : 0.35 + sorteio() * 0.7
    const giro = (i / quantidade) * Math.PI * 2 + sorteio() * 0.8
    c.rotation.set(inclinacao * Math.cos(giro), 0, inclinacao * Math.sin(giro))
    grupo.add(c)
  }
  return grupo
}

/**
 * UMA LUA crescente no plano XY, extrudada em Z com chanfro. `raio` é o do disco cheio; a mordida
 * é um disco deslocado pra direita que come a maior parte dele.
 *
 * O contorno é UM caminho fechado: o arco de fora (a parte esquerda do disco) e o arco de dentro
 * (a parte esquerda da mordida), emendados nos dois pontos em que os círculos se cruzam. A
 * primeira versão fazia disco com um "buraco" da mordida, e como a mordida passa da borda do disco,
 * a extrusão saía uma argola.
 */
export function lua(raio: number, espessura: number, cor: string): THREE.Mesh {
  const deslocamento = raio * 0.45
  const raioDaMordida = raio * 0.8
  // Onde os dois círculos se cruzam: x pela equação dos círculos, y pelo disco de fora.
  const x = (raio * raio - raioDaMordida * raioDaMordida + deslocamento * deslocamento) / (2 * deslocamento)
  const y = Math.sqrt(Math.max(0, raio * raio - x * x))
  const anguloDeFora = Math.atan2(y, x)
  const anguloDeDentro = Math.atan2(y, x - deslocamento)
  const forma = new THREE.Shape()
  forma.moveTo(x, y)
  forma.absarc(0, 0, raio, anguloDeFora, Math.PI * 2 - anguloDeFora, false)
  forma.absarc(deslocamento, 0, raioDaMordida, Math.PI * 2 - anguloDeDentro, anguloDeDentro, true)
  forma.closePath()
  const geometria = new THREE.ExtrudeGeometry(forma, {
    depth: espessura,
    bevelEnabled: true,
    bevelThickness: espessura * 0.35,
    bevelSize: espessura * 0.35,
    bevelSegments: 3,
    curveSegments: 24
  })
  geometria.center()
  const claro = new THREE.Color(cor)
  const escuro = claro.clone().multiplyScalar(0.75)
  pintar(geometria, (y, alvo) => alvo.copy(escuro).lerp(claro, Math.min(1, Math.max(0, y / raio + 0.5))))
  return malha(geometria, MATERIAL_DE_LUA)
}

/**
 * O CÉU de um dado: dois cachos de cristal, três luas de tamanhos diferentes e uns cristais soltos,
 * tudo dentro da esfera inscrita de raio `raio`, girado em bloco. Cabe com folga: o cacho maior
 * tem alcance 0,55R a partir de um centro a 0,3R do meio.
 */
export function ceu(raio: number, semente: number, cores: [string, string] = [COR_PADRAO_DA_LUA, COR_PADRAO_DO_CRISTAL]): THREE.Group {
  const sorteio = geradorDe(semente)
  const [corDaLua, corDoCristal] = cores
  const grupo = new THREE.Group()

  const grande = cacho(raio * 0.6, corDoCristal, sorteio)
  grande.position.set(-raio * 0.2, -raio * 0.4, raio * 0.05)
  grande.rotation.set((sorteio() - 0.5) * 0.4, sorteio() * Math.PI * 2, (sorteio() - 0.5) * 0.4)
  grupo.add(grande)

  const pequeno = cacho(raio * 0.38, corDoCristal, sorteio)
  pequeno.position.set(raio * 0.35, raio * 0.1, -raio * 0.3)
  pequeno.rotation.set(Math.PI * 0.8 + sorteio() * 0.4, sorteio() * Math.PI * 2, 0)
  grupo.add(pequeno)

  const luas: [number, THREE.Vector3][] = [
    [raio * 0.26, new THREE.Vector3(raio * 0.3, raio * 0.42, raio * 0.25)],
    [raio * 0.16, new THREE.Vector3(-raio * 0.45, raio * 0.25, -raio * 0.2)],
    [raio * 0.11, new THREE.Vector3(raio * 0.05, -raio * 0.1, raio * 0.5)]
  ]
  for (const [r, posicao] of luas) {
    const l = lua(r, r * 0.3, corDaLua)
    l.position.copy(posicao)
    l.rotation.set(sorteio() * Math.PI, sorteio() * Math.PI, sorteio() * Math.PI)
    grupo.add(l)
  }

  for (let i = 0; i < 5; i++) {
    const solto = cristal(raio * (0.12 + sorteio() * 0.1), raio * 0.03, corDoCristal)
    const u = sorteio() * 2 - 1
    const a = sorteio() * Math.PI * 2
    const d = raio * (0.45 + sorteio() * 0.25)
    solto.position.set(Math.sqrt(1 - u * u) * Math.cos(a) * d, u * d, Math.sqrt(1 - u * u) * Math.sin(a) * d)
    solto.rotation.set(sorteio() * Math.PI, sorteio() * Math.PI, sorteio() * Math.PI)
    grupo.add(solto)
  }

  grupo.rotation.set((sorteio() - 0.5) * 0.8, sorteio() * Math.PI * 2, (sorteio() - 0.5) * 0.8)
  return grupo
}
