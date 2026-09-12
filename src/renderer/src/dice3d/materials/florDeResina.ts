import * as THREE from 'three'

/**
 * AS PLANTAS EM 3D que vão dentro do dado de resina: pétala com curva e concha, miolo, caule,
 * folha dobrada na nervura e raízes, tudo geometria de verdade. Ele rejeitou duas vezes o plano
 * chapado ("faz tipo um 3D real de flores, não coisas sólidas em 2D", 11/09/2026), e uma flor com
 * volume é a única coisa que dá paralaxe quando o dado gira, que é o que os olhos usam pra dizer
 * "tem alguma coisa DENTRO".
 *
 * Nada aqui usa textura: cor e sombreado vêm de cor por vértice e da luz da cena, então funciona
 * igual na prévia da aba Estilo, na prateleira e na bandeja.
 */

/** Gerador determinístico: a mesma semente dá a mesma planta, então trocar a cor não replanta o dado. */
export function geradorDe(semente: number): () => number {
  let estado = (semente * 2654435761) >>> 0 || 1
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0
    return estado / 4294967296
  }
}

type Sorteio = () => number

/**
 * Uma superfície paramétrica em malha indexada: `nu × nv` quadrados, cada vértice vem de `ponto(u, v)`
 * com u e v em [0, 1], e a cor de `cor(u, v)`. Normais calculadas; `DoubleSide` no material.
 */
function superficie(
  nu: number,
  nv: number,
  ponto: (u: number, v: number, alvo: THREE.Vector3) => void,
  cor: (u: number, v: number, alvo: THREE.Color) => void
): THREE.BufferGeometry {
  const posicoes: number[] = []
  const cores: number[] = []
  const indices: number[] = []
  const p = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const u = i / nu
      const v = j / nv
      ponto(u, v, p)
      posicoes.push(p.x, p.y, p.z)
      cor(u, v, c)
      cores.push(c.r, c.g, c.b)
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j
      const b = a + nv + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3))
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  geometria.setIndex(indices)
  geometria.computeVertexNormals()
  return geometria
}

/**
 * `color` abaixo do branco de propósito: a luz da cena (ambiente 0,6 + direcional 1,4 na prévia)
 * soma perto de 2 e lavava a cor por vértice pra quase branco; a flor 2 vermelha saía rosa-pálido.
 * O multiplicador devolve a cor que a pessoa escolheu na roda.
 */
const MATERIAL_DE_PLANTA = new THREE.MeshStandardMaterial({
  color: 0x8c8c8c,
  vertexColors: true,
  side: THREE.DoubleSide,
  roughness: 0.75,
  metalness: 0
})

function malha(geometria: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(geometria, MATERIAL_DE_PLANTA)
  // A sombra do dado já é a do dado; a flor lá dentro não projeta outra por cima.
  m.castShadow = false
  m.receiveShadow = false
  return m
}

/**
 * UMA PÉTALA: comprimento `L`, largura máxima `largura`, saindo da origem no eixo +X. Curva pra
 * cima ao longo do comprimento (`curva`) e faz concha na largura (`concha`). A cor clareia da base
 * pra ponta, como pétala de verdade.
 */
function petala(L: number, largura: number, curva: number, concha: number, base: THREE.Color, ponta: THREE.Color): THREE.BufferGeometry {
  return superficie(
    10,
    4,
    (u, v, alvo) => {
      const t = v * 2 - 1
      const w = (largura / 2) * Math.sin(Math.PI * Math.pow(u, 0.75))
      alvo.set(u * L, curva * L * u * u + concha * w * t * t, w * t)
    },
    (u, _v, alvo) => alvo.copy(base).lerp(ponta, u)
  )
}

