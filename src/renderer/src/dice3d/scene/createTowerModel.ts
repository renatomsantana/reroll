import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import towerModelUrl from '../../assets/models/torre.glb'
import { TRAY_CONFIG } from '../config/physicsConfig'
import { TOWER_BESIDE_CONFIG } from '../geometry/towerBesideTrayLayout'
import { DEFAULT_TOWER_COLORS, type TowerColors } from './createTowerBesideTray'
import { STONE_ROUGHNESS } from './createTowerScene'
import { TABLE_SURFACE_Y } from './createScene'

/**
 * Torre vinda de um MODELO 3D (`torre 3D/Torre_v1.glb`, trazido pelo usuário), em vez da torre
 * desenhada em código (`createTowerBesideTray.ts`).
 *
 * O arquivo é um glTF binário exportado do SolidWorks: uma malha só, 1592 vértices, um material sem
 * textura, já em Y-up e apoiado no zero. Mede 0.16 × 0.24 × 0.16 nas unidades dele — centímetros de
 * um objeto real, não as unidades da cena —, então tudo aqui gira em torno de reescalar e assentar.
 *
 * Fica do LADO OPOSTO ao da torre de código, pra dar pra comparar as duas na mesma cena.
 */

/**
 * Altura que o modelo deve ter NA CENA. A mesma da casca da torre desenhada em código
 * (`TOWER_BESIDE_CONFIG.height`), pra comparação lado a lado ser justa — quem estiver mais alto
 * ganha a comparação por tamanho, não por desenho.
 */
const TARGET_HEIGHT = 3.6

/** Folga horizontal entre a face externa da parede do hexágono e o modelo. */
const SHELL_GAP = 0.15

/**
 * Direção da PORTA no referencial do modelo: ela olha pro +Z local (90° na convenção
 * `(cos θ, sin θ)` sobre `(x, z)` que o resto da torre usa).
 *
 * Achado OLHANDO, não medindo — e a tentativa de medir merece registro, porque ela falhou de um
 * jeito convincente: varri a parede externa por setor procurando onde ela não chegasse ao chão, e
 * TODOS os setores tinham vértice em y=0. Conclusão errada ("a torre é fechada embaixo"). O motivo é
 * que as ombreiras do arco também tocam o chão, então "menor y por setor" não distingue parede de
 * batente. Renderizar os quatro lados lado a lado mostrou o arco na primeira volta, em um segundo.
 */
const DOOR_ANGLE_RAD = Math.PI / 2

/**
 * Altura da BOCA acima do topo da parede do hexágono — o mesmo número da torre de código.
 *
 * Sem isto o modelo se apoiava na mesa (-0.78) e a porta dele ficava 2.6 abaixo do topo da parede
 * (1.8): o dado nasceria contra a parede, do lado de fora. A porta deste modelo fica rente à base,
 * então erguer o modelo inteiro é o que põe a boca onde ela precisa estar — e o pedestal preenche o
 * vão até a mesa, exatamente como na torre desenhada em código.
 */
const MOUTH_CLEARANCE = 0.35

export interface TowerModelHandle {
  group: THREE.Group
  /**
   * Ponto (mundo) do vão da porta e a direção dele pro centro do hexágono — o equivalente à `mouth`
   * da torre de código, pro dado poder nascer ali.
   */
  mouth: THREE.Vector3
  mouthDirection: THREE.Vector3
  /** Troca a cor da pedra sem recriar nada — mesmo contrato da torre de código. */
  updateColors: (colors: TowerColors) => void
  /**
   * Geometria já em coordenadas de MUNDO, pronta pra virar um collider de malha (`trimesh`) no
   * Rapier. Sai daqui, e não do chamador, porque é aqui que a escala e o assentamento são aplicados
   * — recalcular isso do lado da física seria a segunda cópia de uma conta que já existe.
   */
  physics: { vertices: Float32Array; indices: Uint32Array }
  /** Medidas do modelo depois de escalado e posicionado — o que a física vai precisar saber. */
  info: {
    escala: number
    alturaOriginal: number
    raioNaCena: number
    /** Caixa envolvente no MUNDO, já escalada e posicionada. */
    caixa: { min: THREE.Vector3; max: THREE.Vector3 }
    vertices: number
    triangulos: number
  }
}

