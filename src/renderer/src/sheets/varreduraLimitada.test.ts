import { describe, expect, it, vi } from 'vitest'
import { MAXIMO_DE_PAGINAS_DA_FICHA } from '@shared/types/sheetImport'
import { sheetFromPdfDocument, type PdfLikeDocument } from './sheetFromPdfDocument'

/**
 * O TETO DE PÁGINAS da varredura.
 *
 * O limite de bytes do arquivo (`TAMANHO_MAXIMO_DA_FICHA`, 80 MB) não cobre este caso, e a diferença
 * é o que torna o teste necessário: página de PDF quase não ocupa espaço, então um arquivo pequeno
 * pode declarar dezenas de milhares delas. A varredura custa por PÁGINA — duas chamadas assíncronas
 * ao pdf.js em cada uma —, e uma ficha assim deixa a importação girando por minutos numa espera que
 * não tem botão de cancelar. Pra quem está olhando, o app pendurou.
 *
 * O documento aqui é de mentira de propósito: o que se está medindo é QUANTAS VEZES `getPage` é
 * chamado, e isso não precisa de PDF nenhum.
 */

function documentoDeMentira(numPages: number): { doc: PdfLikeDocument; getPage: ReturnType<typeof vi.fn> } {
  const getPage = vi.fn(async (numero: number) => ({
    getAnnotations: async () => [],
    getTextContent: async () => ({ items: [{ str: `página ${numero}`, transform: [1, 0, 0, 1, 10, 20] }] })
  }))
  return { doc: { numPages, getPage }, getPage }
}

describe('varredura do PDF', () => {
  it('lê o documento inteiro quando ele cabe no limite', async () => {
    const { doc, getPage } = documentoDeMentira(5)
    const sheet = await sheetFromPdfDocument('ficha.pdf', doc)

    expect(getPage).toHaveBeenCalledTimes(5)
    expect(sheet.texts).toHaveLength(5)
  })

  it('para no limite quando o arquivo declara páginas demais', async () => {
    const { doc, getPage } = documentoDeMentira(50_000)
    const sheet = await sheetFromPdfDocument('bomba.pdf', doc)

    expect(getPage).toHaveBeenCalledTimes(MAXIMO_DE_PAGINAS_DA_FICHA)
    expect(sheet.texts).toHaveLength(MAXIMO_DE_PAGINAS_DA_FICHA)
  })

  it('devolve o número REAL de páginas, e não o número lido', async () => {
    /**
     * Os dois números são coisas diferentes, e os leitores usam o de verdade: os avisos
     * `pdf-sem-texto` e `sem-formulario` dizem "nenhuma das N páginas trazia isso". Carimbar 100 no
     * lugar de 50 mil transformaria um aviso correto numa informação errada sobre o arquivo da
     * pessoa.
     */
    const { doc } = documentoDeMentira(50_000)
    expect((await sheetFromPdfDocument('bomba.pdf', doc)).pageCount).toBe(50_000)
  })

  it('página que não abre não leva as outras junto', async () => {
    const getPage = vi.fn(async (numero: number) => {
      if (numero === 2) throw new Error('página corrompida')
      return {
        getAnnotations: async () => [],
        getTextContent: async () => ({ items: [{ str: 'ok', transform: [1, 0, 0, 1, 0, 0] }] })
      }
    })
    const sheet = await sheetFromPdfDocument('meio-quebrada.pdf', { numPages: 3, getPage })

    expect(getPage).toHaveBeenCalledTimes(3)
    expect(sheet.texts).toHaveLength(2)
  })
})
