import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { DICE_REGISTRY } from '@renderer/dice3d/dice-defs/registry'
import { topoDasLetrasNaFace } from '@renderer/dice3d/geometry/orientacaoDeVitrine'

const RED = 0xe01818
const LOOP_MS = 2700

/** O mesmo mesh, números e material do d20 na bandeja, sem física nem cenário. */
export function WelcomeDie3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const targetCanvas = canvas
    const renderer = new THREE.WebGLRenderer({ canvas: targetCanvas, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20)
    camera.position.set(0, 0, 3.1)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4b0505, 2.15))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3)
    keyLight.position.set(2.5, 3.5, 4)
    scene.add(keyLight)

    const entry = DICE_REGISTRY[20]
    const die = entry.buildVisual({ bodyColor: RED, numberColor: '#ffffff', numberFont: 'rounded', material: 'matte' })
    scene.add(die)

    // A face 20 é alinhada de frente para a câmera e o topo do número fica legível.
    const face20 = entry.definition.faces.find((face) => face.value === 20)
    if (!face20) return
    const rest = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(...face20.normal),
      new THREE.Vector3(0, 0, 1)
    )
    const top = topoDasLetrasNaFace(die.geometry, face20.normal)
    if (top) {
      const turnedTop = new THREE.Vector3(...top).applyQuaternion(rest)
      rest.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(turnedTop.x, turnedTop.y)))
    }

    function resize() {
      const side = Math.max(1, Math.round(targetCanvas.getBoundingClientRect().width))
      renderer.setSize(side, side, false)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(targetCanvas)
    resize()

    let frame = 0
    const startedAt = performance.now()
    const spinAxis = new THREE.Vector3(1, 0.35, 0.25).normalize()
    function render(now: number) {
      const progress = ((now - startedAt) % LOOP_MS) / LOOP_MS
      /*
       * O giro começa e termina na pose `rest`: são exatamente duas voltas completas no mesmo eixo,
       * portanto não existe uma correção escondida puxando o dado para o 20. A curva suave
       * desacelera até zero e o último quarto do ciclo segura o resultado naturalmente.
       */
      const rolling = Math.min(progress / 0.76, 1)
      const smooth = rolling * rolling * (3 - 2 * rolling)
      const voltasRestantes = 1 - smooth
      die.quaternion.copy(rest)
      die.rotateOnAxis(spinAxis, Math.PI * 4 * voltasRestantes)
      die.position.y = Math.abs(Math.sin(rolling * Math.PI * 2)) * (1 - rolling) * 0.12
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      die.geometry.dispose()
      const materials = (Array.isArray(die.material) ? die.material : [die.material]) as THREE.MeshPhysicalMaterial[]
      materials.forEach((material) => {
        material.map?.dispose()
        material.dispose()
      })
      renderer.dispose()
    }
  }, [])

  return <canvas className="web-welcome-die" ref={canvasRef} aria-label="Dado d20 vermelho mostrando 20" />
}
