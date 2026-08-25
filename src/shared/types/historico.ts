import type { RollResult } from './dice'

/**
 * UM ITEM do histórico da sessão. Era só `RollResult`; o descanso (spec §3.8) precisa de uma linha
 * própria ali — "— Descanso longo — PV 12→27" —, e fingir que um descanso é uma rolagem sem dados
 * deixaria o histórico com um total zero que ninguém rolou. A união diz a verdade: rolagem ou
 * evento, e a tela desenha cada um do seu jeito.
 */
export type ItemDoHistorico =
  | { tipo: 'rolagem'; rolagem: RollResult }
  | { tipo: 'descanso'; id: string; timestamp: number; nome: string; resumo: string }

export function idDoItem(item: ItemDoHistorico): string {
  return item.tipo === 'rolagem' ? item.rolagem.id : item.id
}
