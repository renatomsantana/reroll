import type { PdfSheet } from '@shared/types/sheetImport'
import { extrairGenerico } from './generic'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de OBLIVIO.
 *
 * Ela é o oposto da de Ordem Paranormal: não tem campo de formulário NENHUM — é um documento do
 * Google Docs exportado, e quem preenche digita dentro dele. Por isso este leitor não tem uma lista
 * de nomes de campo como o outro; ele se apoia inteiro no que `camposDoTexto` extrai do texto
 * impresso, e acrescenta o que só quem conhece o sistema sabe: que sistema é, e como agrupar.
 *
 * É também a prova de que o registro de leitores serve pros DOIS tipos de ficha, que é o que
 * importa pro pedido de aceitar fichas de outros usuários.
 */

/**
 * Os dez atributos de Oblivio. São a impressão digital da ficha e, junto, o grupo "Atributos".
 *
 * A detecção é por eles, e não pela palavra "Oblivio" — que NÃO aparece em lugar nenhum do arquivo,
 * conferido nas duas versões (em branco e preenchida). Dez rótulos específicos aparecendo juntos é
 * estrutura; estrutura não acontece por acaso.
 */
const ATRIBUTOS = [
  'Carne',
  'Força',
  'Prontidão',
  'Determinação',
  'Mente',
  'Coragem',
  'Dor',
  'Fôlego',
  'Proteção',
  'Velocidade'
]

/** Partes do corpo, que na ficha têm dano acumulado por região. */
const CORPO = ['Torso', 'Braço Direito', 'Braço Esquerdo', 'Perna Direita', 'Perna Esquerda']

const IDENTIFICACAO = ['Nome', 'Papel', 'Motivação']

/**
 * "Descrição" é APARÊNCIA, e não identificação.
 *
 * O conteúdo dela na ficha real é um parágrafo de 280 caracteres sobre cabelo, moletom e cicatriz —
 * exatamente o que o bloco de aparência existe pra guardar. Como campo de seção ele virava uma linha
 * de formulário com um texto que não cabe nela.
 */
const APARENCIA = ['Descrição', 'Aparência']

/**
 * A partir daqui, o que sobrou é HABILIDADE.
 *
 * Numa ficha de Oblivio preenchida, o que não é identificação, atributo ou parte do corpo e ainda
 * assim tem um parágrafo dentro é o talento que o jogador escolheu, escrito por extenso — "Estocada:
 * Você realiza a Ação de Cena 'Mover'…". Eles são o único conteúdo do arquivo com valor comprido: o
 * resto é "2/10", "0/3", nome próprio.
 *
 * O corte é pelo TAMANHO e não por uma lista de talentos porque a lista mudaria a cada suplemento —
 * e uma lista desatualizada devolve o talento novo pra pilha de campos sem grupo, que é justamente o
 * que se quer evitar. Errar aqui custa uma habilidade caindo no lugar errado da ficha; acertar
 * manda o texto pro bloco de habilidades, que é onde se escreve frase.
 */
const TAMANHO_DE_HABILIDADE = 25

export const oblivioReader: SheetReader = {
  id: 'oblivio',
  label: 'Oblivio',

  detect: (sheet: PdfSheet) => {
    // Ficha COM formulário não é esta: a de Oblivio não tem nenhum, e um PDF que tenha é outra coisa.
    if (sheet.fields.length > 0) return 0
    const rotulos = new Set(
      sheet.texts
        .map((item) => item.text.trim())
        .filter((texto) => texto.endsWith(':'))
        .map((texto) => texto.slice(0, -1).trim())
    )
    const achados = ATRIBUTOS.filter((nome) => rotulos.has(nome)).length
    if (achados >= 8) return 0.9
    if (achados >= 5) return 0.5
    return 0
  },

  extract: (sheet) => {
    const base = extrairGenerico(sheet, 'oblivio', 'Oblivio', 0.9)

    /**
     * Agrupar é quase tudo que este leitor acrescenta, e não é enfeite: sem grupo, a conferência
     * mostra vinte e sete linhas na mesma lista, e os dez atributos ficam misturados com as partes
     * do corpo e com as habilidades. Com grupo, a pessoa reconhece a própria ficha.
     */
    const fields = base.fields.map((campo) => {
      if (IDENTIFICACAO.includes(campo.label)) return { ...campo, group: 'Identificação' }
      if (APARENCIA.includes(campo.label)) return { ...campo, group: 'Aparência' }
      if (ATRIBUTOS.includes(campo.label)) return { ...campo, group: 'Atributos' }
      if (CORPO.includes(campo.label)) return { ...campo, group: 'Corpo' }
      if (campo.value.length > TAMANHO_DE_HABILIDADE) return { ...campo, group: 'Habilidades' }
      return campo
    })

    return { ...base, system: 'Oblivio', fields }
  }
}
