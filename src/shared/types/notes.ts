import { normalizarTipoDeRolagem, type SheetRollKind } from './sheetRoll'
import { normalizarRecursos, type RecursoVital } from './recursoVital'
import { REGRA_DE_CRITICO_PADRAO, normalizarRegraDeCritico, type RegraDeCritico } from '../dice/critico'
import { normalizarDescansos, type Descanso } from './descanso'
import { HUD_PADRAO, normalizarCondicoes, normalizarHud, type Condicao, type EstadoDoHud } from './hud'
import { normalizarHistorico, type ItemDoHistorico } from './historico'

/**
 * Uma página do BLOCO — uma por dia de jogo, viradas pelos botões ◀ ▶ (pedido do usuário: "coloca
 * tipo uma página para cada dia e você aperta o botão e passa a página/dia").
 */
export interface NotesPage {
  id: string
  /**
   * QUANDO A SESSÃO FOI CRIADA, em milissegundos do epoch; vai pra lista lateral, embaixo do nome.
   * ZERO significa NÃO SEI, e é valor legítimo: as sessões escritas antes desta versão não têm essa
   * data em canto nenhum, e a tela diz "sem data". Carimbar a data da migração seria pior — uma
   * sessão de três meses atrás passaria a dizer que nasceu hoje.
   */
  createdAt: number
  /**
   * Nome do dia, opcional. Vazio = a interface mostra "Dia N" pela POSIÇÃO da página, e assim apagar
   * o dia 2 renumera o resto sozinho em vez de deixar "Dia 3" na segunda posição pra sempre.
   */
  title: string
  text: string
}

/**
 * Uma SEÇÃO da ficha, com o nome que o sistema de RPG dá a ela: é o que faz a aba Ficha assumir a
 * forma do sistema em vez de ter cinco blocos fixos pra todo mundo. Os nomes não são inventados
 * aqui, são os que o leitor daquele sistema devolveu.
 *
 * Mora dentro do `notes.json` do PERFIL, e é por isso que trocar de personagem troca a ficha inteira.
 */
export interface SheetSection {
  id: string
  title: string
  fields: SheetSectionField[]
}

export interface SheetSectionField {
  id: string
  label: string
  value: string
  /**
   * Como se rola este campo (ver `sheetRoll.ts`): vem do leitor do sistema na importação e é o que
   * põe o botão de dado ao lado do número. Guarda o TIPO da rolagem e não a expressão, porque o
   * valor ao lado é editável e uma expressão gravada rolaria pra sempre o bônus da importação.
   */
  roll?: SheetRollKind
}

export interface NotesData {
  characterName: string
  /**
   * ATRIBUTOS e HABILIDADES são texto livre, e não campos com número por atributo: a ficha já teve
   * isso e foi mandada tirar. O que existe é um lugar pra escrever, não o app entendendo de sistema.
   */
  attributes: string
  abilities: string
  /**
   * Seções vindas de uma ficha IMPORTADA. Vazio = personagem criado à mão, e aí a aba Ficha mostra
   * os blocos livres. As duas formas convivem de propósito: quem importou quer a ficha do sistema
   * dele campo a campo, quem criou do zero não tem sistema nenhum pra seguir.
   */
  sections: SheetSection[]
  /**
   * As BARRAS de PV/PE/Sanidade da tela de rolagem (spec §3.4; ver `recursoVital.ts`). São do
   * personagem, então moram no arquivo que troca junto com ele e não nas preferências do app.
   */
  recursos: RecursoVital[]
  /**
   * Que dado o sistema deste personagem olha pra dizer CRÍTICO e FALHA, e em que direção (spec §3.7;
   * ver `critico.ts`): o d20 de D&D e o d100 rola-abaixo de Cthulhu não cabem numa preferência só.
   */
  critico: RegraDeCritico
  /**
   * Os TIPOS DE DESCANSO do personagem (spec §3.8; ver `descanso.ts`): o que cada um devolve, barra
   * por barra. Vazio = o app oferece um "Descanso" que devolve tudo, sem gravar nada.
   */
  descansos: Descanso[]
  /** O HUD sobre a cena (spec §3.6): canto, escondido, mini — e as condições do personagem. Ver `hud.ts`. */
  hud: EstadoDoHud
  condicoes: Condicao[]
  /**
   * O HISTÓRICO de rolagens e descansos (spec §3.2), que troca junto com o personagem e sobrevive a
   * fechar o app. Os últimos `MAXIMO_DO_HISTORICO`, o mais novo primeiro.
   */
  historico: ItemDoHistorico[]
  inventory: string
  appearance: string
  backstory: string
  pages: NotesPage[]
  /** Página aberta. Guardada pra reabrir o app no mesmo dia em que se estava. */
  currentPage: number
  font: string
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
}

export const DEFAULT_NOTES: NotesData = {
  characterName: '',
  attributes: '',
  abilities: '',
  sections: [],
  recursos: [],
  critico: REGRA_DE_CRITICO_PADRAO,
  descansos: [],
  hud: HUD_PADRAO,
  condicoes: [],
  historico: [],
  inventory: '',
  appearance: '',
  backstory: '',
  pages: [],
  currentPage: 0,
  font: '',
  bold: false,
  italic: false,
  underline: false,
  color: ''
}

export function createNotesPage(text = ''): NotesPage {
  return { id: crypto.randomUUID(), title: '', text, createdAt: Date.now() }
}

/**
 * TETO de caracteres de UMA sessão de anotações. Vale pro que se DIGITA: o campo para no teto, o que
 * se cola entra cortado, e o contador ao lado diz onde se está. O que JÁ ESTÁ gravado acima do teto
 * não é cortado na leitura — arquivo antigo não perde conteúdo por causa de um número novo, só não
 * cresce mais.
 */
