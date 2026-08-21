import { useEffect, useMemo, useRef } from 'react'
import { TRAY_SHAPE_SIDES, type TrayShape } from '@renderer/dice3d/geometry/trayShape'
import * as THREE from 'three'
import {
  createTrayPreview,
  TABLE_SURFACE_Y,
  type TrayPreviewHandle
} from '@renderer/dice3d/scene/createScene'
import {
  createTowerBesideTray,
  type TowerBesideTrayHandle,
  type TowerColors
} from '@renderer/dice3d/scene/createTowerBesideTray'
import {
  computeShelfPositions,
  createShelfCaseMesh,
  type ShelfCaseHandle
} from '@renderer/dice3d/scene/DiceCanvasMulti'
import { disposeScene } from '@renderer/dice3d/scene/disposeScene'
import { disposePreviewRenderer, previewPixelRatio, startPreviewLoop } from './previewLoop'
import './StylePreview.css'

/** Mesma conversão de `StylePreview.tsx`/`DiceRoller3D.tsx` — os construtores da cena esperam hex numérico, não string CSS. */
function hexStringToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/** Giro bem devagar: a bandeja é grande e uma volta rápida embrulha mais do que mostra. */
const ROTATION_SPEED = 0.18

/**
 * De onde a câmera olha. Só a DIREÇÃO mora aqui — a DISTÂNCIA é medida da cena montada
 * (`frameCamera`), porque ela muda de verdade: com a torre em cena o ponto mais alto sai de ~2 pra
 * ~9.4, e uma distância fixa cortaria a bandeira fora do quadro.
 *
 * O vetor é o que a câmera fixa usava antes (posição `(0, 16, 21)` mirando `(0, 0, -2)`), pra a
 * prévia sem torre continuar com o mesmo ângulo de sempre.
 */
const CAMERA_DIRECTION = new THREE.Vector3(0, 16, 23).normalize()

interface TrayPreviewProps {
  wallColor: string
  floorColor: string
  /** A prévia mostra a FORMA escolhida — se ela mostrasse hexágono sempre, ensinaria errado. */
  trayShape: TrayShape
  /**
   * A TORRE na prévia. Pedido do usuário: pintar pedra, bico, bandeira ou porta não mostrava nada,
   * porque a peça pintada não estava em cena — as quatro cores eram escolhidas no escuro.
   *
   * Quem decide é `StyleTab`, e são dois motivos: a torre está na mesa de verdade (modo de
   * lançamento com torre) ou a pessoa está pintando uma peça dela.
   */
  showTower: boolean
  /** As quatro peças pintáveis, em cor CSS — a conversão pra hex numérico é feita aqui dentro. */
  towerStoneColor: string
  towerRoofColor: string
  towerFlagColor: string
  towerDoorColor: string
}

/**
 * Monta o estojo na mesma posição e altura da cena real: atrás da bandeja
 * (`computeShelfPositions`) e apoiado na mesa (`TABLE_SURFACE_Y`), não no chão da bandeja. Sem os
 * dados dentro — a prévia é sobre a COR da caixa, e sete dados ali só disputariam atenção com ela.
 */
function buildCase(stage: THREE.Group, wallColor: string, floorColor: string): ShelfCaseHandle {
  const shelfCase = createShelfCaseMesh(
    computeShelfPositions()[0].z,
    hexStringToNumber(floorColor),
    hexStringToNumber(wallColor)
  )
  shelfCase.group.position.y = TABLE_SURFACE_Y
  stage.add(shelfCase.group)
  return shelfCase
}

/** Quanto do quadro fica de respiro em volta. 4% de cada lado — medido olhando o resultado. */
const FOLGA = 0.04
/** Quantos ângulos do cilindro varrido são conferidos. 48 = um a cada 7,5°, sobra pro que gira. */
const AMOSTRAS_POR_VOLTA = 48
/** Em quantas fatias de altura a cena é medida. 16 separa bandeja, estojo, casca e bandeira. */
const FAIXAS_DE_ALTURA = 16

