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
export function createBoundaryColliders(world: RAPIER.World, sides = TRAY_CONFIG.wallSegments): void {
  const { wallColliderHeight, floorThickness } = TRAY_CONFIG
  /**
   * O apótema sai da FORMA escolhida, não da config: a bandeja pode ser triângulo, quadrado,
   * hexágono ou círculo, e todas ocupam a mesma pegada (ver `trayApothem`). O collider e a malha
   * visual leem daqui, então continuam sendo exatamente a mesma geometria.
   */
  const apothem = trayApothem(sides)
  const wallSegments = sides
  const circumradius = regularPolygonCircumradius(apothem, wallSegments)

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(floorThickness / 2, circumradius)
      .setTranslation(0, -floorThickness / 2, 0)
      .setCollisionGroups(FLOOR_COLLISION_GROUPS),
    floorBody
  )

  /**
   * Rede de segurança: os dados agora nascem do LADO DE FORA da bandeja (ver `tossDie.ts`),
   * numa área onde o chão acima não cobre (ele só cobre o hexágono por dentro das paredes).
   * Sem isso, um dado cujo arremesso não cruze de volta pra dentro da bandeja a tempo cairia
   * num vazio sem collider nenhum e nunca mais pararia. Colide só com dados (mesmo grupo do
   * chão principal), nunca com a parede — mesmo raciocínio de `collisionGroups.ts`. Continua um
   * cuboide grande (não precisa ser hexagonal — é só uma rede de segurança, nunca visível).
   */
  const safetyFloorHalf = circumradius + SPAWN_CONFIG.launchOutsideDistance + 5
  const safetyFloorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(safetyFloorHalf, floorThickness / 2, safetyFloorHalf)
      .setTranslation(0, -floorThickness / 2, 0)
      .setCollisionGroups(FLOOR_COLLISION_GROUPS),
    safetyFloorBody
  )

  createRingWall(world, {
    radius: apothem,
    segments: wallSegments,
    rotation: trayRotation(wallSegments),
    bottomY: 0,
    topY: wallColliderHeight,
    groups: WALL_COLLISION_GROUPS
  })
}
