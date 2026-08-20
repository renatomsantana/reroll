import RAPIER from '@dimforge/rapier3d-compat'
import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { scale as scaleVector } from '../geometry/polyhedronMath'
import { diceNormalCollisionGroups } from './collisionGroups'

/**
 * Cria o corpo rígido dinâmico de um dado poliédrico (d4, d8, d10, d12,
 * d20) com um collider de casco convexo (`convexHull`) construído a partir
 * dos MESMOS vértices usados pra desenhar a malha — o formato de colisão é
 * o formato real do dado, não uma caixa ou esfera aproximada. Nasce na
 * origem, sem velocidade — quem chama é responsável por chamar `tossDie` em
 * seguida (todo chamador atual já faz isso imediatamente após criar o corpo).
 */
export function createPolyhedronBody(
  world: RAPIER.World,
  vertices: Vector3Tuple[],
  definition: DiceDefinition
): RAPIER.RigidBody {
  const scaledVertices = vertices.map((v) => scaleVector(v, definition.scale))
  const points = new Float32Array(scaledVertices.length * 3)
  scaledVertices.forEach((v, i) => points.set(v, i * 3))

  const colliderDesc = RAPIER.ColliderDesc.convexHull(points)
  if (!colliderDesc) {
    throw new Error(
      `Não foi possível construir o casco convexo do d${definition.type} — verifique os vértices`
    )
  }

    const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setLinearDamping(definition.physics.linearDamping)
      .setAngularDamping(definition.physics.angularDamping)
  )

  world.createCollider(
    colliderDesc
      .setRestitution(definition.physics.restitution)
      .setFriction(definition.physics.friction)
      .setMass(definition.physics.mass)
      .setCollisionGroups(diceNormalCollisionGroups()),
    body
  )

  return body
}
