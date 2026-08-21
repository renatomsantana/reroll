import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A MEMÓRIA DA ÚLTIMA PASTA usada em cada tipo de diálogo.
 *
 * Isto existe por uma regressão do Electron 43: até o 42 o sistema restaurava a última pasta
 * sozinho e o app pegava carona sem nunca ter pedido; do 43 em diante todo diálogo abre em
 * Downloads. O comportamento certo passou a depender de o app lembrar por conta própria — e uma
 * memória que ninguém testa é uma memória que some no próximo refatorar, exatamente como sumiu a do
 * sistema.
 */

const userData = join(tmpdir(), `reroll-teste-dialogos-${process.pid}-${Date.now()}`)

const showOpenDialog = vi.fn()
const showSaveDialog = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  dialog: {
    showOpenDialog: (...args: unknown[]) => showOpenDialog(...args),
    showSaveDialog: (...args: unknown[]) => showSaveDialog(...args)
  }
}))

const { escolherArquivo, escolherOndeSalvar } = await import('./dialogos')

/** Pastas de verdade no disco: o módulo confere se a pasta lembrada ainda existe antes de usá-la. */
const pastaDeImagens = join(userData, 'Minhas Imagens')
const pastaDeFichas = join(userData, 'Fichas RPG')
const pastaSumida = join(userData, 'Pendrive')

const filtroQualquer = [{ name: 'Tudo', extensions: ['*'] }]

/** O `defaultPath` que o diálogo recebeu na chamada mais recente. */
function ultimoDefaultPath(espiao: typeof showOpenDialog): string | undefined {
  const chamada = espiao.mock.calls.at(-1)
  return (chamada?.[0] as { defaultPath?: string })?.defaultPath
}

describe('memória da última pasta', () => {
  beforeAll(async () => {
    await fs.mkdir(pastaDeImagens, { recursive: true })
    await fs.mkdir(pastaDeFichas, { recursive: true })
    await fs.mkdir(pastaSumida, { recursive: true })
  })

  afterAll(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  beforeEach(async () => {
    showOpenDialog.mockReset()
    showSaveDialog.mockReset()
    // Zera a memória entre testes — ela mora num arquivo, então sobreviveria de um pro outro.
    await fs.rm(join(userData, 'dialogos.json'), { force: true })
  })

  it('na primeira vez não inventa pasta nenhuma', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })

    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })

    expect(ultimoDefaultPath(showOpenDialog)).toBeUndefined()
  })

  it('na segunda vez volta pra pasta do arquivo escolhido antes', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(pastaDeImagens, 'retrato.png')]
    })
    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })

    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })

    expect(ultimoDefaultPath(showOpenDialog)).toBe(pastaDeImagens)
  })

  it('cada propósito tem a SUA pasta, e uma não atrapalha a outra', async () => {
    /**
     * É o ponto da divisão: quem escolhe foto de personagem e quem escolhe ficha em PDF está em dois
     * lugares diferentes da vida. Uma memória só faria a ficha jogar o próximo seletor de imagem na
     * pasta errada — que é praticamente o mesmo defeito que se está consertando.
     */
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(pastaDeImagens, 'retrato.png')]
    })
    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })

    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(pastaDeFichas, 'matais.pdf')]
    })
    await escolherArquivo({ proposito: 'ficha', titulo: 'x', filtros: filtroQualquer })

    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })
    expect(ultimoDefaultPath(showOpenDialog)).toBe(pastaDeImagens)

    await escolherArquivo({ proposito: 'ficha', titulo: 'x', filtros: filtroQualquer })
    expect(ultimoDefaultPath(showOpenDialog)).toBe(pastaDeFichas)
  })

  it('desistir do diálogo não apaga a pasta que já estava lembrada', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(pastaDeImagens, 'retrato.png')]
    })
    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })

    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })
    await escolherArquivo({ proposito: 'imagem', titulo: 'x', filtros: filtroQualquer })

    expect(ultimoDefaultPath(showOpenDialog)).toBe(pastaDeImagens)
  })

  it('pasta que sumiu do disco é esquecida, não passada pro diálogo', async () => {
    /**
     * Pendrive removido, pasta de rede fora do ar, diretório apagado. Um `defaultPath` inválido faz o
     * diálogo nativo abrir num lugar arbitrário — pior que não lembrar nada, porque parece defeito.
     */
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [join(pastaSumida, 'ficha.pdf')]
    })
    await escolherArquivo({ proposito: 'ficha', titulo: 'x', filtros: filtroQualquer })

    await fs.rm(pastaSumida, { recursive: true, force: true })

    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    await escolherArquivo({ proposito: 'ficha', titulo: 'x', filtros: filtroQualquer })

    expect(ultimoDefaultPath(showOpenDialog)).toBeUndefined()
    await fs.mkdir(pastaSumida, { recursive: true })
  })

  it('salvar leva o nome sugerido JUNTO da pasta lembrada', async () => {
    /**
     * Passar só `'presets-reroll.json'` — como era antes — é um caminho RELATIVO, e o Electron 43 o
     * resolve a partir de Downloads. O nome sugerido tem que vir grudado na pasta pra o diálogo
     * abrir no lugar certo E ainda sugerir o nome.
     */
    showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: join(pastaDeFichas, 'presets-reroll.json')
    })
    await escolherOndeSalvar({
      proposito: 'presets',
      titulo: 'x',
      nomeSugerido: 'presets-reroll.json',
      filtros: filtroQualquer
    })

    await escolherOndeSalvar({
      proposito: 'presets',
      titulo: 'x',
      nomeSugerido: 'presets-reroll.json',
      filtros: filtroQualquer
    })

    const caminho = ultimoDefaultPath(showSaveDialog)
    expect(caminho).toBe(join(pastaDeFichas, 'presets-reroll.json'))
    expect(dirname(caminho as string)).toBe(pastaDeFichas)
  })

  it('sem pasta lembrada, salvar ainda sugere o nome sozinho', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })

    await escolherOndeSalvar({
      proposito: 'presets',
      titulo: 'x',
      nomeSugerido: 'presets-reroll.json',
      filtros: filtroQualquer
    })

    expect(ultimoDefaultPath(showSaveDialog)).toBe('presets-reroll.json')
  })
})
