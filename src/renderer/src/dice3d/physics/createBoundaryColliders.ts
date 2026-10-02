import RAPIER from '@dimforge/rapier3d-compat'
import { SPAWN_CONFIG, TRAY_CONFIG } from '../config/physicsConfig'
import { trayApothem, trayRotation } from '../geometry/trayShape'
import { FLOOR_COLLISION_GROUPS, WALL_COLLISION_GROUPS } from './collisionGroups'
import { createRingWall } from './createRingWall'
import { regularPolygonCircumradius } from './regularPolygon'

/**
 * Corpos rígidos fixos (chão + parede hexagonal) que espelham as dimensões dos meshes visuais
 * criados em `scene/createScene.ts` — EXCETO a altura da parede: o collider físico usa
 * `wallColliderHeight` (bem mais alto que o `wallHeight` visual), não porque o desenho na
 * tela mudou, mas porque a função da parede física mudou (ver comentário de
 * `wallColliderHeight` em `physicsConfig.ts`).
 */
export interface BoundaryColliders {
  /** Único piso físico da cena, usado para detectar a primeira batida. */
  floorHandles: Set<number>
}

export function createBoundaryColliders(
  world: RAPIER.World,
  sides = TRAY_CONFIG.wallSegments
): BoundaryColliders {
  const { wallColliderHeight, floorThickness } = TRAY_CONFIG
  /**
   * O apótema sai da FORMA escolhida, não da config: a bandeja pode ser triângulo, quadrado,
   * hexágono ou círculo, e todas ocupam a mesma pegada (ver `trayApothem`). O collider e a malha
   * visual leem daqui, então continuam sendo exatamente a mesma geometria.
   */
  const apothem = trayApothem(sides)
  const wallSegments = sides
  const circumradius = regularPolygonCircumradius(apothem, wallSegments)

  /**
   * Um piso físico só, contínuo e maior que a bandeja. Ele pega o dado que nasce fora da parede e
   * evita qualquer vão no resgate de entrada. O desenho segue sendo o polígono da bandeja; este
   * collider amplo é deliberadamente invisível. Antes havia este piso E outro circular ocupando a
   * mesma área, fazendo cada dado resolver duas colisões no centro da bandeja.
   */
  const safetyFloorHalf = circumradius + SPAWN_CONFIG.launchOutsideDistance + 5
  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const floorCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(safetyFloorHalf, floorThickness / 2, safetyFloorHalf)
      .setTranslation(0, -floorThickness / 2, 0)
      .setCollisionGroups(FLOOR_COLLISION_GROUPS)
      // O som nasce da força da batida, no mesmo passo físico que freia o dado.
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(0.01),
    floorBody
  )

  createRingWall(world, {
    radius: apothem,
    segments: wallSegments,
    rotation: trayRotation(wallSegments),
    bottomY: 0,
    topY: wallColliderHeight,
    groups: WALL_COLLISION_GROUPS
  })

  return { floorHandles: new Set([floorCollider.handle]) }
}
