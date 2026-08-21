import { readFileSync } from 'fs'
import type { PdfSheet } from '@shared/types/sheetImport'
import { sheetFromPdfDocument } from '../sheetFromPdfDocument'

/**
 * Abre um PDF de verdade em ambiente de TESTE e devolve a mesma `PdfSheet` que o app produziria.
 *
 * O app abre o arquivo em `extractPdfSheet.ts`, que não roda aqui: ele importa o worker do pdf.js
 * com `?worker`, transformação do Vite que só existe no bundle. O que este helper NÃO faz é
 * reimplementar a varredura — ela é a de produção (`sheetFromPdfDocument`). Antes eram duas cópias,
 * uma em cada teste de ficha real, e elas divergiram: as cópias protegiam `rect` contra ausência e a
 * produção não, então o arquivo que derrubava o app passava no teste.
 *
 * Não é um `.test.ts` de propósito — é ferramenta de teste, não teste.
 */
export async function abrirPdfNoNode(caminho: string): Promise<PdfSheet> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(caminho)),
    useSystemFonts: true
  }).promise

  // Barra dos dois lados: o caminho vem do `join` do Node, que no Windows usa contrabarra.
  const fileName = caminho.split(/[\\/]/).pop() ?? ''
  return sheetFromPdfDocument(fileName, doc)
}

/** Mesma coisa a partir dos BYTES — pro teste que fabrica o PDF em vez de ler do disco. */
export async function abrirPdfDeBytes(fileName: string, bytes: Uint8Array): Promise<PdfSheet> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise
  return sheetFromPdfDocument(fileName, doc)
}
