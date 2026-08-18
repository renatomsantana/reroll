import * as THREE from 'three'
import type { DiceDefinition } from '@shared/types/dice3d'
import type { FaceReading } from '../faceReading/readTopFace'

const DEBUG_COLOR = {
  collider: 0x00e5ff,
  boundingBox: 0xff00ff,
  bestNormal: 0x33ff33,
  secondNormal: 0xffcc00
} as const

export interface DiceDebugVisuals {
  /** Reorienta as setas de normal conforme a leitura de face atual — chamar todo frame. */
  updateReading: (reading: FaceReading) => void
  /** Remove os helpers do mesh e libera geometria/material da GPU. */
  dispose: () => void
}

/**
 * Anexa helpers visuais de depuração (Seção 25 do script.md) como FILHOS do
 * mesh do dado — herdam a transformação dele de graça (posição/rotação já
 * sincronizadas por `syncMeshToBody` todo frame), sem precisar de nenhuma
 * cópia manual de matriz aqui.
 *
 * O wireframe usa a MESMA geometria do mesh, que por sua vez é a mesma usada
 * pra construir o collider físico em `createPolyhedronBody`/`createD6Body` —
 * ele representa o colisor real do dado, não uma caixa/esfera aproximada.
 */
export function createDiceDebugVisuals(definition: DiceDefinition, mesh: THREE.Mesh): DiceDebugVisuals {
  mesh.geometry.computeBoundingBox()

  const wireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: DEBUG_COLOR.collider, transparent: true, opacity: 0.5 })
  )

  const box = new THREE.Box3Helper(mesh.geometry.boundingBox as THREE.Box3, DEBUG_COLOR.boundingBox)

  // Comprimento em unidades JÁ escaladas (a geometria do mesh é construída pré-escalada,
  // ver `buildPolyhedronVisual`/`buildD4Visual`/`buildD6Visual`), senão as setas ficariam
  // minúsculas ou gigantes dependendo do tipo de dado.
  const arrowLength = definition.boundingRadius * definition.scale * 1.5
  const origin = new THREE.Vector3(0, 0, 0)
  const bestArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, arrowLength, DEBUG_COLOR.bestNormal)
  const secondArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    origin,
    arrowLength * 0.75,
    DEBUG_COLOR.secondNormal
  )

  mesh.add(wireframe, box, bestArrow, secondArrow)

  const normalById = new Map(definition.faces.map((face) => [face.id, face.normal]))

  function pointArrowAtFace(arrow: THREE.ArrowHelper, faceId: number): void {
    const normal = normalById.get(faceId)
    if (!normal) return
    // Direção em espaço LOCAL do mesh — sendo o arrow filho do mesh, a rotação do
    // corpo rígido (já aplicada ao mesh por `syncMeshToBody`) orienta a seta sozinha,
    // sem repetir aqui a mesma rotação de quaternion que `readTopFace` já fez.
    arrow.setDirection(new THREE.Vector3(...normal).normalize())
  }

  return {
    updateReading(reading) {
      pointArrowAtFace(bestArrow, reading.faceId)
      pointArrowAtFace(secondArrow, reading.secondFaceId)
    },
    dispose() {
      mesh.remove(wireframe, box, bestArrow, secondArrow)
      wireframe.geometry.dispose()
      wireframe.material.dispose()
      box.dispose()
      bestArrow.dispose()
      secondArrow.dispose()
    }
  }
}
