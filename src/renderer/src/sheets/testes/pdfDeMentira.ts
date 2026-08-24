/**
 * Fábrica de PDFs TORTOS pra teste.
 *
 * As fichas de verdade (`Fichas RPG/`) cobrem o caminho feliz de três sistemas. O que elas não
 * cobrem é o arquivo que a pessoa do outro lado vai arrastar pra dentro do app: PDF exportado por
 * ferramenta desconhecida, ficha digitalizada sem camada de texto, arquivo truncado no meio do
 * download, coisa que não é PDF apesar da extensão. Não dá pra pedir esses arquivos emprestados —
 * dá pra fabricá-los.
 *
 * Escreve o PDF byte a byte (objetos numerados + tabela `xref` com deslocamentos reais) em vez de
 * usar uma biblioteca, porque o ponto é justamente controlar o que está ERRADO no arquivo. Uma
 * biblioteca que gera PDF só gera PDF certo.
 *
 * `latin1` em todo lugar: a estrutura do PDF é ASCII e um deslocamento de `xref` conta BYTES. Contar
 * caracteres UTF-16 do JavaScript daria offsets errados no primeiro acento.
 */

export interface ObjetoPdf {
  /** Corpo do objeto, sem o `N 0 obj` / `endobj` em volta. */
  corpo: string
}

/**
 * Monta o arquivo a partir dos objetos, na ordem — o objeto 1 é sempre o catálogo.
 * `trailerExtra` entra dentro do dicionário do trailer (usado pra `/Encrypt`).
 */
export function montarPdf(objetos: ObjetoPdf[], trailerExtra = ''): Uint8Array {
  const partes: string[] = ['%PDF-1.7\n']
  const deslocamentos: number[] = []
  let posicao = Buffer.byteLength(partes[0], 'latin1')

  objetos.forEach((objeto, indice) => {
    const texto = `${indice + 1} 0 obj\n${objeto.corpo}\nendobj\n`
    deslocamentos.push(posicao)
    partes.push(texto)
    posicao += Buffer.byteLength(texto, 'latin1')
  })

  const inicioXref = posicao
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const deslocamento of deslocamentos) {
    // Exatamente 20 bytes por entrada — o formato é fixo no spec, e errar aqui faz o pdf.js
    // desistir da tabela e reconstruir por varredura, que é justamente o que não se quer testar.
    xref += `${String(deslocamento).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R ${trailerExtra}>>\nstartxref\n${inicioXref}\n%%EOF\n`
  partes.push(xref)

  return new Uint8Array(Buffer.from(partes.join(''), 'latin1'))
}

/**
 * Escapa o que uma string literal de PDF (`(...)`) não aceita cru: parêntese e contrabarra. Sem
 * isto, um parêntese no meio do texto FECHA a string antes da hora e o resto do fluxo vira comando
 * inválido — o PDF ainda abre, mas o texto some, o que num teste apareceria como "o leitor não leu".
 */
function escaparTextoPdf(texto: string): string {
  return texto.replace(/[()\\]/g, (caractere) => `\\${caractere}`)
}

/** Fluxo de conteúdo que desenha um texto na página — é o que vira `PdfText` na leitura. */
export function fluxoDeTexto(linhas: { texto: string; x: number; y: number }[]): string {
  const corpo = linhas
    .map((linha) => `BT /F1 12 Tf ${linha.x} ${linha.y} Td (${escaparTextoPdf(linha.texto)}) Tj ET`)
    .join('\n')
  return `<< /Length ${Buffer.byteLength(corpo, 'latin1')} >>\nstream\n${corpo}\nendstream`
}

export interface OpcoesPdf {
  /** Anotações de widget, já como corpo de objeto — é aqui que entram os campos torcidos. */
  widgets?: string[]
  linhas?: { texto: string; x: number; y: number }[]
  /** Páginas declaradas no `/Count` — mentir aqui é um dos defeitos que se quer testar. */
  paginas?: number
  trailerExtra?: string
  /** Entra dentro do dicionário do catálogo — é por aqui que se planta um `/OpenAction` com JavaScript. */
  catalogoExtra?: string
}

/**
 * Um PDF de uma página com os campos e textos pedidos.
 *
 * Numeração fixa pra manter as referências legíveis: 1 catálogo, 2 árvore de páginas, 3 página,
 * 4 conteúdo, 5 fonte, 6+ widgets.
 */
