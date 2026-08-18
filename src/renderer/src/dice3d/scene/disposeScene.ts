import * as THREE from 'three'

/**
 * Percorre a cena (ou qualquer sub-hierarquia, ex.: um `THREE.Group`) inteira liberando
 * geometrias, materiais e texturas do GPU. O garbage collector do JS não sabe nada sobre
 * memória de vídeo — sem isso, trocar de dado/tela repetidamente vaza VRAM até o app engasgar.
 * Aceita `Object3D` (não só `Scene`) porque `traverse` é da classe base — reaproveitado também
 * pra descartar o estojo de dados (`THREE.Group` com várias paredes/divisórias, ver
 * `createShelfCaseMesh` em `DiceCanvasMulti.tsx`), não só a cena inteira.
 */
export function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    disposeMesh(object)
  })
}

/** Libera a geometria e o(s) material(is)/textura(s) de UM mesh — mesma lógica de `disposeScene`, reutilizável quando só um mesh é trocado (ex.: reconstruir um dado ao mudar de cor, sem remontar a cena inteira). */
export function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose()
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of materials) {
    disposeMaterial(material)
  }
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose()
    }
  }
  material.dispose()
}
