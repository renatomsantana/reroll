import type { PDFDocumentProxy } from 'pdfjs-dist'
import { LARGURA_DA_PAGINA_GUARDADA, MAXIMO_DE_PAGINAS_GUARDADAS } from '@shared/types/paginasDaFicha'

/**
 * Desenha as páginas do PDF em imagens JPEG (data URL), na largura de `LARGURA_DA_PAGINA_GUARDADA`
 * — ver `paginasDaFicha.ts` pra o porquê. Roda no renderer, que é onde o pdf.js já vive e onde
 * existe `<canvas>`.
 *
 * Uma página que não desenha (fonte quebrada, imagem corrompida) é PULADA, e não derruba as
 * outras nem a importação: as páginas são um extra da leitura, nunca a condição dela.
 */
export async function desenharPaginas(doc: PDFDocumentProxy, maximo = MAXIMO_DE_PAGINAS_GUARDADAS): Promise<string[]> {
  const paginas: string[] = []
  const total = Math.min(doc.numPages, maximo)
  for (let numero = 1; numero <= total; numero++) {
    try {
      const pagina = await doc.getPage(numero)
      const natural = pagina.getViewport({ scale: 1 })
      const viewport = pagina.getViewport({ scale: LARGURA_DA_PAGINA_GUARDADA / natural.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const contexto = canvas.getContext('2d')
      if (!contexto) break
      // Fundo branco: página sem fundo desenhado ficaria preta no JPEG, que não tem transparência.
      contexto.fillStyle = '#ffffff'
      contexto.fillRect(0, 0, canvas.width, canvas.height)
      /**
       * `annotationMode: 2` (ENABLE_FORMS) desenha os CAMPOS DE FORMULÁRIO com o que está escrito
       * neles. Sem isto a ficha preenchível (Ordem, Pathfinder) sairia como o modelo em branco: o
       * pdf.js, por padrão, não pinta os widgets — e a "ficha original" sem os valores não é a ficha
       * original. A mesma escolha de `retratoDoPdf.ts`, pelo mesmo motivo.
       */
      await pagina.render({ canvasContext: contexto, viewport, canvas, annotationMode: 2 }).promise
      paginas.push(canvas.toDataURL('image/jpeg', 0.82))
    } catch (causa) {
      console.warn(`Não deu pra desenhar a página ${numero} do PDF; seguindo sem ela.`, causa)
    }
  }
  return paginas
}
