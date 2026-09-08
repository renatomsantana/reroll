import type { PdfSheet, PdfText, SheetImportField } from '@shared/types/sheetImport'
import { ehRotuloPlausivel } from './camposDoTexto'

/**
 * A ficha que é uma IMAGEM com texto escrito por cima (a de Kids on Bikes): o desenho inteiro,
 * incluindo os nomes dos campos, é pixel, e o texto do PDF é só o que a pessoa digitou por cima.
 *
 * NÃO EXISTE RÓTULO PRA CASAR: dá pra saber que ela escreveu "d20" na direita da página 1, não que
 * aquilo é o dado de Força. Chutar pela posição acertaria nesta ficha e mentiria em qualquer outra
 * arte. Então aqui se RECONSTRÓI o que foi escrito, na ordem da página, e o usuário organiza.
 */

/**
 * Acima desta densidade de texto POR PÁGINA, o PDF é um documento, não uma arte anotada. Medido nas
 * fichas de referência: Oblivio tem 68 fragmentos por página, Kids on Bikes preenchida tem 20,5.
 * (Por página e não no total: ficha longa não é ficha densa.)
 */
const TEXTOS_POR_PAGINA = 40

/** Menos que isto não é nem anotação: é PDF de imagem pura, e não há o que importar. */
export const TEXTO_MINIMO = 3

/** Mesma linha, na vertical. */
const MESMA_LINHA = 3

/**
 * Espaço horizontal que ainda conta como "mesma linha", em múltiplos da altura da fonte —
 * proporcional porque 24 pontos é um espaço no corpo 26 e uma coluna inteira no corpo 9. No arquivo
 * real, 0,8 separa os fragmentos de uma frase partida (3 pontos) de dois atributos vizinhos (24).
 */
const FATOR_DE_ESPACO = 0.8

/**
 * Duas linhas do mesmo parágrafo, na vertical, em múltiplos da altura da fonte. Medido nos dois
 * lados: dentro de um parágrafo real as linhas ficam a 1,3–1,4; dois campos diferentes um embaixo do
 * outro ficam a 2,2. Com o teto em 2,2 eles viravam um parágrafo só.
 */
const FATOR_DE_ENTRELINHA = 1.8

/** Quanto a margem esquerda pode variar dentro do mesmo parágrafo. É o que separa as COLUNAS. */
const MARGEM = 12

interface Paragrafo {
  page: number
  x: number
  /** Y da última linha adicionada — é por ela que a próxima linha decide se continua o parágrafo. */
  y: number
  linhas: string[]
}

/**
 * É uma arte anotada? Sem campo de formulário (senão é o caso fácil, e formulário ganha de qualquer
 * palpite) E com texto ESPARSO — a segunda condição é o que separa esta ficha de um documento, onde
 * `camposDoTexto` trabalha muito melhor porque lá existem rótulos impressos pra casar.
 */
export function pareceAnotacaoSobreImagem(sheet: PdfSheet): boolean {
  if (sheet.fields.length > 0) return false
  if (sheet.texts.length < TEXTO_MINIMO) return false
  const paginas = Math.max(1, sheet.pageCount)
  return sheet.texts.length / paginas < TEXTOS_POR_PAGINA
}

/**
 * O que foi escrito na ficha, remontado em parágrafos e em ordem de leitura: o extrator devolve
 * fragmentos ("Heróico: Você não precisa da", "permissão do Mestre para"), e sem remontar cada
 * pedaço vira uma linha solta. O segundo passo respeita COLUNA — a página 2 tem dois blocos lado a
 * lado, e juntar por altura sem olhar a margem intercala os dois criando frase que não existe.
 */
export function paragrafosDaFicha(sheet: PdfSheet): string[] {
  return regioesDaFicha(sheet).flat()
}

