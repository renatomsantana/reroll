import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { DICE_REGISTRY } from '@renderer/dice3d/dice-defs/registry'
import { setupDiceEnvironment } from '@renderer/dice3d/scene/createDiceEnvironment'
import { disposeScene, disposeMesh } from '@renderer/dice3d/scene/disposeScene'
import type { DiceTextureCache } from '@renderer/dice3d/materials/textureCache'
import type { DiceMaterialFinish } from '@renderer/dice3d/materials/createDiceMaterial'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { disposePreviewRenderer, previewPixelRatio, startPreviewLoop } from './previewLoop'
import './StylePreview.css'

/** Mesma conversão de `DiceRoller3D.tsx` — `buildVisual` espera a cor do corpo como hex numérico, não string CSS. Duplicada de propósito (uma linha, dois lugares), não vale uma abstração compartilhada só pra isso. */
function hexStringToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/** Debounce curto igual ao usado pela cena principal (`DiceCanvasMulti.tsx`) — arrastar o seletor de cor nativo dispara `input` continuamente; sem isso cada evento reconstruiria a textura numérica de cada face do dado (até 100 no d100) na hora. */
const COLOR_UPDATE_DEBOUNCE_MS = 120
const ROTATION_SPEED = 0.5
/**
 * Folga entre o dado e a borda do quadro. A câmera ficava parada a uma distância fixa, boa pro d20
 * e frouxa pro resto: cada tipo tem sua escala (`DiceDefinition.scale`), então o d4 e o d100 saíam
 * bem menores que o espaço disponível. Agora a distância vem do tamanho do próprio dado — o pedido
 * de "aumentar a imagem da prévia" é tanto a caixa maior quanto o dado ocupando ela.
 */
const FRAME_MARGIN = 1.08
/** Direção de onde a câmera olha (um pouco de cima, de frente). Só a DISTÂNCIA muda por tipo de dado. */
const CAMERA_DIRECTION = new THREE.Vector3(0, 2.1, 3.2).normalize()
/** Quantos atlas de número a prévia guarda antes de esvaziar o cache — ver `textureCacheRef`. */
const PREVIEW_TEXTURE_CACHE_LIMIT = 24

interface StylePreviewProps {
  /** Tipo de dado mostrado na preview — pedido do usuário pra ver CADA tipo com a cor dele, não sempre um d20 fixo (ver seleção em `StyleTab.tsx`). */
  sides: PhysicalDiceSides
  bodyColor: string
  numberColor: string
  material: DiceMaterialFinish
}

/**
 * Preview estática (sem física) de como o dado vai ficar com a cor/acabamento escolhidos —
 * pedido do usuário: antes só dava pra ver o resultado voltando pra aba "Rolagem" e rolando de
 * novo. Cena própria bem mais simples que `DiceCanvasMulti` (um dado só, sem Rapier, sem
 * bandeja/torre) — só um `requestAnimationFrame` girando o dado devagar, então o custo extra de
 * ter uma segunda cena WebGL rodando é pequeno (nada de física, nada de múltiplos dados).
 */
export function StylePreview({ sides, bodyColor, numberColor, material }: StylePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  /**
   * Cache PRÓPRIO da prévia (o global de `textureCache.ts` é da cena principal, que o esvazia a
   * cada troca de cor). Sem ele, percorrer a grade de doze paletas redesenhava o atlas de números
   * inteiro em toda parada do mouse — até cem números no d100 — mesmo pra uma cor já vista um
   * clique antes. Com ele, voltar numa cor já experimentada é instantâneo.
   *
   * O teto existe porque a chave inclui a cor: arrastar o seletor gera uma entrada nova por tom
   * experimentado, e sem limite o mapa cresceria pelo tempo que a aba ficasse aberta. Ao estourar,
   * esvazia tudo em vez de expulsar o mais antigo — a lista é curta, e a única coisa que se perde é
   * o atalho de uma cor que provavelmente não vai voltar.
   */
  const textureCacheRef = useRef<DiceTextureCache>(new Map())

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20)
    camera.position.copy(CAMERA_DIRECTION).multiplyScalar(3.8)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(previewPixelRatio())
    container.appendChild(renderer.domElement)

    const environment = setupDiceEnvironment(scene, renderer)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    const directional = new THREE.DirectionalLight(0xfff4e0, 1.4)
    directional.position.set(3, 5, 4)
    scene.add(ambient, directional)

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
      if (meshRef.current) meshRef.current.rotation.y += delta * ROTATION_SPEED
      renderer.render(scene, camera)
    })

    return () => {
      stopLoop()
      resizeObserver.disconnect()
      if (meshRef.current) disposeMesh(meshRef.current)
      for (const texture of textureCacheRef.current.values()) texture.dispose()
      textureCacheRef.current.clear()
      environment.dispose()
      disposeScene(scene)
      disposePreviewRenderer(renderer, container)
      meshRef.current = null
      sceneRef.current = null
      cameraRef.current = null
    }
  }, [])

  const isFirstUpdate = useRef(true)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    function rebuild() {
      if (!scene) return
      const cache = textureCacheRef.current
      if (cache.size >= PREVIEW_TEXTURE_CACHE_LIMIT) {
        for (const texture of cache.values()) texture.dispose()
        cache.clear()
      }
      const entry = DICE_REGISTRY[sides]
      const mesh = entry.buildVisual({
        bodyColor: hexStringToNumber(bodyColor),
        numberColor,
        material,
        textureCache: cache
      })
      if (meshRef.current) {
        scene.remove(meshRef.current)
        disposeMesh(meshRef.current)
        mesh.rotation.copy(meshRef.current.rotation)
      }
      scene.add(mesh)
      meshRef.current = mesh
      frameCamera(mesh)
    }

    /**
     * Afasta a câmera o exato necessário pro dado caber. O raio é medido com o dado DESGIRADO e a
     * partir da origem (o quanto ele se afasta do centro no pior caso), não da caixa girada: assim
     * o enquadramento é o mesmo em qualquer ponto da rotação, em vez de o dado "respirar" pra
     * dentro e pra fora do quadro enquanto gira.
     */
    function frameCamera(mesh: THREE.Mesh): void {
      const camera = cameraRef.current
      if (!camera) return
      const rotation = mesh.rotation.clone()
      mesh.rotation.set(0, 0, 0)
      mesh.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(mesh)
      mesh.rotation.copy(rotation)
      const sphere = bounds.getBoundingSphere(new THREE.Sphere())
      const radius = sphere.center.length() + sphere.radius
      const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2
      camera.position
        .copy(CAMERA_DIRECTION)
        .multiplyScalar((radius / Math.sin(halfFov)) * FRAME_MARGIN)
      camera.lookAt(0, 0, 0)
    }

    // Monta imediato na primeira vez (sem esperar o debounce) — o mount inicial da cena não deve
    // ficar 120ms sem nenhum dado visível.
    if (isFirstUpdate.current) {
      isFirstUpdate.current = false
      rebuild()
      return
    }

    const timeoutId = window.setTimeout(rebuild, COLOR_UPDATE_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [sides, bodyColor, numberColor, material])

  return <div ref={containerRef} className="style-preview" />
}
