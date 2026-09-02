import { corPadraoDaCondicao, ehCorHex } from './cor'

/**
 * O HUD DO PERSONAGEM (spec §3.6): o cartão flutuante sobre a cena 3D — retrato, nome, as barras
 * de recurso e as condições —, arrastável entre os quatro cantos.
 *
 * O estado dele é DO PERSONAGEM (canto, escondido, encolhido), e não do app: quem joga de dois
 * personagens pode querer o HUD à direita num e escondido no outro. Mora no `notes.json` com o
 * resto, e troca junto com a ficha.
 */
export type Canto = 'nw' | 'ne' | 'sw' | 'se'

export interface EstadoDoHud {
  canto: Canto
  visivel: boolean
  /** O estado MINI: retrato e barras finas, sem nome nem condições — pra quem quer a cena limpa. */
  mini: boolean
}

/**
 * Em cima à ESQUERDA — pedido dele ("deixa o hud na esquerda superior"): nasceu embaixo à direita,
 * longe do seletor de câmera e do popup do total, e ele arrastou todos os personagens pro canto
 * oposto. O canto continua sendo do personagem: quem arrastar, fica onde soltou.
 */
export const HUD_PADRAO: EstadoDoHud = { canto: 'nw', visivel: true, mini: false }

const CANTOS: Canto[] = ['nw', 'ne', 'sw', 'se']

export function normalizarHud(raw: unknown): EstadoDoHud {
  if (!raw || typeof raw !== 'object') return { ...HUD_PADRAO }
  const entrada = raw as Partial<EstadoDoHud>
  return {
    canto: CANTOS.includes(entrada.canto as Canto) ? (entrada.canto as Canto) : HUD_PADRAO.canto,
    visivel: typeof entrada.visivel === 'boolean' ? entrada.visivel : HUD_PADRAO.visivel,
    mini: typeof entrada.mini === 'boolean' ? entrada.mini : HUD_PADRAO.mini
  }
}

/**
 * Uma CONDIÇÃO do personagem — "Machucado", "Enlouquecendo", "Caído" —, um chip no HUD que liga e
 * desliga com um clique. A lista é livre, porque cada sistema tem as suas; a importação só sugere
 * as de Ordem Paranormal, que são duas e fixas.
 */
export interface Condicao {
  id: string
  nome: string
  ativa: boolean
  /**
   * A cor do chip, `#rrggbb`, escolhida pela pessoa — pedido dele (02/09/2026): "Caído, a pessoa
   * decide a cor também". AUSENTE é o normal, e aí a cor sai do NOME (`corPadraoDaCondicao`):
   * Machucado bordô, Enlouquecendo roxo, Caído oliva. Ver `corDaCondicao`.
   */
  cor?: string
}

export const MAXIMO_DE_CONDICOES = 20
export const TAMANHO_MAXIMO_DO_NOME_DA_CONDICAO = 30

export function criarCondicao(nome: string, ativa = false, cor?: string): Condicao {
  const condicao: Condicao = { id: crypto.randomUUID(), nome: nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DA_CONDICAO), ativa }
  if (ehCorHex(cor)) condicao.cor = cor.toLowerCase()
  return condicao
}

/** A cor com que o chip aparece: a escolhida, ou a que o nome sugere. */
export function corDaCondicao(condicao: Pick<Condicao, 'nome' | 'cor'>): string {
  return condicao.cor ?? corPadraoDaCondicao(condicao.nome)
}

export function normalizarCondicoes(raw: unknown): Condicao[] {
  if (!Array.isArray(raw)) return []
  const usados = new Set<string>()
  const limpas: Condicao[] = []
  for (const bruto of raw) {
    if (limpas.length >= MAXIMO_DE_CONDICOES) break
    if (!bruto || typeof bruto !== 'object') continue
    const entrada = bruto as Partial<Condicao>
    const nome = typeof entrada.nome === 'string' ? entrada.nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DA_CONDICAO) : ''
    if (!nome) continue
    const id = typeof entrada.id === 'string' && entrada.id.trim() && !usados.has(entrada.id) ? entrada.id : crypto.randomUUID()
    usados.add(id)
    const condicao: Condicao = { id, nome, ativa: entrada.ativa === true }
    // Cor fora do formato: ausente — o chip volta pra cor do nome, que é o padrão.
    if (ehCorHex(entrada.cor)) condicao.cor = entrada.cor.toLowerCase()
    limpas.push(condicao)
  }
  return limpas
}

/** As condições que uma ficha importada sugere. Só Ordem tem um par fixo e conhecido. */
export function condicoesPadrao(system: string): Condicao[] {
  if (/ordem/i.test(system)) return [criarCondicao('Machucado'), criarCondicao('Enlouquecendo')]
  return []
}
