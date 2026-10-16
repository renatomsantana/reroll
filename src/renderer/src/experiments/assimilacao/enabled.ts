export type GameSystem = 'padrao' | 'assimilacao'
export const SISTEMAS_EXPERIMENTAIS_DISPONIVEIS = import.meta.env.DEV
export const SISTEMA_LOCAL_STORAGE_KEY = 'reroll:experimentos:sistema:v1'

// A escolha local tem prioridade sobre o antigo link de teste. Produção sempre usa Padrão.
export function sistemaInicial(raw: string | null, search: string, experimental = SISTEMAS_EXPERIMENTAIS_DISPONIVEIS): GameSystem {
  if (!experimental) return 'padrao'
  if (raw === 'padrao' || raw === 'assimilacao') return raw
  return new URLSearchParams(search).get('assimilacao') === '1' ? 'assimilacao' : 'padrao'
}
