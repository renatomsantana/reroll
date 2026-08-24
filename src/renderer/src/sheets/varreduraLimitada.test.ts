import { describe, expect, it, vi } from 'vitest'
import { MAXIMO_DE_CAMPOS_DA_FICHA, MAXIMO_DE_PAGINAS_DA_FICHA, MAXIMO_DE_TEXTOS_DA_FICHA } from '@shared/types/sheetImport'
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

  it('acima do teto de páginas não lê NADA — é livro, não ficha', async () => {
    /**
     * Esta regra já foi "lê as 100 primeiras e para". Os livros de regras de Pathfinder 2e (322 a
     * 466 páginas) mostraram o que isso rendia: campos tirados da prosa, presets de regra e um nome
     * de personagem com uma frase inteira. Agora o documento acima do teto volta vazio, com o
     * `pageCount` real, e o leitor avisa (`paginas-demais`).
     */
    const { doc, getPage } = documentoDeMentira(50_000)
    const sheet = await sheetFromPdfDocument('bomba.pdf', doc)

    expect(getPage).not.toHaveBeenCalled()
    expect(sheet.texts).toEqual([])
    expect(sheet.fields).toEqual([])
    expect(sheet.pageCount).toBe(50_000)

    // No teto exato, lê tudo.
    const noLimite = documentoDeMentira(MAXIMO_DE_PAGINAS_DA_FICHA)
    const lida = await sheetFromPdfDocument('grande.pdf', noLimite.doc)
    expect(noLimite.getPage).toHaveBeenCalledTimes(MAXIMO_DE_PAGINAS_DA_FICHA)
    expect(lida.texts).toHaveLength(MAXIMO_DE_PAGINAS_DA_FICHA)
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

/**
 * O TETO DE CAMPOS E DE FRAGMENTOS — achado da revisão do scraping.
 *
 * Bytes e páginas já tinham teto; campos e textos não, e é neles que os leitores fazem conta
 * campo × texto. Uma página só, com cinco mil campos e duzentos mil fragmentos, cabe em poucos
 * megabytes e congelava a interface inteira. O documento é de mentira pelo mesmo motivo dos testes
 * de cima: o que se mede é o que a varredura GUARDA, e isso não precisa de PDF nenhum.
 */
describe('teto de campos e de fragmentos', () => {
  function paginaGorda(campos: number, textos: number): PdfLikeDocument {
    return {
      numPages: 1,
      getPage: async () => ({
        getAnnotations: async () =>
          Array.from({ length: campos }, (_, i) => ({
            subtype: 'Widget',
            fieldName: `campo${i}`,
            fieldType: 'Tx',
            fieldValue: String(i),
            rect: [0, 0, 10, 10]
          })),
        getTextContent: async () => ({
          items: Array.from({ length: textos }, (_, i) => ({ str: `t${i}`, transform: [1, 0, 0, 1, i, i] }))
        })
      })
    }
  }

  it('guarda tudo quando cabe', async () => {
    const sheet = await sheetFromPdfDocument('ok.pdf', paginaGorda(500, 900))
    expect(sheet.fields).toHaveLength(500)
    expect(sheet.texts).toHaveLength(900)
  })

  it('para nos tetos quando o arquivo passa deles', async () => {
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const sheet = await sheetFromPdfDocument(
      'bomba.pdf',
      paginaGorda(MAXIMO_DE_CAMPOS_DA_FICHA + 3_000, MAXIMO_DE_TEXTOS_DA_FICHA + 40_000)
    )
    expect(sheet.fields).toHaveLength(MAXIMO_DE_CAMPOS_DA_FICHA)
    expect(sheet.texts).toHaveLength(MAXIMO_DE_TEXTOS_DA_FICHA)
    // Avisou uma vez por teto, e não uma vez por item excedente.
    expect(avisos.mock.calls.filter(([m]) => /campos/.test(String(m)))).toHaveLength(1)
    expect(avisos.mock.calls.filter(([m]) => /fragmentos/.test(String(m)))).toHaveLength(1)
    avisos.mockRestore()
  })
})