/** UMA FOLHA: como a pétala, mas dobrada em V na nervura e com a nervura mais escura. */
function folha(L: number, largura: number, dobra: number, curva: number, cor: THREE.Color, nervura: THREE.Color): THREE.BufferGeometry {
  return superficie(
    12,
    6,
    (u, v, alvo) => {
      const t = v * 2 - 1
      const w = (largura / 2) * Math.pow(Math.sin(Math.PI * u), 0.8)
      alvo.set(u * L, -dobra * Math.abs(t) * w - curva * L * (u - 0.5) * (u - 0.5), w * t)
    },
    (u, v, alvo) => {
      const t = Math.abs(v * 2 - 1)
      alvo.copy(nervura).lerp(cor, Math.min(1, t * 2.5 + u * 0.2))
    }
  )
}

/** Um tubo ao longo de pontos, com cor sólida. */
function tubo(pontos: THREE.Vector3[], raio: number, cor: THREE.Color): THREE.Mesh {
  const curva = new THREE.CatmullRomCurve3(pontos)
  const geometria = new THREE.TubeGeometry(curva, Math.max(8, pontos.length * 4), raio, 6, false)
  const n = geometria.getAttribute('position').count
  const cores = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) cores.set([cor.r, cor.g, cor.b], i * 3)
  geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  return malha(geometria)
}

export interface FormaDeFlor {
  petalas: number
  aneis: 1 | 2
  /** Largura da pétala em fração do comprimento. */
  largura: number
}

/**
 * As FORMAS. A cor não mora aqui: vem das preferências (a pessoa escolhe a cor da flor 1 e da flor
 * 2 na aba Estilo, ao lado da cor do corpo e do número). Da cor escolhida saem a base (mais escura)
 * e a ponta (mais clara) da pétala; o miolo é sempre amarelo.
 */
export const FORMAS: Record<'margarida' | 'rosa' | 'singela', FormaDeFlor> = {
  margarida: { petalas: 14, aneis: 1, largura: 0.28 },
  rosa: { petalas: 8, aneis: 2, largura: 0.55 },
  singela: { petalas: 6, aneis: 1, largura: 0.5 }
}

export type NomeDaForma = keyof typeof FORMAS

/** Cores padrão das duas flores: lilás e rosa vivas, como a foto de referência. */
export const COR_PADRAO_DA_FLOR_1 = '#b48ae0'
export const COR_PADRAO_DA_FLOR_2 = '#ea7fb0'
const COR_DO_MIOLO = new THREE.Color('#f0c23a')

/** Base e ponta da pétala a partir de UMA cor escolhida: 78% dela na base, 30% do caminho pro branco na ponta. */
function tonsDaPetala(cor: string): { base: THREE.Color; ponta: THREE.Color } {
  const c = new THREE.Color(cor)
  return { base: c.clone().multiplyScalar(0.78), ponta: c.clone().lerp(new THREE.Color('#ffffff'), 0.3) }
}

/**
 * A CABEÇA DA FLOR: um anel (ou dois) de pétalas em volta de um miolo achatado, no plano XZ, olhando
 * pra +Y. `raio` é o alcance da ponta da pétala. Cada pétala inclina e curva um pouco diferente,
 * porque um anel perfeito lê como plástico.
 */