export const TAMANHO_MAXIMO_DA_ANOTACAO = 2_000

/** O texto digitado, preso no teto — a régua única do campo e de qualquer gravação por código. */
export function textoDeAnotacaoLimitado(texto: string): string {
  return texto.length <= TAMANHO_MAXIMO_DA_ANOTACAO ? texto : texto.slice(0, TAMANHO_MAXIMO_DA_ANOTACAO)
}

/**
 * Formato antigo do `notes.json`: um bloco de texto só, chamado `notes`. Quem já usava o app tem
 * isso gravado, e ele vira a PRIMEIRA PÁGINA do diário em vez de sumir.
 */
interface LegacyNotes {
  notes?: string
}

/**
 * Deixa qualquer conteúdo lido do disco no formato atual: migra o campo antigo, garante ao menos
 * uma página e corrige um `currentPage` fora do intervalo (arquivo editado à mão, ou página apagada
 * numa versão e reaberta em outra).
 */
export function normalizeNotes(raw: unknown): NotesData {
  const data = { ...DEFAULT_NOTES, ...(raw as Partial<NotesData>) }
  const legacyText = (raw as LegacyNotes | null)?.notes

  const pages = Array.isArray(data.pages)
    ? data.pages
        .filter((page): page is NotesPage => typeof page?.text === 'string')
        /**
         * `createdAt` pode faltar (sessão de antes desta versão) ou vir torta (`NaN`, texto,
         * negativo). Nos dois casos vira ZERO, que a tela lê como "sem data".
         */
        .map((page) => ({
          ...page,
          createdAt:
            typeof page.createdAt === 'number' &&
            Number.isFinite(page.createdAt) &&
            page.createdAt > 0
              ? page.createdAt
              : 0
        }))
    : []
  if (pages.length === 0) {
    pages.push(createNotesPage(typeof legacyText === 'string' ? legacyText : ''))
  }

  /**
   * `sections` vem de arquivo, então pode vir qualquer coisa: ausente, não-lista, ou com item torto.
   * Filtrar aqui é o que impede a aba Ficha de quebrar inteira por uma entrada estragada.
   */
  const sections: SheetSection[] = Array.isArray(data.sections)
    ? data.sections
        .filter((secao): secao is SheetSection => typeof secao?.title === 'string' && Array.isArray(secao?.fields))
        .map((secao) => ({
          id: typeof secao.id === 'string' ? secao.id : crypto.randomUUID(),
          title: secao.title,
          fields: secao.fields
            .filter((campo): campo is SheetSectionField => typeof campo?.label === 'string')
            .map((campo) => ({
              id: typeof campo.id === 'string' ? campo.id : crypto.randomUUID(),
              label: campo.label,
              value: typeof campo.value === 'string' ? campo.value : '',
              // Tipo de rolagem que não existe (arquivo de outra versão, editado à mão) vira
              // ausente — o campo perde o botão certo, e não a ficha inteira.
              roll: normalizarTipoDeRolagem(campo.roll)
            }))
        }))
    : []

  const currentPage = Math.min(Math.max(0, Math.trunc(data.currentPage) || 0), pages.length - 1)
  // O nome já morou dentro de um objeto `sheet` (junto de classe, nível, atributos...) — quem gravou
  // naquele formato não perde o nome por causa disso.
  const legacyName = (raw as { sheet?: { name?: string } } | null)?.sheet?.name
  const characterName = texto(data.characterName) || texto(legacyName)
  /**
   * Os BLOCOS de texto livre, saneados como o resto: um `"backstory": null` num pacote de personagem
   * de outra pessoa derrubava a aba Ficha inteira, porque `fichaEstaVazia` chama `.trim()` neles.
   */
  const blocos = {
    attributes: texto(data.attributes),
    abilities: texto(data.abilities),
    inventory: texto(data.inventory),
    appearance: texto(data.appearance),
    backstory: texto(data.backstory)
  }
  // Mesma régua das seções: ausente (perfil de antes desta versão) ou torto não derruba a ficha.
  const recursos = normalizarRecursos(data.recursos)
  const critico = normalizarRegraDeCritico(data.critico)
  // Depois das barras, de propósito: efeito de barra que não existe cai fora.
  const descansos = normalizarDescansos(data.descansos, recursos)
  const hud = normalizarHud(data.hud)
  const condicoes = normalizarCondicoes(data.condicoes)
  const historico = normalizarHistorico(data.historico)
  return { ...data, ...blocos, characterName, pages, currentPage, sections, recursos, critico, descansos, hud, condicoes, historico }
}

/** Texto lido do arquivo: o que não for texto vira vazio, e a tela não quebra. */
function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

/**
 * A ficha está VAZIA — nenhuma seção importada e nenhuma letra em bloco nenhum. É o estado do
 * personagem recém-criado: a aba Ficha mostra o convite de importar em vez dos blocos, e a
 * importação sem janela preenche ESTE personagem em vez de criar outro (ver `escolherDestino`).
 * O diário, as barras e o histórico não contam: são o que aconteceu, não o que o personagem é.
 */
export function fichaEstaVazia(
  notes: Pick<NotesData, 'sections' | 'attributes' | 'abilities' | 'inventory' | 'appearance' | 'backstory'>
): boolean {
  return (
    notes.sections.length === 0 &&
    !notes.attributes.trim() &&
    !notes.abilities.trim() &&
    !notes.inventory.trim() &&
    !notes.appearance.trim() &&
    !notes.backstory.trim()
  )
}
