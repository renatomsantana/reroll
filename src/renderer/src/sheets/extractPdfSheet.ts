/**
 * O build LEGACY, e não o padrão.
 *
 * A RAZÃO ORIGINAL JÁ NÃO VALE, e está escrita aqui porque é o que impede alguém de recriar o
 * problema: o `pdfjs-dist` 6 usa `Uint8Array.prototype.toHex()`, que só existe do Chromium 140 pra
 * frente. O Electron 33, que o app usava, embarcava o Chromium 130 — então o build padrão morria na
 * abertura de QUALQUER arquivo com "i.toHex is not a function", quebrando o importador inteiro no
 * app instalado. Passou despercebido em teste porque a primeira verificação rodou no Node 24, cujo
 * V8 já tinha o método; só apareceu ao rodar a cadeia DENTRO do Electron, que é onde ela vive.
 *
 * Com o Electron 43 (Chromium 150) o método existe, e o build padrão passaria a funcionar. O legacy
 * FICA assim mesmo, por dois motivos que não são inércia:
 *
 * 1. os testes contra as fichas de verdade abrem os PDFs pelo legacy (`testes/abrirPdfNoNode.ts`),
 *    porque `?worker` é transformação do Vite e não roda em teste. Trocar só a produção criaria
 *    duas cadeias de leitura diferentes — o defeito exato que já aconteceu duas vezes neste
 *    importador, e que sempre aparece como "o arquivo que derruba o app passa no teste";
 * 2. a diferença é de transpilação, não de comportamento: mesmo analisador, sintaxe mais velha.
 *
 * PRA SAIR DO LEGACY: trocar os dois lugares na mesma mudança e rodar `fichasReais.node.test.ts`
 * com as fichas de `Fichas RPG/` presentes — é ele que compara o que foi lido, campo a campo.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?worker'
import type { PdfSheet } from '@shared/types/sheetImport'
import { sheetFromPdfDocument } from './sheetFromPdfDocument'
import { extrairRetratoDaPagina } from './retratoDoPdf'

/**
 * Abre o PDF e devolve o que dá pra ler dele: campos de formulário e texto impresso com posição.
 *
 * É a ÚNICA parte do importador que sabe o que é um PDF. Tudo depois daqui (`readers/`) trabalha
 * sobre `PdfSheet`, sem nunca tocar no pdf.js — que é o que torna leitor de ficha testável sem
 * arquivo nenhum.
 *
 * Roda no RENDERER, e não no processo principal, por um motivo de empacotamento: o `pdfjs-dist` é
 * ESM puro (só publica `.mjs`), e o bundle do processo principal é CommonJS — um `require` dele
 * morre com ERR_REQUIRE_ESM. No renderer ele é bundlado pelo Vite como qualquer outra dependência.
 * De brinde, o app instalado não engorda: como dependência de desenvolvimento ele entra no bundle
 * (~1.5 MB) em vez de o electron-builder copiar o pacote inteiro (34 MB) pra dentro do `app.asar`.
 *
 * O processo principal continua fazendo a parte dele — abrir o seletor de arquivo e ler os bytes —,
 * porque renderer não tem acesso a disco.
 */

/**
 * O worker do pdf.js num Worker de verdade (`?worker` do Vite).
 *
 * Sem ele o pdf.js roda tudo na thread da interface, e uma ficha de 4 MB com 458 campos trava a
 * janela por segundos — no meio de uma importação, isso lê como app travado.
 *
 * Dentro de `try`, e sem relançar, porque a falha aqui é de INFRAESTRUTURA, não de leitura: o
 * `?worker` é resolvido pelo Vite na hora de empacotar, e se a URL do arquivo não servir no app
 * instalado o construtor estoura. O pdf.js sabe trabalhar sem worker (ele cai num "fake worker" na
 * própria thread), então o pior caso vira uma importação mais lenta em vez de um botão que não faz
 * nada — e o console diz por quê.
 */
try {
  pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
} catch (causa) {
  console.warn('Worker do pdf.js indisponível; a leitura vai rodar na thread da interface.', causa)
}

export async function extractPdfSheet(fileName: string, bytes: Uint8Array): Promise<PdfSheet> {
  /**
   * `useSystemFonts` deixa o pdf.js recorrer às fontes do sistema quando o arquivo não embute a
   * fonte. Importa pra LEITURA, não pro visual: sem fonte, o texto de algumas fichas volta com
   * caractere trocado, e é sobre esse texto que os rótulos são casados.
   */
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise

  /**
   * A varredura em si mora em `sheetFromPdfDocument`, e não aqui, pra poder ser testada contra
   * arquivos de verdade — inclusive os torcidos. Ver o comentário de lá.
   */
  const sheet = await sheetFromPdfDocument(fileName, doc)

  /**
   * O RETRATO da primeira página (spec §3.6), à parte da varredura e dentro do próprio `try`:
   * decodificar imagem é onde um PDF estranho mais tem como falhar, e retrato nenhum segura a
   * importação. Só a primeira página, que é a de identificação em toda ficha que o app conhece.
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
  return sheet
}
