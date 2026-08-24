import {
  MAXIMO_DE_CAMPOS_DA_FICHA,
  MAXIMO_DE_PAGINAS_DA_FICHA,
  MAXIMO_DE_TEXTOS_DA_FICHA,
  type PdfField,
  type PdfSheet,
  type PdfText
} from '@shared/types/sheetImport'

/**
 * A conversão de um documento já aberto do pdf.js pra `PdfSheet`, separada de quem ABRE o arquivo
 * (`extractPdfSheet.ts`).
 *
 * A separação existe por um motivo de teste, não de organização: `extractPdfSheet` importa o worker
 * do pdf.js com `?worker`, que é transformação do Vite e não existe fora do bundle — então ele não
 * roda em teste. Enquanto esta parte vivia lá dentro, o teste contra as fichas de verdade
 * (`fichasReais.node.test.ts`) mantinha uma CÓPIA da conversão, e as duas divergiram: a cópia
 * protegia `rect` com `?? [0,0,0,0]` e a de produção lia `anotacao.rect[0]` direto. Ou seja, o
 * arquivo que fizesse a produção estourar passava no teste.
 *
 * Recebe o documento pronto justamente pra não saber de onde ele veio — no app vem do worker, no
 * teste vem do build legacy chamado direto.
 */

/** O mínimo que este módulo precisa de um documento do pdf.js — não o tipo inteiro da biblioteca. */
export interface PdfLikeDocument {
  numPages: number
  getPage(numero: number): Promise<PdfLikePage>
}

export interface PdfLikePage {
  getAnnotations(): Promise<unknown[]>
  getTextContent(): Promise<{ items: unknown[] }>
}

/** Número utilizável, ou o padrão: PDF de terceiro traz `NaN`, `null` e string onde deveria haver número. */
function numero(valor: unknown, padrao = 0): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : padrao
}

/**
 * O retângulo do campo, sempre com quatro números.
 *
 * HONESTIDADE SOBRE ESTA GUARDA: ela não conserta um defeito observado. Medido contra o pdf.js 6
 * (`pdfEstranho.node.test.ts`), TODO `/Rect` torto — ausente, não-array, com dois elementos, com
 * texto ou nome dentro, `null` — volta de `getAnnotations()` já normalizado pra `[0,0,0,0]`. O
 * código antigo lia `anotacao.rect[0]` direto e nunca estourou por isso.
 *
 * O que ela vale: o `PdfSheet` é o contrato com os leitores (`readers/`), e eles fazem conta de
 * distância com esses números. A normalização é comportamento do pdf.js, não promessa do formato —
 * uma versão nova pode entregar o array cru, e aí a conta viraria `NaN` silencioso espalhado pelos
 * rótulos, que é bem pior de achar que um estouro. Custa uma comparação por campo.
 */
function retangulo(valor: unknown): [number, number, number, number] {
  if (!Array.isArray(valor)) return [0, 0, 0, 0]
  return [numero(valor[0]), numero(valor[1]), numero(valor[2]), numero(valor[3])]
}

/**
 * O valor de um campo, que o pdf.js entrega de três formas diferentes conforme o tipo: texto puro,
 * lista (seleção múltipla) ou o estado de uma caixa/botão.
 */
function valorDoCampo(anotacao: { fieldValue?: unknown }): string {
  const valor = anotacao.fieldValue
  if (typeof valor === 'string') return valor
  if (Array.isArray(valor)) return valor.filter((v) => typeof v === 'string').join(', ')
  return textoDePrimitivo(valor)
}

/**
 * Um valor solto de PDF vira texto — mas SÓ se ele for um valor de verdade.
 *
 * `String(qualquerObjeto)` devolve `"[object Object]"`, e o estrago disso é específico do
 * importador: essa string entra na ficha como se fosse o conteúdo do campo, aparece na tela de
 * conferência com cara de dado lido, e a pessoa aprova sem olhar. Objeto e função aqui viram VAZIO,
 * que é honesto — "não deu pra ler" —, e o campo some da conferência em vez de aparecer errado.
 */
function textoDePrimitivo(valor: unknown): string {
  if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'bigint') {
    return String(valor)
  }
  return ''
}

