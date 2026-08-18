import RAPIER from '@dimforge/rapier3d-compat'
import { WORLD_CONFIG } from '../config/physicsConfig'

/**
 * Cria o mundo físico já configurado com os parâmetros centralizados em
 * `physicsConfig.ts`. Chamar só depois de `ensureRapierReady()` ter resolvido.
 *
 * `gravityOverride` existe só pra torre (`TOWER_CONFIG.gravity`, mais forte que o padrão a
 * pedido do usuário) — a bandeja aberta continua sempre em `WORLD_CONFIG.gravity`.
 */
export function createPhysicsWorld(gravityOverride?: number): RAPIER.World {
  const world = new RAPIER.World({ x: 0, y: gravityOverride ?? WORLD_CONFIG.gravity, z: 0 })
  world.timestep = 1 / WORLD_CONFIG.physicsStepsPerSecond
  world.numSolverIterations = WORLD_CONFIG.solverIterations
  return world
}
