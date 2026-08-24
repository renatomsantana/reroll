import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A IMPORTAÇÃO DE PRESETS TEM TETO — achado da revisão de segurança do 1.0.12.
 *
 * O PDF de ficha e a imagem tinham limite de tamanho; o `.json` de presets era lido inteiro pra
 * memória e analisado fosse do tamanho que fosse. Como o arquivo vem de um diálogo, quem escolhe
 * errado (um vídeo renomeado, um dump de banco) travaria o app. Aqui a leitura é exercitada com
 * arquivos DE VERDADE num diretório temporário, sem diálogo no caminho.
 */

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  app: { getPath: () => pasta }
}))

const pasta = join(tmpdir(), `reroll-teste-presets-arquivo-${process.pid}-${Date.now()}`)

const { lerPresetsDoArquivo, MAXIMO_DE_PRESETS_POR_IMPORTACAO, TAMANHO_MAXIMO_DO_ARQUIVO_DE_PRESETS } =
  await import('./registerPresetsHandlers')

function preset(nome: string) {
  return { name: nome, expression: { groups: [{ sides: 20, count: 1 }], modifiers: [] } }
}

async function arquivo(nome: string, conteudo: string | Buffer): Promise<string> {
  const caminho = join(pasta, nome)
  await fs.writeFile(caminho, conteudo)
  return caminho
}

describe('ler o arquivo de presets', () => {
  beforeEach(async () => {
    await fs.mkdir(pasta, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(pasta, { recursive: true, force: true })
  })

  it('lê um arquivo normal e devolve só os presets válidos', async () => {
    const caminho = await arquivo('ok.json', JSON.stringify([preset('Espada'), { lixo: true }, preset('Arco')]))
    const lidos = await lerPresetsDoArquivo(caminho)
    expect(lidos.map((p) => p.name)).toEqual(['Espada', 'Arco'])
  })

  it('recusa arquivo maior que o teto ANTES de ler o conteúdo', async () => {
    // Um arquivo do tamanho do teto mais um byte, de conteúdo irrelevante: ele nem chega no parse.
    const caminho = await arquivo('gigante.json', Buffer.alloc(TAMANHO_MAXIMO_DO_ARQUIVO_DE_PRESETS + 1, 0x20))
    await expect(lerPresetsDoArquivo(caminho)).rejects.toThrow(/grande demais/)
  })

  it('recusa lista com presets demais, dizendo quantos tem — em vez de importar os primeiros calado', async () => {
    const demais = Array.from({ length: MAXIMO_DE_PRESETS_POR_IMPORTACAO + 1 }, (_, i) => preset(`p${i}`))
    const caminho = await arquivo('demais.json', JSON.stringify(demais))
    await expect(lerPresetsDoArquivo(caminho)).rejects.toThrow(String(MAXIMO_DE_PRESETS_POR_IMPORTACAO + 1))
  })

  it('recusa o que não é lista, e lista sem preset válido nenhum', async () => {
    await expect(lerPresetsDoArquivo(await arquivo('objeto.json', '{"a":1}'))).rejects.toThrow(/lista/)
    await expect(lerPresetsDoArquivo(await arquivo('vazio.json', '[{"x":1}]'))).rejects.toThrow(/Nenhum preset/)
  })

  it('recusa uma pasta no lugar do arquivo', async () => {
    await fs.mkdir(join(pasta, 'sou-pasta.json'))
    await expect(lerPresetsDoArquivo(join(pasta, 'sou-pasta.json'))).rejects.toThrow(/não é um arquivo/)
  })
})
