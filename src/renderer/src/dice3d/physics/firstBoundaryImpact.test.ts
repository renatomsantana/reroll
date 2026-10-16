import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { createBoundaryColliders } from './createBoundaryColliders'
import { diceNormalCollisionGroups } from './collisionGroups'
import { createPhysicsWorld } from './createPhysicsWorld'
import { ensureRapierReady } from './rapierContext'

describe('primeiro impacto da explosão', () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  it('entrega o contato do dado com uma parede da bandeja no próprio passo físico', () => {
    const world = createPhysicsWorld(0)
    const boundary = createBoundaryColliders(world)
    const queue = new RAPIER.EventQueue(true)

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.5, 0).setLinvel(24, 0, 0)
    )
    const die = world.createCollider(
      RAPIER.ColliderDesc.ball(0.5)
        .setCollisionGroups(diceNormalCollisionGroups())
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(0.01),
      body
    )

    let hitWall = false
    for (let step = 0; step < 180 && !hitWall; step++) {
      world.step(queue)
      queue.drainContactForceEvents((event) => {
        const first = event.collider1()
        const second = event.collider2()
        const boundaryHandle = boundary.boundaryHandles.has(first)
          ? first
          : boundary.boundaryHandles.has(second)
            ? second
            : null
        if (boundaryHandle === null || boundary.floorHandles.has(boundaryHandle)) return
        hitWall = first === die.handle || second === die.handle
      })
    }

    expect(hitWall).toBe(true)
    queue.free()
    world.free()
  })
})