/** Os parágrafos com posição, antes de virar texto. Ver `paragrafosDaFicha` e `regioesDaFicha`. */
function paragrafosCrus(sheet: PdfSheet): Paragrafo[] {
  /**
   * Ordem de leitura: página, de cima pra baixo, da esquerda pra direita. O Y entra ARREDONDADO em
   * faixas do tamanho de uma linha porque dois fragmentos da mesma linha quase nunca têm o Y idêntico
   * ("d4" em 543 e "d8" em 544), e com o Y cru o passo seguinte grudava os dois atributos.
   */
  const faixa = (item: PdfText): number => Math.round(item.y / MESMA_LINHA)
  const ordenado = [...sheet.texts].sort(
    (a, b) => a.page - b.page || faixa(b) - faixa(a) || a.x - b.x
  )

  // 1. LINHAS: fragmentos na mesma altura e horizontalmente vizinhos.
  const linhas: {
    page: number
    x: number
    y: number
    fim: number
    /** `null` quando o PDF não declara altura de fonte — aí esta linha não junta com nenhuma. */
    altura: number | null
    partes: string[]
  }[] = []
  for (const item of ordenado) {
    const atual = linhas[linhas.length - 1]
    const vizinho =
      atual !== undefined &&
      atual.altura !== null &&
      atual.page === item.page &&
      Math.abs(atual.y - item.y) <= MESMA_LINHA &&
      item.x - atual.fim <= atual.altura * FATOR_DE_ESPACO
    if (vizinho) {
      atual.partes.push(item.text.trim())
      atual.fim = item.x + item.width
      continue
    }
    linhas.push({
      page: item.page,
      x: item.x,
      y: item.y,
      fim: item.x + item.width,
      altura: alturaUtil(item),
      partes: [item.text.trim()]
    })
  }

  // 2. PARÁGRAFOS: linhas seguidas, na mesma coluna, sem buraco vertical entre elas.
  const paragrafos: Paragrafo[] = []
  for (const linha of linhas) {
    const texto = linha.partes.join(' ').trim()
    if (!texto) continue
    /**
     * Linha que é ela mesma "Rótulo: valor" COMEÇA parágrafo, nunca continua o de cima: sem a regra,
     * uma ficha datilografada de poucas linhas virava um campo só com a ficha inteira dentro. A busca
     * da continuação é de trás pra frente, e não só no último parágrafo, porque em página de duas
     * colunas as linhas chegam alternadas.
     */
    const comecaCampoNovo = ehRotuloDaPessoa(texto)

    const continuacao = comecaCampoNovo
      ? undefined
      : [...paragrafos]
          .reverse()
          .find(
            (p) =>
              p.page === linha.page &&
              Math.abs(p.x - linha.x) <= MARGEM &&
              p.y - linha.y > 0 &&
              linha.altura !== null &&
              p.y - linha.y <= linha.altura * FATOR_DE_ENTRELINHA
          )
    if (continuacao) {
      continuacao.linhas.push(texto)
      continuacao.y = linha.y
      continue
    }
    paragrafos.push({ page: linha.page, x: linha.x, y: linha.y, linhas: [texto] })
  }

  return paragrafos
}

/**
 * Os parágrafos agrupados por REGIÃO da página, cada região na ordem em que se lê. A Kids on Bikes
 * tem duas colunas bem separadas, e ordenar tudo por altura intercala as duas ("rodrigo barreto / 11
 * / Novo Aluno Misterioso / +1 / d20"). Agrupar por região não afirma que o "d20" é o dado de Força:
 * só devolve junto o que foi escrito junto.
 */
