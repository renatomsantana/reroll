import { normalizarTipoDeRolagem, type SheetRollKind } from './sheetRoll'
import { normalizarRecursos, type RecursoVital } from './recursoVital'

/**
 * Uma página do BLOCO — uma por dia de jogo, viradas pelos botões ◀ ▶ (pedido do usuário: "coloca
 * tipo uma página para cada dia e você aperta o botão e passa a página/dia").
 */
export interface NotesPage {
  id: string
  /**
   * QUANDO A SESSÃO FOI CRIADA, em milissegundos do epoch. Vai pra lista lateral, embaixo do nome
   * (ver `NotesTab.tsx`) — pedido do usuário: "poder escolher e dizer qual dia foi criada".
   *
   * ZERO significa NÃO SEI, e é um valor legítimo, não um defeito: as sessões escritas antes desta
   * versão não têm essa data gravada em canto nenhum, e o arquivo não guarda histórico. A tela diz
   * "sem data" nesses casos. Carimbar a data da migração seria pior que não ter: uma sessão de três
   * meses atrás passaria a dizer que nasceu hoje, e ninguém teria como desconfiar.
   */
  createdAt: number
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
/**
 * Uma SEÇÃO da ficha, com o nome que o sistema de RPG dá a ela.
 *
 * É o que faz a aba Ficha assumir a forma do sistema em vez de ter cinco blocos fixos pra todo
 * mundo: uma ficha de Ordem Paranormal importada mostra Identificação, Atributos e Recursos; uma de
 * Oblivio mostra Identificação, Atributos e Corpo. Os nomes não são inventados aqui — são os que o
 * leitor daquele sistema devolveu (ver `SheetImportField.group`).
 *
 * Mora dentro do `notes.json` do PERFIL, e é por isso que trocar de personagem troca a ficha
 * inteira: cada um tem as seções do sistema dele, e voltar pro anterior traz de volta as dele.
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
   * Como se rola este campo (ver `sheetRoll.ts`). Vem do leitor do sistema na importação e é o que
   * põe o botão de dado ao lado do número na ficha.
   *
   * Guarda o TIPO da rolagem, não a expressão: o valor ao lado é editável, e uma expressão gravada
   * rolaria pra sempre o bônus que o personagem tinha no dia da importação.
   */
  roll?: SheetRollKind
}

export interface NotesData {
  characterName: string
  /**
   * ATRIBUTOS e HABILIDADES, pedidos pelo usuário quando a ficha virou aba própria ("coloca
   * backstory, inventário, atributos, habilidades, deixa mais organizado para uma ficha").
   *
   * São texto livre, e não campos estruturados com número por atributo — a ficha já teve isso
   * (Força/Destreza/... com modificador calculado) e foi MANDADA TIRAR. O que muda agora é que
   * existe um lugar pra escrever, não que o app volte a entender de sistema: cada RPG tem os seus
   * atributos, e o importador de ficha já traz os de quem tem (ver `SheetImportField.group`).
   */
  attributes: string
  abilities: string
  /**
   * Seções vindas de uma ficha IMPORTADA. Vazio = personagem criado à mão, e aí a aba Ficha mostra
   * os blocos livres (atributos, habilidades, inventário, aparência, história).
   *
   * As duas formas convivem de propósito: quem importou quer a ficha do sistema dele, campo a
   * campo; quem criou do zero não tem sistema nenhum pra seguir e precisa de espaço pra escrever.
   */
  sections: SheetSection[]
  /**
   * As BARRAS de PV/PE/Sanidade da tela de rolagem (spec §3.4; ver `recursoVital.ts`). São do
   * personagem e mudam a cada golpe, então moram aqui, no arquivo que troca junto com ele — e não
   * nas preferências, que são de quem usa o app.
   */
  recursos: RecursoVital[]
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
 * TETO de caracteres de UMA sessão de anotações — pedido do usuário ("vamos colocar um limite de
 * 2000 caracteres em anotações, agora que vi que não tinha").
 *
 * Vale pro que se DIGITA: o campo para no teto, e o que se cola entra cortado nele, com o contador
 * ao lado do campo dizendo onde se está. O que JÁ ESTÁ gravado acima do teto não é cortado na
 * leitura — a mesma regra do teto de personagens: arquivo antigo não perde conteúdo por causa de um
 * número novo; ele só não cresce mais. (O teto total do arquivo, 16 MB na gravação, continua sendo
 * a última linha de defesa — ver `NotesRepository.save`.)
 */
export const TAMANHO_MAXIMO_DA_ANOTACAO = 2_000

/** O texto digitado, preso no teto — a régua única do campo e de qualquer gravação por código. */
export function textoDeAnotacaoLimitado(texto: string): string {
  return texto.length <= TAMANHO_MAXIMO_DA_ANOTACAO ? texto : texto.slice(0, TAMANHO_MAXIMO_DA_ANOTACAO)
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
    ? data.pages
        .filter((page): page is NotesPage => typeof page?.text === 'string')
        /**
         * `createdAt` pode faltar (sessão escrita antes desta versão) ou vir torta (arquivo editado
         * à mão, `NaN`, texto, número negativo). Nos dois casos vira ZERO, que a tela lê como "sem
         * data" — ver o comentário do campo lá em cima sobre por que não se inventa data aqui.
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
   * `sections` vem de arquivo, então pode vir qualquer coisa — ausente (perfil de antes desta
   * versão), não-lista, ou com item torto. Filtrar aqui é o que impede a aba Ficha de quebrar
   * inteira por causa de uma entrada estragada.
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
  const characterName = data.characterName || legacyName || ''
  // Mesma régua das seções: ausente (perfil de antes desta versão) ou torto não derruba a ficha.
  const recursos = normalizarRecursos(data.recursos)
  return { ...data, characterName, pages, currentPage, sections, recursos }
}
