import RAPIER from '@dimforge/rapier3d-compat'
import { WORLD_CONFIG } from '../config/physicsConfig'

/**
 * `requestAnimationFrame` entrega deltas variáveis (depende do monitor, da
 * carga da máquina etc.), mas o Rapier precisa de passos de tamanho fixo pra
 * ficar estável. Isso é o acumulador clássico de fixed-timestep: sobra de
 * tempo entre frames se acumula e é consumida em passos de tamanho `dt`
 * constante, sobrando o resto pro próximo frame.
 *
 * `maxStepsPerFrame` evita a "espiral da morte": se a aba ficou em segundo
 * plano por alguns segundos, não tentamos simular todo esse tempo de uma vez
 * quando ela volta. O `deltaSeconds` recebido é limitado ANTES de entrar no
 * acumulador (não só o número de passos por frame) — sem esse limite, o
 * excedente de tempo represado (janela minimizada, GPU travada) ficava
 * acumulado e era consumido em vários frames seguidos a `maxStepsPerFrame`
 * passos cada, ou seja, física correndo vários múltiplos mais rápido que o
 * normal (um "avanço rápido" visível) até zerar o atraso. Descartar o
 * excedente é a escolha certa aqui: perder um pedaço de tempo parado em
 * segundo plano é imperceptível, física em câmera acelerada não é.
 *
 * Devolve os SEGUNDOS DE FÍSICA REALMENTE SIMULADOS neste frame
 * (`steps * fixedDt`) — nunca o `deltaSeconds` bruto recebido. Isso importa
 * porque o chamador usa esse valor pra alimentar o `SettleTracker` (ver
 * `createSettleTracker.ts`): se o frame rate cair (aba ocupada, máquina sob
 * carga, muitos dados na cena), `deltaSeconds` bruto pode ficar bem maior
 * que o tempo de física de fato avançado (travado em `maxStepsPerFrame`
 * passos) — alimentar o tracker com o bruto faria o cronômetro de "parado"
 * avançar rápido demais em relação à física real, ora travando a rolagem
 * pra sempre (declara "emperrado" antes da hora), ora aceitando um
 * resultado prematuro (uma leitura de velocidade baixa por sorte, sem o
 * dado ter de fato assentado).
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
