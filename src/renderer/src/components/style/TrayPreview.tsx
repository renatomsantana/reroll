import { useEffect, useRef } from 'react'
import { TRAY_SHAPE_SIDES, type TrayShape } from '@renderer/dice3d/geometry/trayShape'
import * as THREE from 'three'
import {
  createTrayPreview,
  TABLE_SURFACE_Y,
  type TrayPreviewHandle
} from '@renderer/dice3d/scene/createScene'
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

interface TrayPreviewProps {
  wallColor: string
  floorColor: string
  /** A prévia mostra a FORMA escolhida — se ela mostrasse hexágono sempre, ensinaria errado. */
  trayShape: TrayShape
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
export function TrayPreview({ wallColor, floorColor, trayShape }: TrayPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<TrayPreviewHandle | null>(null)
  const caseRef = useRef<ShelfCaseHandle | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    /**
     * Bandeja e estojo giram JUNTOS, num grupo só. Girar só a bandeja deixaria o estojo parado ao
     * lado dela, como se os dois não fizessem parte da mesma mesa.
     */
    const stage = new THREE.Group()
    scene.add(stage)

    /**
     * Enquadramento calculado, não tentado. A bandeja tem raio externo ~8.5 e o ESTOJO mora em
     * z ≈ -10 (ver `computeShelfPositions`), então a cena vai de z≈+8.5 a z≈-10.6: quase 20 de
     * profundidade. Com `fov` 45 (meia abertura 22.5°) isso pede uns 25 de distância pra caber com
     * folga, e a mira desce pra `z = -2` pra dividir a sobra entre bandeja e estojo em vez de
     * deixar o estojo raspando a borda de cima.
     */
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 16, 21)
    camera.lookAt(0, 0, -2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(previewPixelRatio())
    container.appendChild(renderer.domElement)

    // Mesma proporção de luz da cena principal (ambiente forte + direcional quente), pra cor
    // escolhida aqui sair igual à que vai aparecer lá.
    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    const directional = new THREE.DirectionalLight(0xfff4e0, 1.3)
    directional.position.set(5, 10, 5)
    scene.add(ambient, directional)

    const tray = createTrayPreview(hexStringToNumber(wallColor), hexStringToNumber(floorColor), TRAY_SHAPE_SIDES[trayShape])
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

    const stopLoop = startPreviewLoop((delta) => {
      stage.rotation.y += delta * ROTATION_SPEED
      renderer.render(scene, camera)
    })

    return () => {
      stopLoop()
      resizeObserver.disconnect()
      disposeScene(scene)
      disposePreviewRenderer(renderer, container)
      trayRef.current = null
      caseRef.current = null
    }
    // Só no mount: as cores entram pelo efeito abaixo, sem remontar a cena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trayShape])  // a forma reconstrói a prévia: a geometria é criada na montagem

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

  return <div ref={containerRef} className="style-preview" />
}
