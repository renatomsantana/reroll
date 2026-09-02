import { corPadraoDoRecurso, ehCorHex } from './cor'

/**
 * RECURSO VITAL — o que o personagem gasta e recupera durante a sessão: PV, PE, Sanidade em Ordem
 * Paranormal; HP em D&D; o que for no sistema da mesa. É a barra clicável da tela de rolagem
 * (spec §3.4).
 *
 * Existe como MODELO PRÓPRIO, separado dos campos da ficha, por uma razão que a ficha importada
 * deixou clara: "PV atual" e "PV máximo" chegavam como dois campos de texto soltos numa seção
 * chamada "Recursos", e a pessoa tinha que abrir a aba Ficha, achar a caixa e digitar "19" no meio
 * de um combate — quando o gesto que ela faz na mesa é "tomei 7". A barra é esse gesto: um par
 * atual/máximo, com número inteiro dos dois lados, que se mexe com um clique.
 *
 * Mora no `notes.json` do PERFIL (ver `NotesData.recursos`), porque é do personagem: trocar de
 * ficha troca as barras, e voltar traz o PV exatamente onde estava.
 *
 * Nada aqui sabe de sistema de RPG. O nome é livre, a lista é livre, e o teto é folgado — é o que
 * torna o desenho "agnóstico de sistema": Ordem tem três barras, D&D tem uma (ou uma por espaço de
 * magia, se a pessoa quiser), e um sistema que o app nunca viu funciona igual.
 */
export interface RecursoVital {
  id: string
  /** "PV", "Sanidade", "HP", "Espaços de 1º círculo" — o que a pessoa quiser ler na barra. */
  nome: string
  atual: number
  maximo: number
  /**
   * Cor da barra escolhida pela pessoa, `#rrggbb`. AUSENTE é o normal, e aí a cor sai do NOME
   * (`corPadraoDoRecurso`: PV bordô, PE marinho, Sanidade roxo) — pedido dele (02/09/2026): "para
   * cada atributo atribuir cor também; a pessoa decide a cor também". A cor já foi a do ESTADO
   * (verde, oliva abaixo da metade, bordô abaixo de um quarto); o estado continua sendo mostrado,
   * agora no NÚMERO da barra (ver `BarrasDeRecurso.css`), pra cor da barra poder ser da barra.
   */
  cor?: string
}

/** A cor com que a barra aparece: a escolhida, ou a que o nome sugere. */
export function corDoRecurso(recurso: Pick<RecursoVital, 'nome' | 'cor'>): string {
  return recurso.cor ?? corPadraoDoRecurso(recurso.nome)
}

/**
 * Quantas barras cabem num personagem. Doze.
 *
 * Ordem usa três; D&D uma; o pior caso real são os espaços de magia por círculo de um conjurador de
 * D&D (nove) mais PV. Acima disso a faixa de barras na tela de rolagem deixa de ser uma faixa e
 * vira uma coluna — e no modo compacto, que cresce em altura por barra, não cabe de jeito nenhum.
 */
export const MAXIMO_DE_RECURSOS = 12

/** Nome curto por definição: ele mora numa barra de uns 200px ao lado dos números. */
export const TAMANHO_MAXIMO_DO_NOME_DO_RECURSO = 40

/**
 * Teto dos valores. Não existe sistema em que um recurso vital tenha um milhão de pontos, e o teto
 * é o que impede um `notes.json` editado à mão de pôr `1e308` na barra — que renderiza `Infinity`
 * e quebra a proporção de preenchimento de todas.
 */
export const TETO_DO_VALOR_DE_RECURSO = 999_999

/** Inteiro dentro de `[0, teto]`; qualquer coisa que não seja número finito vira `null`. */
function inteiroLimitado(valor: unknown, teto: number): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null
  return Math.min(Math.max(0, Math.trunc(valor)), teto)
}