export function cabecaDaFlor(especie: FormaDeFlor, cor: string, raio: number, sorteio: Sorteio): THREE.Group {
  const grupo = new THREE.Group()
  const { base, ponta } = tonsDaPetala(cor)
  const raioDoMiolo = raio * 0.22
  for (let anel = 0; anel < especie.aneis; anel++) {
    const escala = anel === 0 ? 1 : 0.66
    const L = (raio - raioDoMiolo * 0.6) * escala
    const largura = L * especie.largura
    const n = anel === 0 ? especie.petalas : Math.max(4, Math.round(especie.petalas * 0.75))
    for (let i = 0; i < n; i++) {
      const curva = 0.18 + sorteio() * 0.25 + anel * 0.2
      const concha = 0.25 + sorteio() * 0.2
      const geometria = petala(L, largura, curva, concha, base, ponta)
      const m = malha(geometria)
      m.position.set(0, anel * raio * 0.04, 0)
      m.rotation.y = (i / n) * Math.PI * 2 + anel * (Math.PI / n) + (sorteio() - 0.5) * 0.15
      m.rotation.z = (sorteio() - 0.5) * 0.2
      const pivo = new THREE.Group()
      pivo.add(m)
      m.position.x = raioDoMiolo * 0.6
      grupo.add(pivo)
    }
  }
  // O miolo: uma esfera achatada, mais escura na borda.
  const miolo = new THREE.SphereGeometry(raioDoMiolo, 14, 8)
  miolo.scale(1, 0.45, 1)
  const corDoMiolo = COR_DO_MIOLO
  const borda = corDoMiolo.clone().multiplyScalar(0.7)
  const n = miolo.getAttribute('position').count
  const pos = miolo.getAttribute('position')
  const cores = new Float32Array(n * 3)
  const c = new THREE.Color()
  for (let i = 0; i < n; i++) {
    const alto = Math.max(0, pos.getY(i)) / (raioDoMiolo * 0.45)
    c.copy(borda).lerp(corDoMiolo, alto)
    cores.set([c.r, c.g, c.b], i * 3)
  }
  miolo.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  grupo.add(malha(miolo))
  return grupo
}

const COR_DA_FOLHA = new THREE.Color('#2f9c96')
const NERVURA = new THREE.Color('#1b6a66')
const COR_DO_CAULE = new THREE.Color('#4f7a4a')
const COR_DA_RAIZ = new THREE.Color('#c9b08a')

/**
 * UMA PLANTA INTEIRA, de pé: raízes de `-altura/2` até um pouco abaixo, caule subindo com uma
 * ondulação, duas ou três folhas ao longo dele e a cabeça da flor no topo, levemente inclinada.
 * Cabe num cilindro de raio `raioDaFlor` e altura `altura` em volta da origem.
 */
export function planta(especie: FormaDeFlor, cor: string, altura: number, raioDaFlor: number, sorteio: Sorteio): THREE.Group {
  const grupo = new THREE.Group()
  const pe = -altura * 0.35
  const topo = altura * 0.4
  const raioDoCaule = altura * 0.012

  // O caule: quatro pontos com uma ondulação lateral pequena.
  const pontos: THREE.Vector3[] = []
  for (let i = 0; i <= 4; i++) {
    const t = i / 4
    pontos.push(new THREE.Vector3((sorteio() - 0.5) * altura * 0.06, pe + (topo - pe) * t, (sorteio() - 0.5) * altura * 0.06))
  }
  pontos[0].x = 0
  pontos[0].z = 0
  grupo.add(tubo(pontos, raioDoCaule, COR_DO_CAULE))

  // As raízes: uma principal descendo e quatro finas abrindo pros lados, todas com tremida.
  const raizes = 1 + 4
  for (let r = 0; r < raizes; r++) {
    const principal = r === 0
    const comprimento = altura * (principal ? 0.16 : 0.08 + sorteio() * 0.08)
    const direcao = new THREE.Vector3(principal ? 0 : Math.cos((r / 4) * Math.PI * 2 + sorteio()), -1, principal ? 0 : Math.sin((r / 4) * Math.PI * 2 + sorteio())).normalize()
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 3; i++) {
      const t = i / 3
      pts.push(
        new THREE.Vector3(0, pe, 0)
          .addScaledVector(direcao, comprimento * t)
          .add(new THREE.Vector3((sorteio() - 0.5) * altura * 0.03 * t, 0, (sorteio() - 0.5) * altura * 0.03 * t))
      )
    }
    grupo.add(tubo(pts, raioDoCaule * (principal ? 0.8 : 0.4), COR_DA_RAIZ))
  }

  /**
   * As folhas: duas ou três, saindo do caule na METADE DE BAIXO e apontando pra fora quase na
   * horizontal. A primeira versão subia até 75% do caule com a ponta pra cima, e a folha entrava
   * pela cabeça da flor ("cuidado com as folhas, elas tão dentro das outras coisas"). A ponta mais
   * alta agora fica em 0,14 da altura, e a cabeça começa em 0,4.
   */
  const folhas = 2 + Math.floor(sorteio() * 2)
  for (let f = 0; f < folhas; f++) {
    const t = 0.15 + (f / folhas) * 0.35
    const ponto = new THREE.CatmullRomCurve3(pontos).getPoint(t)
    const L = altura * (0.22 + sorteio() * 0.08)
    const m = malha(folha(L, L * 0.42, 0.35, 0.3, COR_DA_FOLHA, NERVURA))
    m.position.copy(ponto)
    m.rotation.y = (f / folhas) * Math.PI * 2 + sorteio() * 1.2
    m.rotation.z = 0.15 + sorteio() * 0.25
    grupo.add(m)
  }

  // A cabeça, no topo, inclinada de leve.
  const cabeca = cabecaDaFlor(especie, cor, raioDaFlor, sorteio)
  cabeca.position.copy(pontos[pontos.length - 1])
  cabeca.rotation.set((sorteio() - 0.5) * 0.5, sorteio() * Math.PI * 2, (sorteio() - 0.5) * 0.5)
  grupo.add(cabeca)
  return grupo
}

