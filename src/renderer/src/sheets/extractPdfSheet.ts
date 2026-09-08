/**
 * O build LEGACY do pdf.js, e não o padrão. A RAZÃO ORIGINAL JÁ NÃO VALE, e está escrita aqui porque
 * é o que impede alguém de recriar o problema: o `pdfjs-dist` 6 usa `Uint8Array.prototype.toHex()`,
 * que só existe do Chromium 140 pra frente, e o Electron 33 embarcava o 130 — o build padrão morria
 * na abertura com "i.toHex is not a function", e passou no teste porque o Node 24 já tinha o método.
 *
 * Com o Electron 43 o padrão funcionaria. O legacy fica porque os testes contra as fichas de verdade
 * abrem os PDFs por ele (`?worker` é transformação do Vite e não roda em teste), e trocar só a
 * produção criaria duas cadeias de leitura diferentes — o defeito que já apareceu duas vezes aqui
 * como "o arquivo que derruba o app passa no teste". Pra sair: trocar os dois lugares na mesma
 * mudança e rodar `fichasReais.node.test.ts` com as fichas presentes.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?worker'
import type { PdfSheet } from '@shared/types/sheetImport'
import { sheetFromPdfDocument } from './sheetFromPdfDocument'
import { extrairRetratoDaPagina } from './retratoDoPdf'
import { desenharPaginas } from './paginasDoPdf'

/**
 * O worker do pdf.js num Worker de verdade (`?worker` do Vite): sem ele o pdf.js roda tudo na thread
 * da interface, e uma ficha de 4 MB com 458 campos trava a janela por segundos.
 *
 * Dentro de `try` e sem relançar porque a falha aqui é de INFRAESTRUTURA: o `?worker` é resolvido
 * pelo Vite ao empacotar, e se a URL não servir no app instalado o construtor estoura. O pdf.js sabe
 * trabalhar sem worker, então o pior caso é uma importação mais lenta.
 */
try {
  pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
} catch (causa) {
  console.warn('Worker do pdf.js indisponível; a leitura vai rodar na thread da interface.', causa)
}

/**
 * Abre o PDF e devolve o que dá pra ler dele: campos de formulário e texto impresso com posição. É a
 * ÚNICA parte do importador que sabe o que é um PDF — tudo depois daqui trabalha sobre `PdfSheet`, e
 * é isso que torna leitor de ficha testável sem arquivo nenhum.
 *
 * Roda no RENDERER por empacotamento: o `pdfjs-dist` é ESM puro e o bundle do main é CommonJS, então
 * um `require` dele morre com ERR_REQUIRE_ESM. De brinde, como dependência de desenvolvimento ele
 * entra no bundle (~1.5 MB) em vez de o electron-builder copiar o pacote inteiro (34 MB).
 */
export async function extractPdfSheet(fileName: string, bytes: Uint8Array): Promise<PdfSheet> {
  /**
   * `useSystemFonts` deixa o pdf.js recorrer às fontes do sistema quando o arquivo não embute a
   * fonte. Importa pra LEITURA e não pro visual: sem fonte, o texto volta com caractere trocado, e é
   * sobre esse texto que os rótulos são casados.
   */
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise

  /**
   * A varredura em si mora em `sheetFromPdfDocument`, e não aqui, pra poder ser testada contra
   * arquivos de verdade — inclusive os torcidos. Ver o comentário de lá.
   */
  const sheet = await sheetFromPdfDocument(fileName, doc)

  /**
   * O RETRATO da primeira página (spec §3.6), no próprio `try`: decodificar imagem é onde um PDF
   * estranho mais tem como falhar, e retrato nenhum segura a importação.
   */
  if (doc.numPages >= 1) {
    try {
      const primeira = await doc.getPage(1)
      const retrato = await extrairRetratoDaPagina(primeira, pdfjs.OPS.paintImageXObject)
      if (retrato) sheet.retrato = retrato
    } catch (causa) {
      console.warn('Não deu pra extrair o retrato da ficha; seguindo sem ele.', causa)
    }
  }

  /**
   * As PÁGINAS desenhadas (ver `paginasDaFicha.ts`): a conferência mostra o PDF ao lado dos
   * campos, e a Ficha guarda a ficha original. Mesmo `try` à parte, pelo mesmo motivo do retrato.
   */
  try {
    const paginas = await desenharPaginas(doc)
    if (paginas.length > 0) sheet.paginas = paginas
  } catch (causa) {
    console.warn('Não deu pra desenhar as páginas da ficha; seguindo sem elas.', causa)
  }
  return sheet
}
