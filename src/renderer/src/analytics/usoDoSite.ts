import { REROLL_WEB } from '@shared/buildTarget'
import { DEFAULT_DICE_SIDES } from '@shared/diceRegistry'
import type { RollResult } from '@shared/types/dice'
import type { LaunchMode } from '@renderer/settings/SettingsContext'

type EventoDeUso = 'tabuleiro-aberto' | 'perfil-personalizado-em-uso' | 'dados-personalizados' | 'rolagem-concluida' | 'personalizou-e-rolou' | 'dados-rolados'
type SistemaDeUso = 'padrao' | 'assimilacao'
type DadosDeUso = {
  modo: 'sem-torre' | 'pela-torre' | 'torre-enfeite'
  sistema: SistemaDeUso
  dado?: string
  quantidade?: number
}
type DetalhesDaRolagem = {
  sistema?: SistemaDeUso
  resultado?: Pick<RollResult, 'groups' | 'descartados' | 'rerolados'>
}
type Umami = { track: (evento: EventoDeUso, dados?: DadosDeUso) => unknown }

const modosDeRolagem: Record<LaunchMode, DadosDeUso['modo']> = {
  tray: 'sem-torre',
  tower: 'pela-torre',
  towerDecor: 'torre-enfeite'
}

// Só memória desta página. Não cria cookies, identificadores nem armazenamento de analytics.
const eventosUnicos = new Set<EventoDeUso>()
const rolagensRecentes = new Set<string>()
let dadosPersonalizados = false
let editouDadosNestaPagina = false
let tabuleiroAberto = false

function enviar(evento: EventoDeUso, dados?: DadosDeUso): boolean {
  if (!REROLL_WEB || !import.meta.env.PROD || typeof window === 'undefined') return false
  if (!['reroll.com.br', 'www.reroll.com.br'].includes(window.location.hostname)) return false
  if (navigator.doNotTrack === '1') return false
  try {
    const umami = (window as Window & { umami?: Umami }).umami
    if (!umami) return false
    // Falhas ou bloqueadores nunca impedem a rolagem ou a personalização.
    void Promise.resolve(dados ? umami.track(evento, dados) : umami.track(evento)).catch(() => undefined)
    return true
  } catch {
    return false
  }
}

export function contarTabuleiroAberto(): void {
  tabuleiroAberto = true
  contarUmaVez('tabuleiro-aberto')
  if (dadosPersonalizados) contarUmaVez('perfil-personalizado-em-uso')
}

export function definirDadosPersonalizados(personalizado: boolean): void {
  dadosPersonalizados = personalizado
  if (tabuleiroAberto && personalizado) contarUmaVez('perfil-personalizado-em-uso')
}

export function contarPersonalizacaoDosDados(): void {
  editouDadosNestaPagina = true
  // A roda de cores chama onChange a cada movimento: uma edição não vira centenas de eventos.
  contarUmaVez('dados-personalizados')
}

function contarUmaVez(evento: EventoDeUso): void {
  if (!eventosUnicos.has(evento) && enviar(evento)) eventosUnicos.add(evento)
}

export function contarRolagemConcluida(
  id: string,
  modo: LaunchMode = 'tray',
  detalhes: DetalhesDaRolagem = {}
): void {
  const dados: DadosDeUso = { modo: modosDeRolagem[modo], sistema: detalhes.sistema ?? 'padrao' }
  if (rolagensRecentes.has(id) || !enviar('rolagem-concluida', dados)) return
  // O ID serve apenas para deduplicar callbacks locais; não é enviado ao Umami.
  rolagensRecentes.add(id)
  if (detalhes.resultado) {
    for (const [lados, quantidade] of quantidadesPorDado(detalhes.resultado)) {
      // Um evento por TIPO, não por dado: 100d6 não consome 100 eventos do plano.
      enviar('dados-rolados', { ...dados, dado: `d${lados}`, quantidade })
    }
  }
  if (editouDadosNestaPagina) contarUmaVez('personalizou-e-rolou')
  if (rolagensRecentes.size > 100) rolagensRecentes.delete(rolagensRecentes.values().next().value!)
}

/** Conta lançamentos, incluindo vantagem, explosões e rerolls, sem enviar faces ou anotações. */
function quantidadesPorDado(resultado: NonNullable<DetalhesDaRolagem['resultado']>): Map<number, number> {
  const quantidades = new Map<number, number>()
  for (const [grupoIndex, grupo] of [...resultado.groups, ...(resultado.descartados ?? [])].entries()) {
    if (!DEFAULT_DICE_SIDES.includes(grupo.sides)) continue
    let quantidade = 0
    for (let i = 0; i < grupo.rolls.length; i++) {
      quantidade += Math.max(1, grupo.chains?.[i]?.length ?? 1)
      // Rerolls pertencem aos grupos da fórmula; descartados são só vantagem/desvantagem.
      if (grupoIndex < resultado.groups.length && resultado.rerolados?.[grupoIndex]?.[i] != null) quantidade++
    }
    if (quantidade > 0) quantidades.set(grupo.sides, (quantidades.get(grupo.sides) ?? 0) + quantidade)
  }
  return quantidades
}
