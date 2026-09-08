import RAPIER from '@dimforge/rapier3d-compat'
import { WORLD_CONFIG } from '../config/physicsConfig'

/**
 * `requestAnimationFrame` entrega deltas variáveis e o Rapier precisa de passos de tamanho fixo pra
 * ficar estável: este é o acumulador clássico de fixed-timestep, com a sobra de tempo entre frames
 * consumida em passos de `dt` constante e o resto guardado pro próximo.
 *
 * `maxStepsPerFrame` evita a espiral da morte quando a aba volta de segundo plano. O `deltaSeconds` é
 * limitado ANTES de entrar no acumulador, e não só o número de passos por frame: sem isso o excedente
 * represado ficava acumulado e era consumido em vários frames seguidos, ou seja, física correndo vários
 * múltiplos mais rápido que o normal até zerar o atraso. Descartar o excedente é a escolha certa —
 * perder um pedaço de tempo parado em segundo plano é imperceptível, física em câmera acelerada não é.
 *
 * Devolve os SEGUNDOS DE FÍSICA REALMENTE SIMULADOS (`steps * fixedDt`), e nunca o `deltaSeconds`
 * bruto, porque quem chama alimenta o `SettleTracker` com esse valor: com o frame rate baixo o bruto
 * pode ficar bem maior que o tempo de física avançado, e o cronômetro de "parado" andaria rápido demais
 * em relação à física — ora declarando emperrado antes da hora, ora aceitando um resultado prematuro.
 */
export function createPhysicsStepper(world: RAPIER.World) {
  const fixedDt = 1 / WORLD_CONFIG.physicsStepsPerSecond
  let accumulator = 0

  const maxAccumulableSeconds = WORLD_CONFIG.maxStepsPerFrame * fixedDt

  return function step(deltaSeconds: number): number {
    accumulator += Math.min(deltaSeconds, maxAccumulableSeconds)
    let steps = 0
    while (accumulator >= fixedDt && steps < WORLD_CONFIG.maxStepsPerFrame) {
      world.step()
      accumulator -= fixedDt
      steps += 1
    }
    return steps * fixedDt
  }
}
