/**
 * O pedaço de `electron` que o código do processo principal usa, traduzido pro navegador.
 *
 * Três coisas moram aqui:
 *
 * - `app`: `getPath('userData')` vira a raiz virtual `/dados` (ver `fs.ts`), e `getVersion()` é a
 *   versão injetada no build (`__VERSAO_DO_APP__`, ver `vite.web.config.ts`).
 * - `ipcMain`: os `register*Handlers` do main registram os canais deles aqui, e a ponte web
 *   (`api.ts`) os chama por `invocarCanal` — a MESMA mecânica que os testes do main já usam quando
 *   capturam handlers de um `ipcMain` falso, só que em produção.
 * - `dialog`: o diálogo nativo de abrir vira o seletor de arquivos do navegador (quem fornece é a
 *   `PlataformaDeArquivos`, configurada pelo bootstrap — os testes põem uma de mentira). O arquivo
 *   escolhido é gravado no fs virtual em `/escolhidos/` e o handler do main segue lendo "do disco"
 *   sem saber de nada. O diálogo de salvar não existe na web: a escolha é aceita direto com o nome
 *   sugerido em `/downloads/`, e quem transforma isso num download de verdade é a ponte
 *   (`api.ts`), depois que o handler termina de escrever.
 */

type FiltroDeArquivo = { name: string; extensions: string[] }

export type ArquivoEscolhido = { nome: string; bytes: Uint8Array } | null

export interface PlataformaDeArquivos {
  abrirArquivo(opcoes: { titulo: string; filtros: FiltroDeArquivo[] }): Promise<ArquivoEscolhido>
  baixarArquivo(nome: string, conteudo: Uint8Array): void
}

let plataforma: PlataformaDeArquivos | null = null

export function configurarPlataformaDeArquivos(nova: PlataformaDeArquivos): void {
  plataforma = nova
}

export function plataformaDeArquivos(): PlataformaDeArquivos {
  if (!plataforma) throw new Error('Plataforma de arquivos não configurada (ver bootstrap.ts).')
  return plataforma
}

let versaoDoApp = '0.0.0-web'

export function configurarVersaoDoApp(versao: string): void {
  versaoDoApp = versao
}

export const app = {
  getPath: (_nome: string): string => '/dados',
  getVersion: (): string => versaoDoApp
}

type Handler = (evento: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()

export const ipcMain = {
  handle(canal: string, fn: Handler): void {
    handlers.set(canal, fn)
  }
}

export async function invocarCanal<T>(canal: string, ...args: unknown[]): Promise<T> {
  const fn = handlers.get(canal)
  if (!fn) throw new Error(`Canal sem handler registrado: ${canal}`)
  return (await fn(undefined, ...args)) as T
}

/** No nome do arquivo escolhido, pra dois arquivos de mesmo nome não se sobrescreverem. */
let contadorDeEscolhas = 0

export const dialog = {
  async showOpenDialog(opcoes: {
    title?: string
    filters?: FiltroDeArquivo[]
    defaultPath?: string
    properties?: string[]
  }): Promise<{ canceled: boolean; filePaths: string[] }> {
    const escolhido = await plataformaDeArquivos().abrirArquivo({
      titulo: opcoes.title ?? '',
      filtros: opcoes.filters ?? []
    })
    if (!escolhido) return { canceled: true, filePaths: [] }
    contadorDeEscolhas++
    const caminho = `/escolhidos/${contadorDeEscolhas}-${escolhido.nome.replace(/[\\/]/g, '_')}`
    const { promises: fsVirtual } = await import('./fs')
    await fsVirtual.writeFile(caminho, escolhido.bytes)
    return { canceled: false, filePaths: [caminho] }
  },

  showSaveDialog(opcoes: {
    title?: string
    defaultPath?: string
    filters?: FiltroDeArquivo[]
  }): Promise<{ canceled: boolean; filePath: string }> {
    // A barra invertida entra quando os testes rodam no Windows (o `path.join` de lá).
    const sugerido = (opcoes.defaultPath ?? 'arquivo').replace(/\\/g, '/')
    const caminho = sugerido.startsWith('/') ? sugerido : `/downloads/${sugerido}`
    return Promise.resolve({ canceled: false, filePath: caminho })
  }
}