export async function sheetFromPdfDocument(fileName: string, doc: PdfLikeDocument): Promise<PdfSheet> {
  const fields: PdfField[] = []
  const texts: PdfText[] = []
  const pageCount = numero(doc.numPages)
  /**
   * A varredura para no limite; o `pageCount` devolvido continua sendo o REAL.
   *
   * Os dois números são coisas diferentes e os leitores usam o de verdade: `pdf-sem-texto` e
   * `sem-formulario` (ver `sheetWarning.ts`) dizem "nenhuma das N páginas tinha texto", e mentir o N
   * pra 100 transformaria um aviso correto numa informação errada sobre o arquivo da pessoa.
   */
  const ate = Math.min(pageCount, MAXIMO_DE_PAGINAS_DA_FICHA)
  if (pageCount > ate) {
    console.warn(`PDF com ${pageCount} páginas; lendo só as ${ate} primeiras.`)
  }

  for (let numeroPagina = 1; numeroPagina <= ate; numeroPagina++) {
    /**
     * Página a página dentro de `try`: um PDF pode ter UMA página corrompida e as outras boas, e
     * perder a ficha toda por causa disso é pior que importar o que dá. O console diz qual falhou.
     */
    let pagina: PdfLikePage
    try {
      pagina = await doc.getPage(numeroPagina)
    } catch (causa) {
      console.warn(`Página ${numeroPagina} do PDF não pôde ser aberta; seguindo sem ela.`, causa)
      continue
    }

    try {
      for (const bruta of await pagina.getAnnotations()) {
        const anotacao = bruta as {
          subtype?: unknown
          fieldName?: unknown
          fieldType?: unknown
          fieldValue?: unknown
          rect?: unknown
        }
        if (anotacao.subtype !== 'Widget') continue
        if (typeof anotacao.fieldName !== 'string' || !anotacao.fieldName) continue
        // Ver `MAXIMO_DE_CAMPOS_DA_FICHA`: a partir daqui o resto é ignorado, com aviso.
        if (fields.length >= MAXIMO_DE_CAMPOS_DA_FICHA) {
          if (fields.length === MAXIMO_DE_CAMPOS_DA_FICHA) {
            console.warn(`PDF com mais de ${MAXIMO_DE_CAMPOS_DA_FICHA} campos; ignorando o excedente.`)
            fields.push(...[])
          }
          break
        }
        fields.push({
          name: anotacao.fieldName,
          // `fieldType` vem como `unknown` do pdf.js. Mesmo motivo de `textoDePrimitivo`: um objeto
          // aqui viraria o "tipo" `[object object]`, que nenhum leitor reconhece e ninguém entende.
          type: (typeof anotacao.fieldType === 'string' ? anotacao.fieldType : '').toLowerCase(),
          value: valorDoCampo(anotacao),
          page: numeroPagina,
          rect: retangulo(anotacao.rect)
        })
      }
    } catch (causa) {
      console.warn(`Anotações da página ${numeroPagina} não puderam ser lidas.`, causa)
    }

    try {
      for (const bruto of (await pagina.getTextContent()).items) {
        const item = bruto as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown }
        if (typeof item.str !== 'string' || !item.str.trim()) continue
        // Ver `MAXIMO_DE_TEXTOS_DA_FICHA`: mesmo teto, pelo mesmo motivo.
        if (texts.length >= MAXIMO_DE_TEXTOS_DA_FICHA) {
          if (texts.length === MAXIMO_DE_TEXTOS_DA_FICHA) {
            console.warn(`PDF com mais de ${MAXIMO_DE_TEXTOS_DA_FICHA} fragmentos de texto; ignorando o excedente.`)
          }
          break
        }
        /**
         * `transform` é a matriz do texto; os índices 4 e 5 são a posição na página, com a origem
         * embaixo à esquerda — o MESMO referencial dos `rect` dos campos, que é o que permite
         * comparar as duas coisas em `labelForField`.
         */
        const matriz = Array.isArray(item.transform) ? item.transform : []
        texts.push({
          text: item.str,
          page: numeroPagina,
          x: numero(matriz[4]),
          y: numero(matriz[5]),
          width: numero(item.width),
          height: numero(item.height)
        })
      }
    } catch (causa) {
      console.warn(`Texto da página ${numeroPagina} não pôde ser lido.`, causa)
    }
  }

  return { fileName, pageCount, fields, texts }
}