/**
 * O valor ATUAL preso ao intervalo do recurso: nunca abaixo de zero, nunca acima do máximo.
 *
 * "Nunca acima do máximo" é escolha, não descuido: PV temporário de D&D estoura o máximo, e há
 * quem anote assim. Mas uma barra que passa de 100% não tem como ser desenhada, e a régua de
 * estado (aviso abaixo da metade) perderia a referência. Quem tem PV temporário sobe o máximo por
 * um instante — que é o que a ficha em papel faz, riscando o número.
 */
export function prenderAtual(atual: number, maximo: number): number {
  return Math.min(Math.max(0, Math.trunc(atual)), Math.max(0, Math.trunc(maximo)))
}

export function criarRecurso(nome: string, maximo: number, atual = maximo): RecursoVital {
  const maximoLimpo = inteiroLimitado(maximo, TETO_DO_VALOR_DE_RECURSO) ?? 0
  return {
    id: crypto.randomUUID(),
    nome: nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO),
    maximo: maximoLimpo,
    atual: prenderAtual(inteiroLimitado(atual, TETO_DO_VALOR_DE_RECURSO) ?? maximoLimpo, maximoLimpo)
  }
}

/**
 * Deixa qualquer lista lida do disco no formato atual — a mesma régua de `normalizeNotes` e
 * `normalizeProfiles`: item torto é DESCARTADO ou CORRIGIDO, nunca derruba a ficha inteira.
 *
 * - sem `nome` legível: fora. Uma barra sem nome não diz o que está medindo.
 * - `maximo`/`atual` que não são número finito: viram zero (e o atual, preso ao máximo). É o caso
 *   de um arquivo escrito por versão futura com outro formato, ou editado à mão.
 * - `id` repetido ou ausente: ganha um novo. Dois recursos com o mesmo id fariam o clique no "−" de
 *   um mexer nos dois.
 * - `cor` fora do formato: ausente — a barra volta pra cor de estado, que é o padrão.
 * - acima do teto de itens: os primeiros ficam. Ver `MAXIMO_DE_RECURSOS`.
 */
export function normalizarRecursos(raw: unknown): RecursoVital[] {
  if (!Array.isArray(raw)) return []
  const usados = new Set<string>()
  const limpos: RecursoVital[] = []
  for (const bruto of raw) {
    if (limpos.length >= MAXIMO_DE_RECURSOS) break
    if (!bruto || typeof bruto !== 'object') continue
    const entrada = bruto as Partial<RecursoVital>
    const nome = typeof entrada.nome === 'string' ? entrada.nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO) : ''
    if (!nome) continue
    const maximo = inteiroLimitado(entrada.maximo, TETO_DO_VALOR_DE_RECURSO) ?? 0
    const atual = prenderAtual(inteiroLimitado(entrada.atual, TETO_DO_VALOR_DE_RECURSO) ?? maximo, maximo)
    const id = typeof entrada.id === 'string' && entrada.id.trim() && !usados.has(entrada.id) ? entrada.id : crypto.randomUUID()
    usados.add(id)
    const recurso: RecursoVital = { id, nome, atual, maximo }
    if (ehCorHex(entrada.cor)) recurso.cor = entrada.cor.toLowerCase()
    limpos.push(recurso)
  }
  return limpos
}

/**
 * As barras que a IMPORTAÇÃO traz, fundidas com as que o personagem já tem.
 *
 * Pelo NOME, sem diferenciar maiúsculas: reimportar a ficha depois de subir de nível traz um "PV"
 * com máximo novo, e ele tem que ser a MESMA barra — com o id (que a tela já conhece) e a cor que a
 * pessoa escolheu. Acrescentar em vez de fundir deixaria dois "PV" lado a lado, um velho e um novo,
 * sem nada dizendo qual é qual — o mesmo defeito que as seções da ficha já tiveram.
 *
 * O que já estava e não veio de novo FICA: uma barra criada à mão não some porque a ficha não a
 * menciona.
 */
