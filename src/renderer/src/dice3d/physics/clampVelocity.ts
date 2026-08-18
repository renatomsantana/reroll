import type RAPIER from '@dimforge/rapier3d-compat'

/**
 * Rede de segurança padrão em jogos com física de corpos rígidos: quando dois corpos nascem
 * ligeiramente sobrepostos (ou colidem num ângulo raro/degenerado), o solver de restrições
 * pode resolver a sobreposição/colisão com um impulso de separação bem maior do que qualquer
 * arremesso normal produziria — uma "explosão" de velocidade absurda que nenhuma tunagem de
 * `SPAWN_CONFIG` elimina por completo (é inerente a simular corpos rígidos convexos
 * colidindo). Sem um teto, um dado nessa situação pode escapar da bandeja com velocidade
 * demais pra qualquer parede/chão conter a tempo. Chamado todo frame por dado — barato
 * (uma leitura + comparação; só escreve de volta quando de fato precisa reduzir).
 */
export function clampLinearVelocity(body: RAPIER.RigidBody, maxSpeed: number): void {
  const v = body.linvel()
  const speedSquared = v.x * v.x + v.y * v.y + v.z * v.z
  if (speedSquared <= maxSpeed * maxSpeed) return

  const scale = maxSpeed / Math.sqrt(speedSquared)
  body.setLinvel({ x: v.x * scale, y: v.y * scale, z: v.z * scale }, true)
}
