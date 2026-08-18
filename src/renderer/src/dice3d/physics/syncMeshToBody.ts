import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'

/** Copia a transformação do corpo rígido pro mesh Three.js correspondente, a cada frame. */
export function syncMeshToBody(mesh: THREE.Object3D, body: RAPIER.RigidBody): void {
  const t = body.translation()
  const r = body.rotation()
  mesh.position.set(t.x, t.y, t.z)
  mesh.quaternion.set(r.x, r.y, r.z, r.w)
}