export function pdfDeUmaPagina(opcoes: OpcoesPdf = {}): Uint8Array {
  const widgets = opcoes.widgets ?? []
  const linhas = opcoes.linhas ?? []
  const primeiroWidget = 6
  const referencias = widgets.map((_, i) => `${primeiroWidget + i} 0 R`).join(' ')

  const objetos: ObjetoPdf[] = [
    {
      corpo:
        `<< /Type /Catalog /Pages 2 0 R${widgets.length ? ` /AcroForm << /Fields [${referencias}] >>` : ''}` +
        `${opcoes.catalogoExtra ? ` ${opcoes.catalogoExtra}` : ''} >>`
    },
    { corpo: `<< /Type /Pages /Kids [3 0 R] /Count ${opcoes.paginas ?? 1} >>` },
    {
      corpo:
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ` +
        `/Resources << /Font << /F1 5 0 R >> >>` +
        `${widgets.length ? ` /Annots [${referencias}]` : ''} >>`
    },
    { corpo: fluxoDeTexto(linhas) },
    /**
     * `/WinAnsiEncoding` é o que faz ACENTO virar acento.
     *
     * Sem ele a fonte usa a codificação padrão do PostScript, em que o byte 0xE7 (o "ç" em latin1)
     * é o sinal de CEDILHA solto — e a leitura devolvia "FOR˙A" no lugar de "FORÇA", "Prontidªo" no
     * lugar de "Prontidão". Isso fazia o corpus de teste parecer um defeito do importador quando era
     * defeito do arquivo fabricado aqui: o leitor de Oblivio não reconhecia "For a" como "Força" e
     * jogava metade dos atributos pro grupo errado, com razão.
     */
    { corpo: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
    ...widgets.map((corpo) => ({ corpo }))
  ]

  return montarPdf(objetos, opcoes.trailerExtra)
}

/** Uma página do PDF de várias páginas: os campos e o texto que moram NELA. */
export interface PaginaPdf {
  widgets?: string[]
  linhas?: { texto: string; x: number; y: number }[]
}

/**
 * PDF com VÁRIAS páginas — ficha de RPG quase nunca cabe em uma.
 *
 * Importa porque a página é parte da identidade de campo e de texto (`PdfField.page`/`PdfText.page`)
 * e é o que impede um campo da página 2 de adotar um rótulo impresso da página 1. Com o PDF de uma
 * página só, essa regra nunca era exercitada: não havia outra página de onde roubar.
 *
 * Numeração: 1 catálogo, 2 árvore de páginas, 3 fonte, e daí em diante um par (página, conteúdo) por
 * página, seguido dos widgets de todas elas.
 */
export function pdfDeVariasPaginas(paginas: PaginaPdf[]): Uint8Array {
  const PRIMEIRA_PAGINA = 4
  const objetos: ObjetoPdf[] = []

  // Onde cada widget vai cair na numeração — precisa ser sabido ANTES de escrever as páginas, que
  // referenciam os widgets delas, e o catálogo, que lista todos no `/AcroForm`.
  let proximoWidget = PRIMEIRA_PAGINA + paginas.length * 2
  const widgetsPorPagina = paginas.map((pagina) => {
    const ids = (pagina.widgets ?? []).map(() => proximoWidget++)
    return ids
  })
  const todosOsWidgets = widgetsPorPagina.flat()

  const kids = paginas.map((_, i) => `${PRIMEIRA_PAGINA + i * 2} 0 R`).join(' ')
  const campos = todosOsWidgets.map((id) => `${id} 0 R`).join(' ')

  objetos.push({
    corpo: `<< /Type /Catalog /Pages 2 0 R${todosOsWidgets.length ? ` /AcroForm << /Fields [${campos}] >>` : ''} >>`
  })
  objetos.push({ corpo: `<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>` })
  // `/WinAnsiEncoding` pelo mesmo motivo do PDF de uma página: sem ele, acento vira lixo.
  objetos.push({ corpo: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' })

  paginas.forEach((pagina, i) => {
    const idConteudo = PRIMEIRA_PAGINA + i * 2 + 1
    const anots = widgetsPorPagina[i].map((id) => `${id} 0 R`).join(' ')
    objetos.push({
      corpo:
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${idConteudo} 0 R ` +
        `/Resources << /Font << /F1 3 0 R >> >>` +
        `${anots ? ` /Annots [${anots}]` : ''} >>`
    })
    objetos.push({ corpo: fluxoDeTexto(pagina.linhas ?? []) })
  })

  for (const pagina of paginas) for (const corpo of pagina.widgets ?? []) objetos.push({ corpo })

  return montarPdf(objetos)
}

/** Widget bem formado — a base de comparação pros tortos. */
export function widget(nome: string, valor: string, rect = '[100 700 250 720]'): string {
  return `<< /Type /Annot /Subtype /Widget /FT /Tx /T (${nome}) /V (${valor}) /Rect ${rect} >>`
}