export function fundirRecursos(
  atuais: RecursoVital[],
  importados: Pick<RecursoVital, 'nome' | 'atual' | 'maximo'>[]
): RecursoVital[] {
  const resultado = [...atuais]
  for (const importado of importados) {
    const nome = importado.nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO)
    if (!nome) continue
    const indice = resultado.findIndex((recurso) => recurso.nome.toLowerCase() === nome.toLowerCase())
    if (indice >= 0) {
      const existente = resultado[indice]
      const maximo = inteiroLimitado(importado.maximo, TETO_DO_VALOR_DE_RECURSO) ?? existente.maximo
      resultado[indice] = { ...existente, maximo, atual: prenderAtual(inteiroLimitado(importado.atual, TETO_DO_VALOR_DE_RECURSO) ?? maximo, maximo) }
      continue
    }
    if (resultado.length >= MAXIMO_DE_RECURSOS) break
    resultado.push(criarRecurso(nome, importado.maximo, importado.atual))
  }
  return resultado
}

export type EstadoDoRecurso = 'normal' | 'aviso' | 'perigo'

/**
 * A cor de relance: abaixo da METADE avisa, abaixo de UM QUARTO é perigo. As duas linhas são as da
 * spec, e casam com o que as mesas já fazem de cabeça ("tô com menos da metade").
 *
 * Máximo zero é "normal" de propósito: não há proporção nenhuma a julgar, e pintar de perigo uma
 * barra que a pessoa ainda nem preencheu seria alarme falso.
 */
export function estadoDoRecurso(recurso: Pick<RecursoVital, 'atual' | 'maximo'>): EstadoDoRecurso {
  if (recurso.maximo <= 0) return 'normal'
  const fracao = recurso.atual / recurso.maximo
  if (fracao < 0.25) return 'perigo'
  if (fracao < 0.5) return 'aviso'
  return 'normal'
}

/**
 * O que a pessoa DIGITOU no número da barra, virando o valor atual novo — ou `null` se não leu.
 *
 * Dois jeitos, e a diferença é o SINAL na frente:
 *
 * - `-7`, `+3`: conta em cima do atual. É o gesto da mesa ("tomei 7"), e é o motivo de o campo
 *   existir além dos botões de ±1/±5 — um dano de 23 são vinte e três cliques ou um "-23".
 * - `12`: valor exato. É o "voltei pra 12" depois de uma cura que o mestre já somou.
 * - `12/40`: os dois de uma vez — o jeito como toda ficha em papel escreve, e como a importação lê.
 *   Devolve o máximo junto pra quem chama poder gravar os dois.
 *
 * O resultado sempre volta PRESO ao intervalo (`prenderAtual`): "-50" num PV 12 dá zero, não -38.
 */
export function lerEntradaDeRecurso(
  texto: string,
  recurso: Pick<RecursoVital, 'atual' | 'maximo'>
): { atual: number; maximo: number } | null {
  const limpo = texto.trim().replace(/\s+/g, '')
  if (!limpo) return null

  const par = /^(\d{1,7})\/(\d{1,7})$/.exec(limpo)
  if (par) {
    const maximo = Math.min(Number(par[2]), TETO_DO_VALOR_DE_RECURSO)
    return { maximo, atual: prenderAtual(Number(par[1]), maximo) }
  }

  const delta = /^([+-])(\d{1,7})$/.exec(limpo)
  if (delta) {
    const passo = Number(delta[2]) * (delta[1] === '-' ? -1 : 1)
    return { maximo: recurso.maximo, atual: prenderAtual(recurso.atual + passo, recurso.maximo) }
  }

  const exato = /^(\d{1,7})$/.exec(limpo)
  if (exato) return { maximo: recurso.maximo, atual: prenderAtual(Number(exato[1]), recurso.maximo) }

  return null
}
