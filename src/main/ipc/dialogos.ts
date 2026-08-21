import { join, dirname } from 'path'
import { app, dialog, type FileFilter } from 'electron'
import { JsonFileStore } from '../storage/JsonFileStore'

/**
 * TODOS os diálogos de arquivo do app passam por aqui, e o motivo é uma regressão que já aconteceu.
 *
 * Até o Electron 42, `showOpenDialog` sem `defaultPath` caía na última pasta usada — o Windows
 * guardava isso por conta própria, e o app pegava carona sem nunca ter pedido. No Electron 43 esse
 * comportamento ACABOU: agora todo diálogo abre na pasta Downloads, sempre, e não há nada que o
 * sistema restaure.
 *
 * Na prática isso apareceu como "o app esqueceu onde eu guardo minhas coisas": quem tem as imagens
 * de fundo numa pasta e as fichas noutra passou a navegar até elas a cada vez. Não é falha de
 * segurança, é a diferença entre um app que parece cuidado e um que parece descuidado.
 *
 * A memória é POR PROPÓSITO e não uma só: quem escolhe uma foto de personagem e quem exporta presets
 * está em duas pastas diferentes da vida, e uma memória única faria as duas se atrapalharem. É o
 * mesmo raciocínio de o Windows lembrar separado por tipo de diálogo, que era o que se perdeu.
 *
 * E o motivo de as chamadas de `dialog` morarem aqui em vez de espalhadas: enquanto cada handler
 * chamava `dialog.showOpenDialog` direto, lembrar do `defaultPath` era responsabilidade de cada um
 * — ou seja, o próximo diálogo escrito ia esquecer. Com uma porta só, não tem como esquecer.
 */

/**
 * As gavetas da memória. Cada uma é um lugar diferente do disco na cabeça de quem usa:
 *
 * - `imagem`: foto do personagem e imagem de fundo da cena — as duas são "minhas imagens";
 * - `ficha`: os PDFs de ficha de RPG;
 * - `presets`: o `.json` de backup/transferência de presets.
 */
export type PropositoDeDialogo = 'imagem' | 'ficha' | 'presets'

type PastasLembradas = Partial<Record<PropositoDeDialogo, string>>

/**
 * Arquivo próprio, e não um campo dentro de `settings.json`.
 *
 * Dois `JsonFileStore` apontando pro mesmo caminho seriam duas filas de gravação sobre um arquivo
 * só — exatamente o atropelo que a fila do `JsonFileStore` existe pra impedir (ver o comentário
 * dela). Como isto é lido e escrito por um caminho independente das preferências, ganha o arquivo
 * dele.
 *
 * Preguiçoso porque `app.getPath('userData')` só responde depois do `app.whenReady()`, e este
 * módulo é importado antes disso.
 */
let armazem: JsonFileStore<PastasLembradas> | null = null

function store(): JsonFileStore<PastasLembradas> {
  if (!armazem) {
    armazem = new JsonFileStore<PastasLembradas>(join(app.getPath('userData'), 'dialogos.json'), {})
  }
  return armazem
}

/**
 * A pasta lembrada pra este propósito, ou `undefined` na primeira vez.
 *
 * Pasta que não existe MAIS (pendrive removido, pasta de rede fora do ar, diretório apagado) é o
 * caso que interessa aqui: passar um `defaultPath` inválido pro diálogo nativo faz o Windows abrir
 * num lugar arbitrário, o que é pior do que não lembrar nada. Como não dá pra conferir a existência
 * sem tocar no disco, o preço de conferir é uma leitura — e o diálogo já é a operação mais lenta
 * desta cadeia, então ela não custa nada perto dele.
 */
async function pastaLembrada(proposito: PropositoDeDialogo): Promise<string | undefined> {
  const pastas = await store().read()
  const pasta = pastas[proposito]
  if (!pasta) return undefined
  try {
    const { promises: fs } = await import('fs')
    const info = await fs.stat(pasta)
    return info.isDirectory() ? pasta : undefined
  } catch {
    return undefined
  }
}

/** Guarda a pasta do arquivo que a pessoa acabou de escolher, pro próximo diálogo do mesmo tipo. */
async function lembrarPastaDe(proposito: PropositoDeDialogo, caminho: string): Promise<void> {
  const atuais = await store().read()
  await store().write({ ...atuais, [proposito]: dirname(caminho) })
}

/** Abre o seletor de arquivo. Devolve o caminho escolhido, ou `null` se a pessoa desistiu. */
export async function escolherArquivo(opcoes: {
  proposito: PropositoDeDialogo
  titulo: string
  filtros: FileFilter[]
}): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: opcoes.titulo,
    properties: ['openFile'],
    filters: opcoes.filtros,
    defaultPath: await pastaLembrada(opcoes.proposito)
  })
  if (canceled || filePaths.length === 0) return null

  await lembrarPastaDe(opcoes.proposito, filePaths[0])
  return filePaths[0]
}

/** Abre o seletor de "salvar como". Devolve o caminho escolhido, ou `null` se a pessoa desistiu. */
export async function escolherOndeSalvar(opcoes: {
  proposito: PropositoDeDialogo
  titulo: string
  nomeSugerido: string
  filtros: FileFilter[]
}): Promise<string | null> {
  /**
   * O nome sugerido entra JUNTO da pasta lembrada, e é por isso que ele não é o `defaultPath`
   * inteiro. Passando só `'presets-reroll.json'`, como era antes, o diálogo interpreta um caminho
   * relativo e resolve a partir de onde o Windows quiser — que no Electron 43 é a pasta Downloads.
   * Com a pasta na frente, o nome sugerido continua aparecendo E o lugar é o certo.
   */
  const pasta = await pastaLembrada(opcoes.proposito)
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: opcoes.titulo,
    defaultPath: pasta ? join(pasta, opcoes.nomeSugerido) : opcoes.nomeSugerido,
    filters: opcoes.filtros
  })
  if (canceled || !filePath) return null

  await lembrarPastaDe(opcoes.proposito, filePath)
  return filePath
}
