import * as THREE from 'three'
import { CAMERA_CONFIG } from '../config/sceneConfig'

interface CameraConfig {
  fov: number
  near: number
  far: number
  position: readonly [number, number, number]
  lookAt: readonly [number, number, number]
}

/**
 * Câmera fixa em perspectiva. Não participa da simulação física de forma
 * alguma — só observa. Aceita um config diferente (ver `TOWER_CAMERA_CONFIG`) pro modo torre,
 * uma cena bem mais alta que a bandeja aberta e que precisa de outro enquadramento — padrão
 * `CAMERA_CONFIG` (bandeja aberta) quando omitido.
 */
export function createCamera(aspect: number, config: CameraConfig = CAMERA_CONFIG): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(config.fov, aspect, config.near, config.far)
  camera.position.set(...config.position)
  camera.lookAt(...config.lookAt)
  return camera
}
