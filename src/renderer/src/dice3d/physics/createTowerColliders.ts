import RAPIER from '@dimforge/rapier3d-compat'
import { TOWER_CONFIG, EXIT_PLATFORM_CONFIG } from '../config/physicsConfig'
import { computeBaffleTransforms, computeTowerExitAngle, TOWER_TOP_Y } from '../geometry/buildTowerBaffles'
import { FLOOR_COLLISION_GROUPS, TOWER_COLLISION_GROUPS } from './collisionGroups'
import { createRingWall } from './createRingWall'

/**
 * Corpos rígidos fixos da cena "torre" (modo de lançamento alternativo, ver `TOWER_CONFIG`):
 * chão da base (rede de segurança invisível, sem parede própria — ver comentário abaixo),
 * prateleiras (baffles) fixas e a parede externa da torre (polígono de cuboides via
 * `createRingWall`, compartilhado com a parede hexagonal da bandeja — aqui com muitos
 * segmentos, lê como um círculo).
 */
export function createTowerColliders(world: RAPIER.World): void {
  /**
   * Chão da praça da base — SEM parede ao redor (removida a pedido do usuário, ver
   * `createTowerScene.ts`). Sem uma parede pra conter um dado que role até a borda, o collider
   * físico do chão precisa ser BEM maior que o hexágono visual (`baseFloorRadius`) — mesma "rede
   * de segurança" invisível que `createBoundaryColliders.ts` já usa pra bandeja aberta.
   */
  const { baseFloorRadius } = TOWER_CONFIG
  const safetyFloorRadius = baseFloorRadius + 10

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.1, safetyFloorRadius)
      .setTranslation(0, -0.1, 0)
      .setCollisionGroups(FLOOR_COLLISION_GROUPS),
    floorBody
  )

  /**
   * Prateleiras: um cuboide ARREDONDADO (`roundCuboid`, não `cuboid`) por prateleira, com o mesmo
   * transform do mesh visual. `new RAPIER.Quaternion(...)` explícito, e não um objeto literal, é o
   * mesmo padrão de `createRingWall.ts` — o binding do Rapier só aceita a rotação assim.
   *
   * BUG REAL medido com o teste headless dos 7 tipos de dado: d20 e d100 ficavam permanentemente
   * presos, 0 de 20 tentativas cada, sempre na QUINA AFIADA da borda de uma prateleira (confirmado com
   * um traço de posição: o dado assentava exatamente na altura da borda, além do comprimento da
   * prateleira, ou seja na quina em si). Uma forma com muitas facetas quase planas encontra um encaixe
   * mecanicamente estável contra um canto de 90° que d4-d12 não encontram, e nem um empurrão de
   * recuperação bem mais forte resolvia.
   *
   * Corrigido na RAIZ: arredondar a borda do collider elimina a quina. O próprio spec da torre já pedia
   * isso ("anywhere a die can strike or slide"), e só no visual seria inútil — o dado colide com a
   * FÍSICA. Com a quina arredondada, o dado que chega à borda tomba por cima dela como numa rampa.
   */
  const edgeRadius = TOWER_CONFIG.baffleEdgeRadius
  for (const baffle of computeBaffleTransforms()) {
    const baffleBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(
        baffle.length / 2 - edgeRadius,
        baffle.thickness / 2 - edgeRadius,
        baffle.width / 2 - edgeRadius,
        edgeRadius
      )
        .setTranslation(baffle.position.x, baffle.position.y, baffle.position.z)
        .setRotation(
          new RAPIER.Quaternion(baffle.quaternion.x, baffle.quaternion.y, baffle.quaternion.z, baffle.quaternion.w)
        )
        .setCollisionGroups(TOWER_COLLISION_GROUPS),
      baffleBody
    )
  }

  /**
   * Parede externa da torre (polígono de cuboides) — fecha ao redor da base, exceto na lacuna
   * angular do portão (`computeTowerExitAngle`/`gateArcWidth`, ver `buildTowerShellGeometry.ts` —
   * sempre a mesma posição, física e visual nunca podem discordar). Acima do portão, a parede
   * volta a ser um anel fechado normal, cobrindo até o topo da torre.
   */
  const gate = {
    angleRad: computeTowerExitAngle(),
    halfWidthRad: TOWER_CONFIG.gateArcWidth / 2 / TOWER_CONFIG.shellApothem
  }
  createRingWall(world, {
    radius: TOWER_CONFIG.shellApothem,
    segments: TOWER_CONFIG.shellSegments,
    bottomY: 0,
    topY: TOWER_CONFIG.gateHeight,
    groups: TOWER_COLLISION_GROUPS,
    gate
  })
  createRingWall(world, {
    radius: TOWER_CONFIG.shellApothem,
    segments: TOWER_CONFIG.shellSegments,
    bottomY: TOWER_CONFIG.gateHeight,
    topY: TOWER_TOP_Y + TOWER_CONFIG.shellTopMargin,
    groups: TOWER_COLLISION_GROUPS
  })

  /**
   * Collider da "mini área de aterrissagem" (ver `createExitLandingPlatform` em
   * `createTowerScene.ts`, que desenha o MESMO tamanho/posição a partir dos mesmos
   * `EXIT_PLATFORM_CONFIG`/`shellApothem` — nunca duplicar o número aqui). Centro em
   * `shellApothem + radius` pra a borda mais próxima da torre encostar exatamente na parede, sem
   * sobrepor.
   */
  const platformAngle = computeTowerExitAngle()
  const platformDistance = TOWER_CONFIG.shellApothem + EXIT_PLATFORM_CONFIG.radius
  const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(EXIT_PLATFORM_CONFIG.height / 2, EXIT_PLATFORM_CONFIG.radius)
      .setTranslation(
        Math.cos(platformAngle) * platformDistance,
        EXIT_PLATFORM_CONFIG.height / 2,
        Math.sin(platformAngle) * platformDistance
      )
      .setCollisionGroups(FLOOR_COLLISION_GROUPS),
    platformBody
  )
}
