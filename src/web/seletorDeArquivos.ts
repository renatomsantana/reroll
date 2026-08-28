/**
 * A `PlataformaDeArquivos` de verdade do navegador (ver `shims/electron.ts`): abrir arquivo é um
 * `<input type="file">` invisível, salvar é um download.
 *
 * As chamadas sempre nascem de um clique da pessoa (importar ficha, exportar personagem...), então
 * o `input.click()` programático é permitido pelo navegador.
 */
import type { ArquivoEscolhido, PlataformaDeArquivos } from './shims/electron'

export const plataformaDoNavegador: PlataformaDeArquivos = {
  abrirArquivo(opcoes): Promise<ArquivoEscolhido> {
    return new Promise((resolver) => {
      const entrada = document.createElement('input')
      entrada.type = 'file'
      const extensoes = opcoes.filtros.flatMap((filtro) => filtro.extensions).filter((ext) => ext !== '*')
      if (extensoes.length > 0) entrada.accept = extensoes.map((ext) => `.${ext}`).join(',')
      entrada.addEventListener('change', () => {
        const arquivo = entrada.files?.[0]
        if (!arquivo) return resolver(null)
        arquivo
          .arrayBuffer()
          .then((bytes) => resolver({ nome: arquivo.name, bytes: new Uint8Array(bytes) }))
          .catch(() => resolver(null))
      })
      // O evento `cancel` do input de arquivo é recente (2023+), mas a versão web já pede navegador
      // atual pelo resto (WebGL 2, wasm do pdf.js). Sem ele a promessa ficaria pendurada — que é
      // exatamente o defeito do "botão que não faz nada" que o PdfEscolhido existe pra impedir.
      entrada.addEventListener('cancel', () => resolver(null))
      entrada.click()
    })
  },

  baixarArquivo(nome, conteudo): void {
    const url = URL.createObjectURL(new Blob([conteudo.slice().buffer]))
    const elo = document.createElement('a')
    elo.href = url
    elo.download = nome
    document.body.appendChild(elo)
    elo.click()
    elo.remove()
    // Depois de um tempo folgado: revogar no mesmo tick já cancelou download em navegador real.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}
