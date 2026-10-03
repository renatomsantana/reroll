import * as THREE from 'three'
import pixelGrassUrl from '@renderer/assets/textures/grass-pixel.webp'

/** Textura em pixel art para o tampo da mesa; uma imagem única evita emendas visíveis. */
export function loadGrassTexture(onLoad: (texture: THREE.Texture) => void): void {
  const texture = new THREE.TextureLoader().load(pixelGrassUrl, onLoad)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.anisotropy = 8
}
