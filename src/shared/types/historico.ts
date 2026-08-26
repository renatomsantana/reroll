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

/**
 * Quantos itens o histórico guarda. Cem: as últimas sessões cabem, e o `notes.json` (onde ele mora
 * desde que virou por personagem, spec §3.2) cresce uns 100 KB no pior caso, nada que se note.
 */
export const MAXIMO_DO_HISTORICO = 100

/**
 * O histórico como vem do disco: lista, item por item, e só o que tem a forma certa. Vive no
 * `notes.json` do personagem, então passa pela mesma régua das seções e das barras — arquivo
 * ausente (versão anterior a isto) ou torto não derruba a ficha, só perde o item estragado.
 */
export function normalizarHistorico(bruto: unknown): ItemDoHistorico[] {
  if (!Array.isArray(bruto)) return []
  const itens: ItemDoHistorico[] = []
  for (const item of bruto) {
    if (typeof item !== 'object' || item === null) continue
    const entrada = item as Record<string, unknown>
    if (entrada.tipo === 'rolagem') {
      const rolagem = entrada.rolagem as Record<string, unknown> | undefined
      if (
        typeof rolagem === 'object' &&
        rolagem !== null &&
        typeof rolagem.id === 'string' &&
        typeof rolagem.total === 'number' &&
        Array.isArray(rolagem.groups) &&
        typeof rolagem.timestamp === 'number'
      ) {
        itens.push({ tipo: 'rolagem', rolagem: rolagem as unknown as RollResult })
      }
      continue
    }
    if (entrada.tipo === 'descanso' && typeof entrada.id === 'string' && typeof entrada.nome === 'string') {
      itens.push({
        tipo: 'descanso',
        id: entrada.id,
        timestamp: typeof entrada.timestamp === 'number' ? entrada.timestamp : 0,
        nome: entrada.nome,
        resumo: typeof entrada.resumo === 'string' ? entrada.resumo : ''
      })
    }
  }
  return itens.slice(0, MAXIMO_DO_HISTORICO)
}
