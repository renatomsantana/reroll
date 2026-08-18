import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { TOWER_CONFIG } from '../config/physicsConfig'
import { randomInRange, randomQuaternion } from '../utils/random'
import { diceDescendingCollisionGroups, TOWER_D100_PHYSICS_OVERRIDE } from './collisionGroups'

/**
 * Solta um dado no topo da torre (mecanismo de prateleiras/baffles — ver `buildTowerBaffles.ts`)
 * — nasce em queda livre curta (não encostado como a antiga rampa em espiral, já que aqui NÃO
 * há uma superfície logo abaixo pra "nascer encostado nela": a primeira prateleira fica a
 * `TOWER_CONFIG.topClearance` de distância). Pequeno jitter horizontal (`spawnJitter`) evita que
 * o dado sempre caia exatamente no mesmo pixel da primeira prateleira, sem risco de sair da área
 * coberta por ela (a prateleira cobre a maior parte do diâmetro, ver `baffleSpanFraction`).
 *
 * `sides` — usado só pra um caso especial: o D100 (`d100Sphere.ts`) tem atrito MÁXIMO
 * (`friction: 1`) e restituição bem baixa, tunado de propósito pra "grudar" na bandeja aberta
 * (sem isso, uma esfera quase perfeita rola pra sempre). Esse mesmo tuning, MEDIDO nesta sessão
 * (teste headless cobrindo os 7 tipos de dado), faz o D100 ficar preso por MINUTOS simulados no
 * mecanismo de prateleiras — o atrito máximo "engole" cada empurrão de recuperação quase inteiro
 * no mesmo frame. Ver `TOWER_D100_PHYSICS_OVERRIDE`/`exitTowerIfDescended` em
 * `collisionGroups.ts` pro contexto completo da correção (atrito reduzido só ENQUANTO dentro da
 * torre, restaurado ao sair).
 */
export function dropDieIntoTower(body: RAPIER.RigidBody, topY: number, sides: PhysicalDiceSides): void {
  if (body.numColliders() > 0) {
    const collider = body.collider(0)
    collider.setCollisionGroups(diceDescendingCollisionGroups())
    if (sides === 100) {
      collider.setFriction(TOWER_D100_PHYSICS_OVERRIDE.friction)
      collider.setRestitution(TOWER_D100_PHYSICS_OVERRIDE.restitution)
    }
  }

  const spawnJitter = 0.3
  body.setTranslation({ x: randomInRange([-spawnJitter, spawnJitter]), y: topY, z: randomInRange([-spawnJitter, spawnJitter]) }, true)

  const [qx, qy, qz, qw] = randomQuaternion()
  body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)

  body.setLinvel({ x: 0, y: 0, z: 0 }, true)

  const torque = 0.4
  body.setAngvel(
    { x: randomInRange([-torque, torque]), y: randomInRange([-torque, torque]), z: randomInRange([-torque, torque]) },
    true
  )

  // Soft-CCD ligado o tempo todo dentro da torre (só desliga ao sair, ver `exitTowerIfDescended`)
  // — os impactos contra as prateleiras são mais rápidos que uma queda comum na bandeja aberta.
  body.setSoftCcdPrediction(TOWER_CONFIG.softCcdPrediction)
}