/**
 * Pra cada fatia de altura, o quanto a cena se afasta do eixo Y ali dentro.
 *
 * Mede malha por malha, e não o grupo inteiro, pra caixa de uma peça alta e fina não emprestar a
 * largura de uma baixa e larga. Cada malha entra com o maior raio da caixa dela nas duas pontas de
 * altura que ela ocupa — conservador o suficiente pra nada escapar, e apertado o suficiente pra não
 * enquadrar vazio.
 */
function medirRaioPorFaixa(stage: THREE.Group, caixa: THREE.Box3): { raio: number; y: number }[] {
  const alturaTotal = Math.max(caixa.max.y - caixa.min.y, 1e-6)
  const raios = new Array<number>(FAIXAS_DE_ALTURA).fill(0)
  const caixaDaMalha = new THREE.Box3()

  stage.traverse((objeto) => {
    if (!(objeto as THREE.Mesh).isMesh) return
    caixaDaMalha.setFromObject(objeto)
    if (caixaDaMalha.isEmpty()) return
    const raio = Math.max(
      Math.hypot(caixaDaMalha.min.x, caixaDaMalha.min.z),
      Math.hypot(caixaDaMalha.min.x, caixaDaMalha.max.z),
      Math.hypot(caixaDaMalha.max.x, caixaDaMalha.min.z),
      Math.hypot(caixaDaMalha.max.x, caixaDaMalha.max.z)
    )
    const primeira = faixaDe(caixaDaMalha.min.y, caixa.min.y, alturaTotal)
    const ultima = faixaDe(caixaDaMalha.max.y, caixa.min.y, alturaTotal)
    for (let i = primeira; i <= ultima; i++) raios[i] = Math.max(raios[i], raio)
  })

  const alturaDaFaixa = alturaTotal / FAIXAS_DE_ALTURA
  const amostras: { raio: number; y: number }[] = []
  raios.forEach((raio, i) => {
    if (raio <= 0) return
    // As duas bordas da fatia: a peça ocupa a fatia inteira, não só o meio dela.
    amostras.push({ raio, y: caixa.min.y + i * alturaDaFaixa })
    amostras.push({ raio, y: caixa.min.y + (i + 1) * alturaDaFaixa })
  })
  return amostras
}

function faixaDe(y: number, base: number, alturaTotal: number): number {
  const bruta = Math.floor(((y - base) / alturaTotal) * FAIXAS_DE_ALTURA)
  return Math.min(FAIXAS_DE_ALTURA - 1, Math.max(0, bruta))
}

/**
 * Afasta a câmera o exato necessário pra cena montada caber no quadro — MEDIDO na projeção, não um
 * número escolhido a olho.
 *
 * O palco GIRA, então o que precisa caber não é a caixa parada: é o CILINDRO que ela varre em volta
 * do eixo Y. Enquadrar pela caixa parada faria a prévia "respirar" pra dentro e pra fora do quadro
 * enquanto gira — o mesmo problema que `StylePreview.frameCamera` resolve no dado.
 *
 * A conta é por BISSEÇÃO sobre a projeção de verdade, e não pela esfera que envolve tudo, porque a
 * esfera mente por um caminhão: ela enche as quinas do quadro de ar. Medido no harness de prévia,
 * a cena sem torre pedia 35.7 de distância pelo ajuste da esfera contra 28 da câmera fixa que
 * existia antes — a bandeja de sempre encolheria pra 78% do tamanho sem nada ter mudado nela.
 * Projetando o cilindro e apertando até encostar, o número volta pro lugar.
 */
