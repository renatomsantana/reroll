import { prenderAtual, type RecursoVital } from './recursoVital'

/**
 * DESCANSO (spec §3.8): um clique restaura os recursos pelas regras do PRÓPRIO sistema.
 *
 * Cada personagem tem os seus TIPOS de descanso — "Descanso longo" e "curto" em D&D, "Descanso" e
 * "Intervalo" em Ordem —, e cada tipo diz, recurso por recurso, o que acontece: volta ao máximo,
 * soma N, ou nada. É dado do personagem (mora no `notes.json`, ao lado das barras) porque é regra
 * do sistema dele, e é EDITÁVEL porque nenhuma tabela de sistemas cobre a mesa de todo mundo — a
 * importação só preenche um padrão razoável.
 *
 * Sem automação além do clique: nada de timer, nada de "descansou sozinho". O jogador decide quando
 * houve descanso, confirma vendo o que vai mudar, e o histórico registra que houve.
 */
export type ModoDeDescanso = 'maximo' | 'somar' | 'nada'

export interface EfeitoDeDescanso {
  /** Qual barra (ver `RecursoVital.id`). Efeito de barra que não existe mais é descartado na leitura. */
  recursoId: string
  modo: ModoDeDescanso
  /** Quanto soma, só no modo `somar`. */
  quantidade?: number
}

export interface Descanso {
  id: string
  nome: string
  /** Um por barra, no máximo. Barra sem efeito listado = nada. */
  efeitos: EfeitoDeDescanso[]
}

/** Oito tipos de descanso por personagem — nenhum sistema tem mais que três. */
export const MAXIMO_DE_DESCANSOS = 8
export const TAMANHO_MAXIMO_DO_NOME_DO_DESCANSO = 40
const TETO_DA_QUANTIDADE = 999_999

/** O que uma barra ganha no descanso, ou `nada` se o tipo não fala dela. */
export function efeitoPara(descanso: Descanso, recursoId: string): EfeitoDeDescanso {
  return descanso.efeitos.find((efeito) => efeito.recursoId === recursoId) ?? { recursoId, modo: 'nada' }
}

/** Todas as barras ao máximo — o descanso que todo sistema tem, e o único de quem não configurou nenhum. */
export function descansoCompleto(recursos: RecursoVital[], nome: string, id: string = crypto.randomUUID()): Descanso {
  return { id, nome, efeitos: recursos.map((recurso) => ({ recursoId: recurso.id, modo: 'maximo' })) }
}

/**
 * Os tipos que uma ficha IMPORTADA recebe, pelo sistema. Só o que se sabe com razoável certeza:
 *
 * - D&D 5e / Pathfinder: descanso longo (tudo ao máximo) e curto (nada, pra pessoa preencher — a
 *   regra real depende de dados de vida e de classe, e inventar aqui seria errar com confiança);
 * - Ordem Paranormal: descanso (tudo) e intervalo (só PE ao máximo);
 * - resto: um "Descanso" que devolve tudo.
 *
 * Nomes em português porque é o idioma da ficha de quem o app atende primeiro; são editáveis.
 */
export function descansosPadrao(system: string, recursos: RecursoVital[]): Descanso[] {
  if (/d&d|dnd|5e|dungeons|pathfinder/i.test(system)) {
    return [
      descansoCompleto(recursos, 'Descanso longo'),
      { id: crypto.randomUUID(), nome: 'Descanso curto', efeitos: [] }
    ]
  }
  if (/ordem/i.test(system)) {
    const pe = recursos.filter((recurso) => /^pe$|esfor[çc]o/i.test(recurso.nome))
    return [
      descansoCompleto(recursos, 'Descanso'),
      { id: crypto.randomUUID(), nome: 'Intervalo', efeitos: pe.map((recurso) => ({ recursoId: recurso.id, modo: 'maximo' as const })) }
    ]
  }
  return [descansoCompleto(recursos, 'Descanso')]
}

