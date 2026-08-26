/**
 * AS PÁGINAS DO PDF, guardadas com o personagem.
 *
 * Pedido do usuário: "as fichas precisam ser intuitivas e o mais parecido possível com os PDFs". E
 * a spec (importação §9, "non-negotiable"): "side-by-side view: show the original PDF page next to
 * the fields, so the user can compare without leaving the app". Nada é mais parecido com o PDF do
 * que o próprio PDF: cada página é desenhada pelo pdf.js numa imagem (ver `paginasDoPdf.ts`) na
 * hora da importação, vai pra conferência ao lado dos campos, e fica na pasta do personagem
 * (`pagina-01.jpg`, ...; ver `PaginasRepository`) pra Ficha mostrar a ficha original quando a
 * pessoa quiser, e pro pacote exportado levar junto.
 *
 * Os tetos existem pelo mesmo motivo de todo teto daqui: uma ficha tem uma a quatro páginas, e um
 * PDF de cem páginas é um livro (`MAXIMO_DE_PAGINAS_DA_FICHA`). Seis páginas de 1000px em JPEG dão
 * uns 1,5 MB, que é o que se aceita guardar por personagem.
 */
export const MAXIMO_DE_PAGINAS_GUARDADAS = 6
/** Largura em pixels de cada página desenhada — dá pra ler o número de um campo, e não pesa. */
export const LARGURA_DA_PAGINA_GUARDADA = 1000
/** O maior data URL que uma página pode ter (uns 2,2 MB de JPEG em base64). */
export const TAMANHO_MAXIMO_DE_UMA_PAGINA = 3 * 1024 * 1024

const IMAGEM_EMBUTIDA = /^data:image\/(jpeg|png|webp);base64,/

/** Só imagens embutidas, dentro dos tetos, na ordem em que vieram. O que não serve cai fora. */
export function paginasValidas(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .filter((p): p is string => typeof p === 'string' && p.length <= TAMANHO_MAXIMO_DE_UMA_PAGINA && IMAGEM_EMBUTIDA.test(p))
    .slice(0, MAXIMO_DE_PAGINAS_GUARDADAS)
}
