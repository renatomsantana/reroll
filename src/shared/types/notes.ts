/**
 * Uma página do BLOCO — uma por dia de jogo, viradas pelos botões ◀ ▶ (pedido do usuário: "coloca
 * tipo uma página para cada dia e você aperta o botão e passa a página/dia").
 */
export interface NotesPage {
  id: string
  /**
   * Nome do dia, opcional. Vazio = a interface mostra "Dia N" pela POSIÇÃO da página. É de
   * propósito: assim apagar o dia 2 renumera o resto sozinho, em vez de deixar "Dia 3" na segunda
   * posição pra sempre. Quem quiser escrever "Taverna do Javali" por cima, escreve.
   */
  title: string
  text: string
}

/**
 * Os três primeiros campos são FIXOS (um de cada, valem pro personagem inteiro) e o `pages` é o
 * diário. A divisão é a que o usuário pediu — "um bloco para cada coisa: inventário, backstory,
 * aparência, bloco" — e ela tem uma lógica: inventário/aparência/backstory não mudam por dia, o
 * bloco muda.
 */
/**
 * A ficha chegou a ter classe, nível, raça, antecedente, alinhamento, os seis atributos (com
 * modificador calculado) e os números de combate. Tudo isso SAIU a pedido do usuário — "tira
 * atributos, combate, deixa só nome, bloco, inventário, aparência, backstory". O que ficou é o que
 * ele usa: um nome e quatro blocos de texto.
 */
export interface NotesData {
  characterName: string
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
  return { id: crypto.randomUUID(), title: '', text }
}

/**
 * Formato antigo do `notes.json`: um bloco de texto só, chamado `notes`, mais o `backstory`. Quem
 * já usava o app tem isso gravado, então ele vira a PRIMEIRA PÁGINA do diário em vez de sumir —
 * ninguém perde o que escreveu por causa de uma mudança de tela.
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
    ? data.pages.filter((page): page is NotesPage => typeof page?.text === 'string')
    : []
  if (pages.length === 0) {
    pages.push(createNotesPage(typeof legacyText === 'string' ? legacyText : ''))
  }

  const currentPage = Math.min(Math.max(0, Math.trunc(data.currentPage) || 0), pages.length - 1)
  // O nome já morou dentro de um objeto `sheet` (junto de classe, nível, atributos...) — quem gravou
  // naquele formato não perde o nome por causa disso.
  const legacyName = (raw as { sheet?: { name?: string } } | null)?.sheet?.name
  const characterName = data.characterName || legacyName || ''
  return { ...data, characterName, pages, currentPage }
}