/**
 * Deixa a lista lida do disco no formato atual — a régua branda de sempre: tipo sem nome cai fora,
 * efeito de barra que não existe cai fora, modo desconhecido vira `nada`, quantidade torta vira 0.
 */
export function normalizarDescansos(raw: unknown, recursos: Pick<RecursoVital, 'id'>[]): Descanso[] {
  if (!Array.isArray(raw)) return []
  const ids = new Set(recursos.map((recurso) => recurso.id))
  const usados = new Set<string>()
  const limpos: Descanso[] = []
  for (const bruto of raw) {
    if (limpos.length >= MAXIMO_DE_DESCANSOS) break
    if (!bruto || typeof bruto !== 'object') continue
    const entrada = bruto as Partial<Descanso>
    const nome = typeof entrada.nome === 'string' ? entrada.nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_DESCANSO) : ''
    if (!nome) continue
    const id = typeof entrada.id === 'string' && entrada.id.trim() && !usados.has(entrada.id) ? entrada.id : crypto.randomUUID()
    usados.add(id)
    const vistos = new Set<string>()
    const efeitos: EfeitoDeDescanso[] = []
    for (const efeitoBruto of Array.isArray(entrada.efeitos) ? entrada.efeitos : []) {
      if (!efeitoBruto || typeof efeitoBruto !== 'object') continue
      const efeito = efeitoBruto as Partial<EfeitoDeDescanso>
      if (typeof efeito.recursoId !== 'string' || !ids.has(efeito.recursoId) || vistos.has(efeito.recursoId)) continue
      vistos.add(efeito.recursoId)
      const modo: ModoDeDescanso = efeito.modo === 'maximo' || efeito.modo === 'somar' ? efeito.modo : 'nada'
      if (modo === 'nada') continue
      const limpo: EfeitoDeDescanso = { recursoId: efeito.recursoId, modo }
      if (modo === 'somar') {
        const quantidade = typeof efeito.quantidade === 'number' && Number.isFinite(efeito.quantidade) ? efeito.quantidade : 0
        limpo.quantidade = Math.min(Math.max(0, Math.trunc(quantidade)), TETO_DA_QUANTIDADE)
      }
      efeitos.push(limpo)
    }
    limpos.push({ id, nome, efeitos })
  }
  return limpos
}

export interface MudancaDeRecurso {
  nome: string
  de: number
  para: number
}

/**
 * O descanso APLICADO: as barras novas e a lista do que mudou — que é o que a confirmação mostra
 * ("PV 12→27") e o que vai pro histórico. Barra que não muda não entra na lista: "PE 12→12" é
 * ruído na hora de decidir.
 */
export function aplicarDescanso(
  recursos: RecursoVital[],
  descanso: Descanso
): { recursos: RecursoVital[]; mudancas: MudancaDeRecurso[] } {
  const mudancas: MudancaDeRecurso[] = []
  const novos = recursos.map((recurso) => {
    const efeito = efeitoPara(descanso, recurso.id)
    let para = recurso.atual
    // "Recuperar tudo" numa barra que SOBE (estresse, dano por região) é voltar a ZERO: ali o
    // máximo é o pior caso, e um descanso que enchesse o estresse seria o contrário de descansar.
    if (efeito.modo === 'maximo') para = recurso.sobe ? 0 : recurso.maximo
    if (efeito.modo === 'somar') para = prenderAtual(recurso.atual + (efeito.quantidade ?? 0), recurso.maximo)
    if (para === recurso.atual) return recurso
    mudancas.push({ nome: recurso.nome, de: recurso.atual, para })
    return { ...recurso, atual: para }
  })
  return { recursos: novos, mudancas }
}

/** "PV 12→27, PE 4→12" — a linha do histórico e do chat. Vazio quando nada mudou. */
export function resumoDoDescanso(mudancas: MudancaDeRecurso[]): string {
  return mudancas.map((mudanca) => `${mudanca.nome} ${mudanca.de}→${mudanca.para}`).join(', ')
}