export function regioesDaFicha(sheet: PdfSheet): string[][] {
  return porRegiao(paragrafosCrus(sheet)).map((regiao) =>
    regiao.map((p) => p.linhas.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  )
}

/**
 * Onde uma COLUNA acaba e a outra começa, em pontos de PDF. Medido nas duas páginas do arquivo real:
 * dentro da mesma coluna a maior variação de margem é 62 (recuo de lista); entre colunas, 201 e 217.
 */
const ENTRE_COLUNAS = 120

function porRegiao(paragrafos: Paragrafo[]): Paragrafo[][] {
  const regioes: Paragrafo[][] = []
  // Por página, e dentro dela por margem esquerda: é a margem que separa uma coluna da outra.
  const paginas = [...new Set(paragrafos.map((p) => p.page))].sort((a, b) => a - b)

  for (const pagina of paginas) {
    const daPagina = [...paragrafos.filter((p) => p.page === pagina)].sort((a, b) => a.x - b.x)
    let atual: Paragrafo[] = []
    let ultimoX: number | null = null

    for (const paragrafo of daPagina) {
      if (ultimoX !== null && paragrafo.x - ultimoX > ENTRE_COLUNAS) {
        regioes.push(atual)
        atual = []
      }
      atual.push(paragrafo)
      ultimoX = paragrafo.x
    }
    if (atual.length > 0) regioes.push(atual)
  }

  // Dentro da região, de cima pra baixo — que é como se lê uma coluna.
  return regioes.map((regiao) => [...regiao].sort((a, b) => b.y - a.y))
}

/**
 * A altura da fonte, ou `null` quando o PDF não declara uma — e aí a linha não junta com ninguém.
 * Chutar um piso de 10 pontos fazia um arquivo de entrelinha 17 virar um parágrafo só por página:
 * perder a remontagem custa linhas soltas, colar tudo custa a ficha.
 */
function alturaUtil(item: PdfText): number | null {
  return item.height > 0 ? item.height : null
}

/** Rótulo digitado pela própria pessoa, na forma "Heróico: você não precisa…". */
const ROTULO_E_VALOR = /^([^:]{2,28})\s*:\s*(\S[\s\S]*)$/

/**
 * O texto começa com um rótulo que a PESSOA escreveu? Mesma régua que `camposDeAnotacao` usa pra
 * decidir o que vira campo, separada porque a remontagem de parágrafos precisa dela antes.
 */
function rotuloDaPessoa(texto: string): { label: string; value: string } | null {
  const match = ROTULO_E_VALOR.exec(texto)
  if (!match) return null
  const label = match[1].trim()
  // A régua do que é rótulo é UMA, a de `camposDoTexto` — a revisão de código pegou uma cópia dela
  // aqui, e cópia é o jeito de as duas leituras da ficha passarem a discordar.
  return ehRotuloPlausivel(label) ? { label, value: match[2].trim() } : null
}

function ehRotuloDaPessoa(texto: string): boolean {
  return rotuloDaPessoa(texto) !== null
}

/** A partir daqui o valor é descrição, não dado solto. Mesmo número do leitor de Oblivio. */
const TAMANHO_DE_HABILIDADE = 25

/**
 * Um parágrafo escrito como "Rótulo: valor" vira CAMPO; o resto continua texto. É o único rótulo
 * confiável que este tipo de arquivo tem, porque foi DIGITADO e não desenhado — nesta ficha, as
 * vantagens do personagem ("Durão: Se você perder uma rolagem…") vêm assim.
 */
export function camposDeAnotacao(paragrafos: string[]): {
  fields: SheetImportField[]
  restante: string[]
  /**
   * Os parágrafos JÁ RESOLVIDOS: os que viraram campo (inclusive os descartados por repetição) e os
   * jogados fora de propósito. Quem monta o texto solto usa esta lista, e não a de campos: sem ela, a
   * frase repetida sumia dos campos e reaparecia no texto, o mesmo conteúdo duas vezes na ficha.
   */
  consumidos: Set<string>
} {
  const fields: SheetImportField[] = []
  const restante: string[] = []
  const consumidos = new Set<string>()

  for (const paragrafo of paragrafos) {
    const rotulado = rotuloDaPessoa(paragrafo)
    if (rotulado) {
      const { label, value } = rotulado
      /**
       * Parágrafo nomeado pela própria pessoa e descrito por extenso é HABILIDADE — mesma régua do
       * leitor de Oblivio. Sem grupo, esses campos caíam numa seção genérica que não diz nada.
       */
      fields.push(
        value.length > TAMANHO_DE_HABILIDADE ? { label, value, group: 'Habilidades' } : { label, value }
      )
      consumidos.add(paragrafo)
      continue
    }

    if (ehSoMarca(paragrafo)) {
      consumidos.add(paragrafo)
      continue
    }
    restante.push(paragrafo)
  }

  return { fields: semRepetirOMesmoTexto(fields), restante, consumidos }
}

/**
 * Parágrafo que é só MARCA DE CAIXINHA — "X", "X X", "checked". O X marca uma caixa do DESENHO, e um
 * "X" sozinho na ficha não diz que caixa era nem de que lista. "xxxxxxxx" é outra coisa: é a pessoa
 * ocupando um campo, e fica.
 */
function ehSoMarca(paragrafo: string): boolean {
  const limpo = paragrafo.trim()
  return limpo.length <= 5 && MARCAS.test(limpo)
}

/** O que é só uma MARCA de "sim" numa ficha desenhada — X, tique, quadradinho marcado. */
const MARCAS = /^[xX✓✔☑][\s✓✔☑xX]*$/

/**
 * Tira o campo que repete o MESMO VALOR sob um rótulo menos específico: na Kids on Bikes, "Você
 * ganha +1 em testes de Luta." aparece nas duas páginas, uma vez como "preta intensa" e outra como
 * "bike preta intensa", porque na página 1 a palavra "bike" faz parte do desenho.
 *
 * Exige as DUAS coisas, valor idêntico e um rótulo contido no outro: duas vantagens podem ter a
 * mesma descrição curta. Rótulos que não se contêm ficam os dois — aí são nomes diferentes.
 */
function semRepetirOMesmoTexto(fields: SheetImportField[]): SheetImportField[] {
  const mantidos: SheetImportField[] = []

  for (const campo of fields) {
    const anterior = mantidos.findIndex(
      (outro) =>
        outro.value === campo.value &&
        (contem(outro.label, campo.label) || contem(campo.label, outro.label))
    )
    if (anterior < 0) {
      mantidos.push(campo)
      continue
    }
    // Fica o rótulo mais longo: é o que traz a palavra que o outro perdeu pro desenho.
    if (campo.label.length > mantidos[anterior].label.length) mantidos[anterior] = campo
  }

  return mantidos
}

function contem(maior: string, menor: string): boolean {
  return maior.toLocaleLowerCase('pt-BR').includes(menor.toLocaleLowerCase('pt-BR'))
}

/**
 * Palpite de NOME do personagem: o primeiro texto da página 1, que em ficha de RPG fica no alto e à
 * esquerda. É palpite e o campo é editável na conferência — a alternativa era o nome do ARQUIVO, que
 * aqui daria "Ficha Kids on Bikes - Preenchida" como nome do personagem.
 */
export function palpiteDeNome(paragrafos: string[]): string {
  const primeiro = paragrafos[0]?.trim() ?? ''
  if (!primeiro || primeiro.length > 40) return ''
  if (!/[\p{L}]{2}/u.test(primeiro)) return ''
  if (ehTituloDeFicha(primeiro)) return ''
  /**
   * VÁRIAS PALAVRAS todas em caixa alta é TÍTULO, não nome: "KIDS ON BIKES" e "RESULTADOS DO
   * TRIMESTRE" (um slide arrastado por engano) viravam personagem. Uma palavra só em caixa alta
   * ("RIEBECK") continua valendo: apelido gritado é nome de gente.
   */
  if (!/[\p{Ll}]/u.test(primeiro) && primeiro.split(/\s+/).length >= 2) return ''
  return primeiro
}

/**
 * O que NUNCA é nome: o título impresso da própria ficha ("KIDS ON BIKES CHARACTER SHEET" virava um
 * personagem chamado assim). Em português e em inglês, porque a régua do importador é a mesma.
 */
const TITULO_DE_FICHA = /\b(ficha|sheet|character|personagem|investigador|investigator)\b/iu

export function ehTituloDeFicha(texto: string): boolean {
  return TITULO_DE_FICHA.test(texto)
}