export function frameCamera(camera: THREE.PerspectiveCamera, stage: THREE.Group): void {
  const giro = stage.rotation.y
  stage.rotation.y = 0
  stage.updateMatrixWorld(true)
  const caixa = new THREE.Box3().setFromObject(stage)
  stage.rotation.y = giro

  if (caixa.isEmpty()) return

  const alvoY = (caixa.max.y + caixa.min.y) / 2
  const alvo = new THREE.Vector3(0, alvoY, 0)

  /**
   * O raio varrido POR FAIXA DE ALTURA, e não um cilindro só.
   *
   * Um cilindro único mede ar: o mais largo da cena é o estojo, lá embaixo, e o mais alto é a
   * bandeira, fina e a 10 de altura. Enfiar os dois num cilindro do maior raio pela maior altura
   * pede uma distância que nada na cena precisa — foi assim que o ajuste anterior mandou a câmera
   * pra 36 quando a bandeja sozinha cabia em 28. Faixa a faixa, cada altura pede só o que a peça
   * que mora nela ocupa.
   */
  const raioPorFaixa = medirRaioPorFaixa(stage, caixa)

  const amostras: THREE.Vector3[] = []
  for (const { raio, y } of raioPorFaixa) {
    for (let i = 0; i < AMOSTRAS_POR_VOLTA; i++) {
      const angulo = (i * 2 * Math.PI) / AMOSTRAS_POR_VOLTA
      amostras.push(new THREE.Vector3(raio * Math.cos(angulo), y, raio * Math.sin(angulo)))
    }
  }

  const limite = 1 - FOLGA
  function cabe(distancia: number): boolean {
    camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distancia).add(alvo)
    camera.lookAt(alvo)
    camera.updateMatrixWorld(true)
    for (const ponto of amostras) {
      const projetado = ponto.clone().project(camera)
      if (Math.abs(projetado.x) > limite || Math.abs(projetado.y) > limite) return false
    }
    return true
  }

  /**
   * Bisseção entre "com certeza corta" e "com certeza cabe". O teto sai dobrando a partir do raio
   * até caber: um limite fixo escrito à mão quebraria calado no dia em que a cena crescer.
   */
  let longe = Math.max(...raioPorFaixa.map((f) => f.raio), 1)
  for (let i = 0; i < 12 && !cabe(longe); i++) longe *= 2
  let perto = 0
  for (let i = 0; i < 24; i++) {
    const meio = (perto + longe) / 2
    if (cabe(meio)) longe = meio
    else perto = meio
  }
  cabe(longe)
}

/**
 * Prévia da BANDEJA na aba Estilo — pedido do usuário, que até então só via o efeito das cores de
 * parede e chão voltando pra aba Rolagem e olhando a cena de verdade.
 *
 * A geometria vem de `createTrayPreview`, que monta com as mesmas funções da cena principal. Aqui
 * só ficam enquadramento, luz e o giro — as três coisas que são DA PRÉVIA e não da bandeja.
 *
 * As cores são aplicadas em cima dos materiais existentes (`updateColors`), sem reconstruir nada:
 * arrastar o seletor de cor dispara `input` continuamente, e reconstruir as texturas procedurais de
 * madeira e veludo a cada evento travaria a interface. Por isso esta prévia não precisa do debounce
 * que a do dado usa — lá a troca de cor obriga a redesenhar a textura de cada face.
 */