/**
 * O JARDIM de um dado: a flor 1 grande, a flor 2 pequena (de outra forma) e uma folha solta, todas
 * dentro da esfera inscrita de raio `raio`. As três são giradas em bloco pra não ficar sempre de
 * pé (flor seca em resina fica na posição em que caiu).
 *
 * As três peças não se tocam: a pequena fica a 0,45R do lado da grande, abaixo da cabeça dela, e a
 * folha solta fica embaixo, do lado oposto, longe das duas cabeças.
 */
export function jardim(raio: number, semente: number, cores: [string, string] = [COR_PADRAO_DA_FLOR_1, COR_PADRAO_DA_FLOR_2]): THREE.Group {
  const sorteio = geradorDe(semente)
  const formas = Object.keys(FORMAS) as NomeDaForma[]
  const primeira = formas[Math.floor(sorteio() * formas.length)]
  let segunda = formas[Math.floor(sorteio() * formas.length)]
  if (segunda === primeira) segunda = formas[(formas.indexOf(primeira) + 1) % formas.length]

  const grupo = new THREE.Group()
  // A planta grande: altura 1,3R (de -0,45R a +0,52R com a flor), flor de raio 0,42R.
  const grande = planta(FORMAS[primeira], cores[0], raio * 1.3, raio * 0.42, sorteio)
  grande.position.set(-raio * 0.1, -raio * 0.05, 0)
  grupo.add(grande)

  const pequena = planta(FORMAS[segunda], cores[1], raio * 0.75, raio * 0.24, sorteio)
  pequena.position.set(raio * 0.38, -raio * 0.22, raio * 0.18)
  pequena.rotation.z = -0.4
  grupo.add(pequena)

  const solta = malha(folha(raio * 0.45, raio * 0.2, 0.3, 0.4, COR_DA_FOLHA, NERVURA))
  solta.position.set(-raio * 0.3, -raio * 0.4, raio * 0.28)
  solta.rotation.set(sorteio() * Math.PI, sorteio() * Math.PI, sorteio() * Math.PI)
  grupo.add(solta)

  grupo.rotation.set((sorteio() - 0.5) * 1.2, sorteio() * Math.PI * 2, (sorteio() - 0.5) * 1.2)
  return grupo
}

/** O ponto mais longe da origem entre todos os vértices do grupo, no espaço do grupo. Pra testar que cabe. */
export function alcance(grupo: THREE.Object3D): number {
  grupo.updateMatrixWorld(true)
  let maior = 0
  const p = new THREE.Vector3()
  grupo.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const pos = obj.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld)
      maior = Math.max(maior, p.length())
    }
  })
  return maior
}
