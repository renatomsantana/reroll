/**
 * O RETRATO embutido na ficha (spec §3.6 / spec de importação, "portrait extraction"): a ficha de
 * Ordem Paranormal e muitas fichas preenchíveis têm um campo de imagem onde a pessoa põe o
 * personagem. Este módulo acha essa imagem na PRIMEIRA página, a de identificação, e a devolve como
 * data URL pra conferência oferecer.
 *
 * Duas metades, de propósito:
 *
 * - `escolherRetrato` é PURA: recebe a lista de imagens da página (nome, largura, altura em pixels)
 *   e diz qual serve. É a heurística, e é o que se testa;
 * - `extrairRetratoDaPagina` fala com o pdf.js e com o canvas — é IO, e roda só no app.
 *
 * NUNCA segura a importação: qualquer falha aqui vira "sem retrato", com uma linha no console.
 */
export interface ImagemDaPagina {
  nome: string
  largura: number
  altura: number
}

/** Menor que isto é ícone, logo, marca d'água — não é retrato de ninguém. */
const LADO_MINIMO = 64
/**
 * Uma imagem que tem a PROPORÇÃO da página e é grande é a própria página (a ficha digitalizada
 * com o formulário por cima, o fundo de arte). Retrato é a foto DENTRO dela, menor.
 */
const LADO_DE_PAGINA = 1000
const TOLERANCIA_DE_PROPORCAO = 0.08
/** Retrato tem cara de retrato: entre 2:5 (bem alto) e 2:1 (bem largo). Faixa de rodapé fica de fora. */
const PROPORCAO_MINIMA = 0.4
const PROPORCAO_MAXIMA = 2.0

/** As que têm tamanho e proporção de foto, da maior pra menor — a primeira que PARECER foto vence. */
export function candidatasARetrato(
  imagens: ImagemDaPagina[],
  pagina: { largura: number; altura: number }
): ImagemDaPagina[] {
  const proporcaoDaPagina = pagina.altura > 0 ? pagina.largura / pagina.altura : 0
  return imagens
    .filter((imagem) => {
      if (imagem.largura < LADO_MINIMO || imagem.altura < LADO_MINIMO) return false
      const proporcao = imagem.largura / imagem.altura
      if (proporcao < PROPORCAO_MINIMA || proporcao > PROPORCAO_MAXIMA) return false
      const grande = imagem.largura >= LADO_DE_PAGINA || imagem.altura >= LADO_DE_PAGINA
      if (grande && Math.abs(proporcao - proporcaoDaPagina) < TOLERANCIA_DE_PROPORCAO) return false
      return true
    })
    .sort((a, b) => b.largura * b.altura - a.largura * a.altura)
}

export function escolherRetrato(
  imagens: ImagemDaPagina[],
  pagina: { largura: number; altura: number }
): ImagemDaPagina | null {
  return candidatasARetrato(imagens, pagina)[0] ?? null
}

/**
 * Isto PARECE uma foto? Uma foto tem muitas cores; um logo, uma seta, um selo têm meia dúzia.
 * Medido no harness com a ficha de Assimilação do Kieran: a "maior imagem com proporção de foto"
 * era um triângulo vermelho sobre preto — duas cores — e ia parar no retrato do personagem.
 * Amostra de 64×64 quantizada em 16 níveis por canal (4096 cores possíveis); abaixo de
 * `CORES_MINIMAS` distintas não é foto, e a próxima candidata é tentada. O número foi medido: com
 * 32 níveis e mínimo de 40, o triângulo passava — o serrilhado das bordas e o JPEG rendem dezenas
 * de tons de vermelho; uma foto, mesmo escura, rende centenas de cores em 4 bits.
 */
export const LADO_DA_AMOSTRA = 64
export const CORES_MINIMAS = 120
export function pareceFoto(pixels: Uint8ClampedArray): boolean {
  const cores = new Set<number>()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 16) continue
    cores.add(((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4))
    if (cores.size >= CORES_MINIMAS) return true
  }
  return false
}

/** O mínimo que se usa do pdf.js aqui — não o tipo inteiro da biblioteca. */
export interface PaginaComImagens {
  getViewport(opcoes: { scale: number }): { width: number; height: number }
  getOperatorList(opcoes?: { annotationMode?: number }): Promise<{ fnArray: number[]; argsArray: unknown[][] }>
  objs: { has(nome: string): boolean; get(nome: string): unknown }
}

/**
 * `AnnotationMode.ENABLE_FORMS` do pdf.js: a lista de operadores inclui a APARÊNCIA dos campos de
 * formulário. É onde mora a foto numa ficha preenchível — o campo de imagem da ficha de Ordem
 * Paranormal é um botão de formulário cuja aparência é a imagem que a pessoa colou; no conteúdo da
 * página em si não há retrato nenhum. Sem isto, só ficha com a foto impressa na página rendia.
 */
const INCLUIR_FORMULARIOS = 2

