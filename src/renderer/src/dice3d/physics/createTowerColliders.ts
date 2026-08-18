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
   * Prateleiras (baffles) — um cuboide ARREDONDADO (`roundCuboid`, não `cuboid`) fixo por
   * prateleira, mesmo transform do mesh visual (ver `createTowerScene.ts`). `new
   * RAPIER.Quaternion(...)` explícito (não um objeto literal `{x,y,z,w}`) — mesmo padrão já
   * usado em `createRingWall.ts`, necessário pro binding do Rapier aceitar a rotação de verdade.
   *
   * BUG REAL medido nesta sessão (teste headless cobrindo os 7 tipos de dado, não só o d6): D20
   * (icosaédrico) e D100 (quase esférico) ficavam PERMANENTEMENTE presos, 0/20 tentativas cada,
   * sempre na QUINA AFIADA da borda de uma prateleira (confirmado com um traço de
   * posição/velocidade: o dado assentava exatamente na altura da borda, além do próprio
   * comprimento da prateleira — ou seja, na quina em si, não em cima da superfície). Uma forma
   * com muitas facetas quase planas encontra um encaixe mecanicamente estável contra um canto de
   * 90°, que formas mais angulares (D4-D12) simplesmente não encontram. Nem um empurrão de
   * recuperação bem mais forte (`applyTowerStuckNudge.ts`) resolvia de forma confiável — o dado
   * voltava a assentar na mesma quina.
   *
   * Corrigido na RAIZ (não só tentando empurrar mais forte): arredondar a borda do collider
   * (`baffleEdgeRadius`) elimina a quina de 90° em si — o próprio `dice_tower_parametric_prompt.md`
   * já pedia isso (`fillet_dice_contact`, "anywhere a die can strike or slide"), só não tinha sido
   * aplicado ainda no collider físico (só no visual seria insuficiente, o dado colide com a
   * FÍSICA). Com a quina arredondada, um dado que chega até a borda desliza/tomba por cima dela
   * de forma suave, igual uma rampa de skate, em vez de poder se equilibrar num canto reto.
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