/**
 * Carrega e assenta o modelo. Assíncrono porque o `GLTFLoader` é — o chamador monta a cena e o
 * modelo entra quando chegar, em vez de a cena inteira esperar por ele.
 *
 * `angleRad` segue a mesma convenção do resto da torre: `(cos θ, sin θ)` sobre `(x, z)`. O padrão é
 * o MESMO assento da torre desenhada em código (`TOWER_BESIDE_CONFIG.angleRad`) porque este modelo
 * TOMA O LUGAR dela — e isso sai de graça: a boca cai a `apothem + wallThickness + shellGap` do
 * centro nas duas, sem depender do raio da torre, então `tossDieFromMouth` continua lançando do mesmo
 * ponto, sem nenhuma mudança na física.
 */
export async function createTowerModel(
  angleRad = TOWER_BESIDE_CONFIG.angleRad,
  colors: TowerColors = DEFAULT_TOWER_COLORS,
  /** Altura desejada NA CENA. Ver `TARGET_HEIGHT` — é o que decide se o dado cabe pela espiral. */
  targetHeight = TARGET_HEIGHT
): Promise<TowerModelHandle> {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(towerModelUrl)

  /**
   * O arquivo traz um nó de CÂMERA junto ("current camera", coisa do exportador do SolidWorks).
   * Adicionar a cena inteira do glTF arrastaria essa câmera pra dentro da nossa — inofensivo, mas é
   * lixo pendurado na árvore. Fica só o que é malha.
   */
  const modelo = new THREE.Group()
  /**
   * Material NOSSO no lugar do que veio no arquivo.
   *
   * O exportador do SolidWorks gravou cinza-claro (0.894) com rugosidade 0.2 — quase um espelho.
   * Sob a luz da cena isso estoura em branco chapado, que é como a torre aparecia. Além de feio, ela
   * ficava fora da paleta: a cor da pedra é editável na aba Estilo, e um material trazido de fora não
   * responderia a ela.
   *
   * A malha não tem UV (só POSITION e NORMAL), então a textura de tijolo não tem como ser aplicada —
   * é cor chapada com a rugosidade da pedra do resto da cena, e é o máximo que este arquivo permite
   * sem gerar coordenadas de textura por conta própria.
   */
  const material = new THREE.MeshStandardMaterial({ color: colors.stone, roughness: STONE_ROUGHNESS })
  gltf.scene.traverse((filho) => {
    if (filho instanceof THREE.Mesh) {
      const copia = filho.clone()
      copia.material = material
      copia.castShadow = true
      copia.receiveShadow = true
      modelo.add(copia)
    }
  })

  /**
   * Escala derivada da ALTURA REAL do modelo, medida com `Box3` — não de um número escolhido. O
   * arquivo está em unidades do objeto físico (24cm de altura), e a cena trabalha numa escala em que
   * a bandeja tem 6.5 de apótema; sem medir, qualquer fator seria chute.
   */
  const caixaOriginal = new THREE.Box3().setFromObject(modelo)
  const tamanho = caixaOriginal.getSize(new THREE.Vector3())
  const escala = targetHeight / tamanho.y
  modelo.scale.setScalar(escala)

  // Raio no plano do chão depois de escalado — é ele que decide a que distância do hexágono ela senta.
  const raioNaCena = (Math.max(tamanho.x, tamanho.z) / 2) * escala
  const seatDistance = TRAY_CONFIG.apothem + TRAY_CONFIG.wallThickness + raioNaCena + SHELL_GAP

  /**
   * Assenta na MESA, não no zero do mundo: o chão da bandeja está em y=0 e a mesa em volta, mais
   * baixa (`TABLE_SURFACE_Y`). A torre fica FORA do hexágono, então o piso dela é a mesa — apoiar no
   * zero a deixaria flutuando a 0.78 do chão que ela toca.
   *
   * O `-caixaOriginal.min.y * escala` existe porque nem todo exportador põe a base do objeto no zero.
   * Este põe, mas dois modelos diferentes não têm por que concordar nisso, e a conta custa nada.
   */
  const group = new THREE.Group()
  group.add(modelo)
  modelo.position.y = -caixaOriginal.min.y * escala

  const baseY = TRAY_CONFIG.wallHeight + MOUTH_CLEARANCE
  group.position.set(Math.cos(angleRad) * seatDistance, baseY, Math.sin(angleRad) * seatDistance)

  /**
   * Pedestal da mesa até a base da torre. Reto e com o raio do modelo — mesma lição da torre de
   * código, onde um pedestal mais largo, cônico e com outra contagem de faces virou "parecem dois
   * cilindros diferentes".
   */
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(raioNaCena, raioNaCena, baseY - TABLE_SURFACE_Y, 48),
    material
  )
  pedestal.position.set(group.position.x, TABLE_SURFACE_Y + (baseY - TABLE_SURFACE_Y) / 2, group.position.z)
  pedestal.castShadow = true
  pedestal.receiveShadow = true

  /**
   * Gira a torre pra PORTA olhar pro centro do hexágono.
   *
   * Conta, não ângulo tentado: girar por `α` leva o `+Z` local (onde está a porta) pra
   * `(sin α, cos α)`, e queremos que isso seja `-(cos θ, sin θ)` — a direção que aponta do assento
   * de volta pro centro. Daí `α = atan2(-cos θ, -sin θ)`.
   */
  group.rotation.y = Math.atan2(-Math.cos(angleRad), -Math.sin(angleRad)) - (DOOR_ANGLE_RAD - Math.PI / 2)

  const paraOCentro = new THREE.Vector3(-Math.cos(angleRad), 0, -Math.sin(angleRad))
  const mouth = new THREE.Vector3(
    group.position.x + paraOCentro.x * raioNaCena,
    TRAY_CONFIG.wallHeight + MOUTH_CLEARANCE,
    group.position.z + paraOCentro.z * raioNaCena
  )

  /** Envelope: o pedestal fica FORA do grupo girado, senão giraria junto e sairia do eixo. */
  const envelope = new THREE.Group()
  envelope.add(pedestal)
  envelope.add(group)

  let vertices = 0
  let triangulos = 0
  modelo.traverse((filho) => {
    if (filho instanceof THREE.Mesh) {
      const posicoes = filho.geometry.getAttribute('position')
      vertices += posicoes ? posicoes.count : 0
      const indice = filho.geometry.getIndex()
      triangulos += indice ? indice.count / 3 : (posicoes ? posicoes.count / 3 : 0)
    }
  })

  /**
   * Vértices e índices em coordenadas de MUNDO, pra física. `updateWorldMatrix` antes: as matrizes
   * de um objeto recém-posicionado só são recalculadas no próximo render, e sem forçar isso o
   * collider sairia na origem, com a torre desenhada em outro lugar — um obstáculo invisível no meio
   * da mesa e uma torre que os dados atravessam.
   */
  group.updateWorldMatrix(true, true)
  const posicoes: number[] = []
  const indices: number[] = []
  modelo.traverse((filho) => {
    if (!(filho instanceof THREE.Mesh)) return
    const geometria = filho.geometry
    const atributo = geometria.getAttribute('position')
    const indice = geometria.getIndex()
    const base = posicoes.length / 3
    const ponto = new THREE.Vector3()
    for (let i = 0; i < atributo.count; i++) {
      ponto.fromBufferAttribute(atributo, i).applyMatrix4(filho.matrixWorld)
      posicoes.push(ponto.x, ponto.y, ponto.z)
    }
    if (indice) {
      for (let i = 0; i < indice.count; i++) indices.push(base + indice.getX(i))
    } else {
      for (let i = 0; i < atributo.count; i++) indices.push(base + i)
    }
  })

  const caixa = new THREE.Box3().setFromObject(envelope)
  return {
    group: envelope,
    mouth,
    mouthDirection: paraOCentro,
    updateColors: (next) => material.color.set(next.stone),
    physics: { vertices: new Float32Array(posicoes), indices: new Uint32Array(indices) },
    info: {
      escala: +escala.toFixed(2),
      alturaOriginal: +tamanho.y.toFixed(3),
      raioNaCena: +raioNaCena.toFixed(2),
      caixa: { min: caixa.min.clone(), max: caixa.max.clone() },
      vertices,
      triangulos
    }
  }
}
