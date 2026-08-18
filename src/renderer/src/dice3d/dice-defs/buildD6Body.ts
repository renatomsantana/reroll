import RAPIER from '@dimforge/rapier3d-compat'
import { D6_DEFINITION } from './d6'
import { tossDie } from '../physics/tossDie'
import { diceNormalCollisionGroups } from '../physics/collisionGroups'

export { tossDie as tossD6 }

/**
 * Cria o corpo rígido dinâmico do d6, na origem, sem velocidade — quem chama
 * é responsável por chamar `tossDie`/`tossD6` antes do primeiro uso (todo
 * chamador atual já faz isso imediatamente após criar o corpo). O corpo é
 * reaproveitado entre rolagens — só a transformação e a velocidade são
 * resetadas a cada rolagem (ver `tossDie`), sem recriar collider.
 */
export function createD6Body(world: RAPIER.World): RAPIER.RigidBody {
  const half = D6_DEFINITION.scale / 2

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setLinearDamping(D6_DEFINITION.physics.linearDamping)
      .setAngularDamping(D6_DEFINITION.physics.angularDamping)
  )

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(half, half, half)
      .setRestitution(D6_DEFINITION.physics.restitution)
      .setFriction(D6_DEFINITION.physics.friction)
      .setMass(D6_DEFINITION.physics.mass)
      .setCollisionGroups(diceNormalCollisionGroups()),
    body
  )

  return body
}