interface ImagemDoPdfJs {
  width?: number
  height?: number
  /** 1 = cinza 1 bit, 2 = RGB 24 bits, 3 = RGBA 32 bits — a nomenclatura do pdf.js. */
  kind?: number
  data?: Uint8ClampedArray | Uint8Array
  /** Versões recentes do pdf.js entregam a imagem já decodificada, quando o navegador deixa. */
  bitmap?: ImageBitmap
}

/** O maior lado do retrato gravado. A foto vai pro `profiles.json`, lido inteiro em toda abertura. */
const LADO_MAXIMO_DO_RETRATO = 384
/** Teto da data URL — muito abaixo do que `normalizeProfiles` aceita (17 MB); é o tamanho de uma foto, não de um scan. */
const TAMANHO_MAXIMO_DA_DATA_URL = 1024 * 1024

export async function extrairRetratoDaPagina(pagina: PaginaComImagens, codigoDePintura: number): Promise<string | null> {
  const lista = await pagina.getOperatorList({ annotationMode: INCLUIR_FORMULARIOS })
  const imagens: ImagemDaPagina[] = []
  const objetos = new Map<string, ImagemDoPdfJs>()
  for (let i = 0; i < lista.fnArray.length; i++) {
    if (lista.fnArray[i] !== codigoDePintura) continue
    const nome = lista.argsArray[i]?.[0]
    if (typeof nome !== 'string' || objetos.has(nome) || !pagina.objs.has(nome)) continue
    let objeto: ImagemDoPdfJs | null = null
    try {
      objeto = pagina.objs.get(nome) as ImagemDoPdfJs | null
    } catch {
      continue
    }
    if (!objeto) continue
    const largura = objeto.bitmap?.width ?? objeto.width ?? 0
    const altura = objeto.bitmap?.height ?? objeto.height ?? 0
    if (largura <= 0 || altura <= 0) continue
    objetos.set(nome, objeto)
    imagens.push({ nome, largura, altura })
  }

  const viewport = pagina.getViewport({ scale: 1 })
  for (const candidata of candidatasARetrato(imagens, { largura: viewport.width, altura: viewport.height })) {
    const dataUrl = desenharComoDataUrl(objetos.get(candidata.nome)!, candidata)
    if (dataUrl) return dataUrl
  }
  return null
}

/**
 * A imagem crua do pdf.js num canvas, reduzida, como JPEG. JPEG e não PNG porque retrato é
 * fotografia: a mesma foto sai três a cinco vezes menor, e é ela que vai morar no `profiles.json`.
 */
function desenharComoDataUrl(objeto: ImagemDoPdfJs, tamanho: ImagemDaPagina): string | null {
  const escala = Math.min(1, LADO_MAXIMO_DO_RETRATO / Math.max(tamanho.largura, tamanho.altura))
  const largura = Math.max(1, Math.round(tamanho.largura * escala))
  const altura = Math.max(1, Math.round(tamanho.altura * escala))
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const contexto = canvas.getContext('2d')
  if (!contexto) return null

  if (objeto.bitmap) {
    contexto.drawImage(objeto.bitmap, 0, 0, largura, altura)
  } else if (objeto.data && (objeto.kind === 2 || objeto.kind === 3)) {
    const origem = document.createElement('canvas')
    origem.width = tamanho.largura
    origem.height = tamanho.altura
    const contextoDaOrigem = origem.getContext('2d')
    if (!contextoDaOrigem) return null
    const pixels = new ImageData(tamanho.largura, tamanho.altura)
    const bytesPorPixel = objeto.kind === 2 ? 3 : 4
    for (let i = 0, j = 0; i < tamanho.largura * tamanho.altura; i++, j += bytesPorPixel) {
      pixels.data[i * 4] = objeto.data[j]
      pixels.data[i * 4 + 1] = objeto.data[j + 1]
      pixels.data[i * 4 + 2] = objeto.data[j + 2]
      pixels.data[i * 4 + 3] = bytesPorPixel === 4 ? objeto.data[j + 3] : 255
    }
    contextoDaOrigem.putImageData(pixels, 0, 0)
    contexto.drawImage(origem, 0, 0, largura, altura)
  } else {
    // Cinza de 1 bit (kind 1) é desenho de linha, não foto — e formatos que não se conhece não se adivinham.
    return null
  }

  // Logo, seta, selo: poucas cores — não é retrato de ninguém. Ver `pareceFoto`.
  const amostra = document.createElement('canvas')
  amostra.width = LADO_DA_AMOSTRA
  amostra.height = LADO_DA_AMOSTRA
  const contextoDaAmostra = amostra.getContext('2d')
  if (!contextoDaAmostra) return null
  contextoDaAmostra.drawImage(canvas, 0, 0, LADO_DA_AMOSTRA, LADO_DA_AMOSTRA)
  if (!pareceFoto(contextoDaAmostra.getImageData(0, 0, LADO_DA_AMOSTRA, LADO_DA_AMOSTRA).data)) return null

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return dataUrl.length <= TAMANHO_MAXIMO_DA_DATA_URL ? dataUrl : null
}