export function TrayPreview({
  wallColor,
  floorColor,
  trayShape,
  showTower,
  towerStoneColor,
  towerRoofColor,
  towerFlagColor,
  towerDoorColor
}: TrayPreviewProps) {
  /**
   * Memorizado porque é DEPENDÊNCIA de efeito: montado a cada render, o objeto seria sempre novo e
   * o efeito de cor rodaria em toda digitação da tela inteira, não só quando uma das quatro mudasse.
   */
  const towerColors = useMemo<TowerColors>(
    () => ({
      stone: hexStringToNumber(towerStoneColor),
      roof: hexStringToNumber(towerRoofColor),
      flag: hexStringToNumber(towerFlagColor),
      door: hexStringToNumber(towerDoorColor)
    }),
    [towerStoneColor, towerRoofColor, towerFlagColor, towerDoorColor]
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<TrayPreviewHandle | null>(null)
  const caseRef = useRef<ShelfCaseHandle | null>(null)
  const towerRef = useRef<TowerBesideTrayHandle | null>(null)
  /**
   * As cores do momento em que a torre for MONTADA. A montagem acontece no efeito de baixo, que não
   * escuta cor nenhuma (senão remontaria a torre a cada tom arrastado no seletor) — sem este espelho
   * ela nasceria com a cor do primeiro render e só se acertaria no clique seguinte.
   */
  const towerColorsRef = useRef(towerColors)
  towerColorsRef.current = towerColors

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    /**
     * Bandeja, estojo e torre giram JUNTOS, num grupo só. Girar só a bandeja deixaria os outros
     * parados ao lado dela, como se não fizessem parte da mesma mesa.
     */
    const stage = new THREE.Group()
    scene.add(stage)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(previewPixelRatio())
    container.appendChild(renderer.domElement)

    // Mesma proporção de luz da cena principal (ambiente forte + direcional quente), pra cor
    // escolhida aqui sair igual à que vai aparecer lá.
    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    const directional = new THREE.DirectionalLight(0xfff4e0, 1.3)
    directional.position.set(5, 10, 5)
    scene.add(ambient, directional)

    const sides = TRAY_SHAPE_SIDES[trayShape]
    const tray = createTrayPreview(
      hexStringToNumber(wallColor),
      hexStringToNumber(floorColor),
      sides
    )
    trayRef.current = tray
    stage.add(tray.object)

    /**
     * O ESTOJO entra na prévia a pedido do usuário: ele também é tingido pela cor de parede (numa
     * versão bem mais escura, ver `createShelfCaseMesh`) e não dava pra ver o efeito da escolha
     * nele sem voltar pra aba Rolagem.
     *
     * Vem de `DiceCanvasMulti.tsx` e é montado AQUI, e não dentro de `createTrayPreview`, porque
     * `createScene.ts` — importado por `DiceCanvasMulti.tsx` — não pode importar de volta sem
     * fechar um ciclo.
     */
    caseRef.current = buildCase(stage, wallColor, floorColor)

    /**
     * A torre é montada com as MESMAS funções da cena de verdade, e recebe os lados da bandeja: ela
     * encosta no meio de uma FACE, e onde as faces ficam depende da forma (ver `nearestFaceAngle`).
     * Trocar pra triângulo aqui move a torre exatamente como move lá.
     */
    if (showTower) {
      const tower = createTowerBesideTray(towerColorsRef.current, {}, sides)
      towerRef.current = tower
      stage.add(tower.group)
    }

    frameCamera(camera, stage)

    function resize() {
      if (!container) return
      const size = Math.min(container.clientWidth, container.clientHeight)
      if (size <= 0) return
      renderer.setSize(size, size)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    /**
     * O relógio da BANDEIRA. Ela ondula por fórmula sobre o tempo acumulado (ver `createFlag`), e
     * sem isto a torre da prévia ficaria com o pano duro — a peça que a pessoa está pintando parada,
     * enquanto na mesa de verdade ela mexe.
     */
    let segundos = 0
    const stopLoop = startPreviewLoop((delta) => {
      stage.rotation.y += delta * ROTATION_SPEED
      segundos += delta
      towerRef.current?.update(segundos)
      renderer.render(scene, camera)
    })

    return () => {
      stopLoop()
      resizeObserver.disconnect()
      disposeScene(scene)
      disposePreviewRenderer(renderer, container)
      trayRef.current = null
      caseRef.current = null
      towerRef.current = null
    }
    // Só no mount: as cores entram pelos efeitos abaixo, sem remontar a cena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trayShape, showTower]) // forma e presença da torre reconstroem: a geometria nasce na montagem

  useEffect(() => {
    const wall = hexStringToNumber(wallColor)
    const floor = hexStringToNumber(floorColor)
    trayRef.current?.updateColors(wall, floor)
    // O estojo também troca de cor no lugar agora (`updateColors` em `ShelfCaseHandle`). Antes ele
    // era reconstruído inteiro — geometria, materiais e as texturas de madeira 512×512 refeitas
    // pixel a pixel — a cada mudança de cor, com um debounce só pra segurar o estrago enquanto o
    // seletor era arrastado. Sem reconstrução não sobra nada pra segurar: a prévia acompanha o
    // seletor no mesmo frame.
    caseRef.current?.updateColors(floor, wall)
  }, [wallColor, floorColor])

  /**
   * Mesma ideia pras quatro cores da torre: `updateColors` tinge os materiais que já existem, então
   * arrastar a roda de cores acompanha no mesmo quadro. Reconstruir aqui seria ainda pior que na
   * bandeja — a casca, as ameias, a cornija e o portão dividem a textura de tijolo procedural.
   */
  useEffect(() => {
    towerRef.current?.updateColors(towerColors)
  }, [towerColors])

  return <div ref={containerRef} className="style-preview" />
}
