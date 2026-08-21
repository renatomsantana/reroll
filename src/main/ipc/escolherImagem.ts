import { promises as fs } from 'fs'
import { extname } from 'path'
import { escolherArquivo } from './dialogos'

/**
 * Escolher uma imagem no diálogo nativo e devolvê-la como data URL — o caminho comum da FOTO DO
 * PERSONAGEM (`registerProfilesHandlers`) e da IMAGEM DE FUNDO da cena
 * (`registerSceneBackgroundHandlers`).
 *
 * Os dois tinham o mesmo código copiado, e a cópia já tinha custado: o limite de tamanho abaixo
 * precisaria ser lembrado nos dois lugares, e é exatamente o tipo de coisa que entra num e não no
 * outro. Aqui é uma regra só, com um teste só.
 *
 * O data URL, e não o caminho do arquivo, é escolha antiga e continua valendo: guardar o caminho
 * quebraria assim que a pessoa movesse ou apagasse a imagem original, e carregar por `file://` no
 * renderer esbarra no `Content-Security-Policy` (`img-src`), já que o arquivo escolhido pode estar em
 * qualquer pasta do sistema.
 */

const MIME_POR_EXTENSAO: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

/**
 * O maior arquivo de imagem que o app aceita, em bytes.
 *
 * Existe pelo mesmo motivo do limite do PDF (ver `TAMANHO_MAXIMO_DA_FICHA`), com um agravante: a
 * imagem não é lida e descartada, ela é GUARDADA. A foto do personagem vive dentro do
 * `profiles.json`, que é lido inteiro na abertura do app; o fundo da cena vive no `localStorage` do
 * renderer, que tem cota de poucos megabytes.
 *
 * E base64 infla um terço. Uma foto de celular de 12 MB vira ~16 MB de texto: o `localStorage`
 * estoura a cota (a preferência não salva, e a mensagem de erro é do navegador, não do app) e o
 * `profiles.json` passa a custar meio segundo de leitura em toda abertura, pra sempre. Nenhum dos
 * dois se anuncia — o app só fica estranho.
 *
 * 12 MB cobre foto de celular e captura de tela em 4K com folga. Acima disso, é imagem pra outra
 * coisa que não uma miniatura de personagem.
 */
export const TAMANHO_MAXIMO_DA_IMAGEM = 12 * 1024 * 1024

/**
 * Abre o seletor e devolve o data URL, ou `null` se a pessoa desistiu.
 *
 * ESTOURA quando o arquivo não serve — grande demais, formato fora da lista, ilegível. Quem chama
 * trata (ver `StyleTab.handlePickBackgroundImage` e a foto em `SheetTab`), e é de propósito que não
 * devolva `null` nesses casos: `null` já significa "cancelou", e misturar as duas coisas é como o
 * botão de importar ficha virava um botão que não fazia nada — o mesmo defeito que criou o
 * `PdfEscolhido`.
 */
export async function escolherImagemComoDataUrl(titulo: string): Promise<string | null> {
  // Pela porta de `dialogos.ts`, que é quem lembra a pasta — ver o cabeçalho de lá.
  const caminho = await escolherArquivo({
    proposito: 'imagem',
    titulo,
    filtros: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  })
  if (!caminho) return null

  return lerImagemComoDataUrl(caminho)
}

/**
 * A parte sem diálogo, separada pra poder ser testada: o que interessa aqui são falhas de sistema de
 * arquivos e de formato, fáceis de reproduzir e impossíveis de alcançar por trás de uma janela
 * nativa. Mesma divisão de `lerPdfEscolhido`, e pelo mesmo motivo.
 */
export async function lerImagemComoDataUrl(caminho: string): Promise<string> {
  const mime = MIME_POR_EXTENSAO[extname(caminho).toLowerCase()]
  if (!mime) throw new Error('Formato de imagem não suportado.')

  // ANTES de ler: o ponto do limite é não trazer os bytes pra memória, nem convertê-los a base64.
  const info = await fs.stat(caminho)
  if (!info.isFile()) throw new Error('O caminho escolhido não é um arquivo.')
  if (info.size > TAMANHO_MAXIMO_DA_IMAGEM) {
    const mb = Math.round(TAMANHO_MAXIMO_DA_IMAGEM / (1024 * 1024))
    throw new Error(`Imagem grande demais (o limite é ${mb} MB).`)
  }

  const buffer = await fs.readFile(caminho)
  return `data:${mime};base64,${buffer.toString('base64')}`
}
