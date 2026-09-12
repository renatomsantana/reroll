import { useEffect, useRef, useState } from 'react'
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
  /** As cores da flor 1 e da flor 2 do dado de resina. */
  flor1: string
  flor2: string
}

/**
 * Preview estática (sem física) de como o dado vai ficar com a cor/acabamento escolhidos —
 * pedido do usuário: antes só dava pra ver o resultado voltando pra aba "Rolagem" e rolando de
 * novo. Cena própria bem mais simples que `DiceCanvasMulti` (um dado só, sem Rapier, sem
 * bandeja/torre) — só um `requestAnimationFrame` girando o dado devagar, então o custo extra de
 * ter uma segunda cena WebGL rodando é pequeno (nada de física, nada de múltiplos dados).
 */
/** A primeira cor de fundo opaca subindo do elemento pelos pais; cinza do 98 se nenhum tiver. */
function corDeFundoOpaca(elemento: HTMLElement): THREE.Color {
  let atual: HTMLElement | null = elemento
  while (atual) {
    const fundo = getComputedStyle(atual).backgroundColor
    const partes = fundo.match(/[\d.]+/g)
    if (partes && partes.length >= 3 && (partes.length === 3 || Number(partes[3]) > 0)) {
      return new THREE.Color(Number(partes[0]) / 255, Number(partes[1]) / 255, Number(partes[2]) / 255)
    }
    atual = atual.parentElement
  }
  return new THREE.Color('#c0c0c0')
}

export function StylePreview({ sides, bodyColor, numberColor, material, flor1, flor2 }: StylePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  /**
   * Cache PRÓPRIO da prévia (o global de `textureCache.ts` é da cena principal, que o esvazia a cada
   * troca de cor). Sem ele, percorrer a grade de doze paletas redesenhava o atlas de números inteiro em
   * toda parada do mouse — até cem números no d100 — mesmo pra uma cor já vista um clique antes.
   *
   * O teto existe porque a chave inclui a cor: arrastar o seletor gera uma entrada nova por tom, e sem
   * limite o mapa cresceria pelo tempo que a aba ficasse aberta. Ao estourar, esvazia tudo em vez de
   * expulsar o mais antigo — a lista é curta, e o que se perde é o atalho de uma cor que não vai voltar.
   */
  const textureCacheRef = useRef<DiceTextureCache>(new Map())

  /**
   * QUANTAS VEZES A CENA JÁ NASCEU. Conserta um defeito que chegou ao usuário: entrando na aba Estilo,
   * a bandeja aparecia e O DADO NÃO, só depois de mexer numa cor ou no tipo do dado.
   *
   * A causa é a ordem, e virou defeito no dia em que a montagem passou a esperar dois quadros: quem CRIA
   * o dado é o efeito das cores, e a primeira coisa que ele faz é desistir se a cena ainda não existe.
   * Na primeira passagem ela nunca existe, e as dependências dele são props de aparência, que não mudam
   * sozinhas — então ele não rodava de novo e o dado ficava por criar numa cena vazia já sendo
   * desenhada. A `TrayPreview` não tem o problema porque lá a geometria nasce dentro da montagem.
   *
   * CONTADOR e não booleano: em `StrictMode` o React monta, desmonta e monta de novo, e um booleano que
   * já está `true` não provoca render nenhum na segunda montagem — o defeito voltaria só em
   * desenvolvimento, que é o pior lugar pra ele se esconder.
   */
  const [geracaoDaCena, setGeracaoDaCena] = useState(0)

  /**
   * A MONTAGEM ESPERA UM QUADRO, e essa linha é o conserto de um engasgo medido: criar um
   * `WebGLRenderer` custa ~15ms, e a aba Estilo cria DOIS mais as cenas, luzes e texturas de cada um,
   * tudo no mesmo quadro em que a aba aparece — medido no app instalado, 66ms, quatro quadros perdidos.
   * Adiando, a aba PINTA primeiro e a prévia entra logo depois.
   *
   * DOIS `requestAnimationFrame` aninhados, e não um: o callback do rAF roda ANTES da pintura do quadro,
   * então adiar um só empurra o trabalho pra dentro do mesmo quadro e a medição não muda. O `cancelado`
   * impede o caso feio — trocar de aba rápido demais criaria um renderer que ninguém iria descartar.
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let desmontar: (() => void) | null = null
    let cancelado = false
    let agendado = requestAnimationFrame(() => {
      agendado = requestAnimationFrame(() => {
        if (cancelado) return
        desmontar = montarPrevia(container)
      })
    })

    return () => {
      cancelado = true
      cancelAnimationFrame(agendado)
      desmontar?.()
    }
  }, [])

  /** Tudo o que a prévia precisa criar. Devolve a função que descarta. */
  function montarPrevia(container: HTMLDivElement): () => void {
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20)
    camera.position.copy(CAMERA_DIRECTION).multiplyScalar(3.8)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(previewPixelRatio())
    /**
     * Fundo OPACO na cor do painel, e não transparente: a tinta do dado de resina multiplica o que
     * está atrás dela (ver `inclusaoDeResina.ts`), e sobre um canvas transparente não há o que
     * multiplicar, o dado saía sem cor. A cor vem do CSS de quem envolve a prévia, então o tema
     * (dia/noite) continua mandando.
     */
    renderer.setClearColor(corDeFundoOpaca(container), 1)
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

    /**
     * O cache é capturado numa variável AQUI, e não lido de `.current` dentro da limpeza.
     *
     * Na prática dá no mesmo — o `Map` é criado uma vez e nunca trocado, só mutado. Mas a limpeza
     * roda muito depois, e a regra que aponta isso está apontando uma classe de defeito real: no
     * dia em que alguém trocar o `Map` inteiro (`textureCacheRef.current = new Map()`), a limpeza
     * passaria a descartar as texturas do mapa NOVO e vazaria as do antigo — uma por número, por
     * cor, em silêncio. Capturar agora custa uma linha e fecha isso pra sempre.
     */
    const cacheDeTexturas = textureCacheRef.current

    // A CENA EXISTE A PARTIR DAQUI — e é isto que faz o efeito das cores rodar de novo e criar o
    // dado. Ver o comentário de `geracaoDaCena` lá em cima: sem esta linha a prévia fica vazia até
    // a pessoa mexer em alguma coisa.
    setGeracaoDaCena((geracao) => geracao + 1)

    return () => {
      stopLoop()
      resizeObserver.disconnect()
      if (meshRef.current) disposeMesh(meshRef.current)
      for (const texture of cacheDeTexturas.values()) texture.dispose()
      cacheDeTexturas.clear()
      environment.dispose()
      disposeScene(scene)
      disposePreviewRenderer(renderer, container)
      meshRef.current = null
      sceneRef.current = null
      cameraRef.current = null
    }
  }

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
        flores: [flor1, flor2],
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
    // `geracaoDaCena` na lista é o que conserta a prévia vazia — ver o comentário da declaração.
  }, [sides, bodyColor, numberColor, material, flor1, flor2, geracaoDaCena])

  return <div ref={containerRef} className="style-preview" />
}
