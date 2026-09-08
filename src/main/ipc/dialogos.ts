import { join, dirname } from 'path'
import { app, dialog, type FileFilter } from 'electron'
import { JsonFileStore } from '../storage/JsonFileStore'

/**
 * TODOS os diálogos de arquivo do app passam por aqui, e o motivo é uma regressão que já aconteceu.
 *
 * Até o Electron 42, `showOpenDialog` sem `defaultPath` caía na última pasta usada: o Windows guardava
 * isso por conta própria e o app pegava carona sem nunca ter pedido. No Electron 43 esse comportamento
 * ACABOU, e agora todo diálogo abre na pasta Downloads, sempre. Na prática apareceu como "o app
 * esqueceu onde eu guardo minhas coisas": quem tem as imagens numa pasta e as fichas noutra passou a
 * navegar até elas a cada vez.
 *
 * A memória é POR PROPÓSITO e não uma só, porque quem escolhe uma foto de personagem e quem exporta
 * presets está em duas pastas diferentes da vida — é o mesmo raciocínio de o Windows lembrar separado
 * por tipo de diálogo, que é o que se perdeu. E as chamadas de `dialog` moram aqui em vez de
 * espalhadas porque, enquanto cada handler chamava `showOpenDialog` direto, lembrar do `defaultPath`
 * era responsabilidade de cada um: o próximo diálogo escrito ia esquecer.
 */

/**
 * As gavetas da memória. Cada uma é um lugar diferente do disco na cabeça de quem usa:
 *
 * - `imagem`: foto do personagem e imagem de fundo da cena — as duas são "minhas imagens";
 * - `ficha`: os PDFs de ficha de RPG;
 * - `presets`: o `.json` de backup/transferência de presets;
 * - `pacote`: o personagem exportado inteiro (`.html`, ver `pacoteDePersonagem.ts`).
 */
export type PropositoDeDialogo = 'imagem' | 'ficha' | 'presets' | 'pacote'

type PastasLembradas = Partial<Record<PropositoDeDialogo, string>>

/**
 * Arquivo próprio, e não um campo dentro de `settings.json`: dois `JsonFileStore` apontando pro mesmo
 * caminho seriam duas filas de gravação sobre um arquivo só, que é o atropelo que a fila do
 * `JsonFileStore` existe pra impedir. Preguiçoso porque `app.getPath('userData')` só responde depois
 * do `app.whenReady()`, e este módulo é importado antes disso.
 */
let armazem: JsonFileStore<PastasLembradas> | null = null

function store(): JsonFileStore<PastasLembradas> {
  if (!armazem) {
    armazem = new JsonFileStore<PastasLembradas>(join(app.getPath('userData'), 'dialogos.json'), {})
  }
  return armazem
}

/**
 * A pasta lembrada pra este propósito, ou `undefined` na primeira vez. Pasta que não existe MAIS
 * (pendrive removido, pasta de rede fora do ar) é o caso que interessa: passar um `defaultPath`
 * inválido pro diálogo nativo faz o Windows abrir num lugar arbitrário, pior que não lembrar nada.
 * Conferir custa uma leitura de disco, e o diálogo já é a operação mais lenta desta cadeia.
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
