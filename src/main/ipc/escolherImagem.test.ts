import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * A LEITURA DA IMAGEM escolhida — foto do personagem e fundo da cena, que hoje são o mesmo caminho.
 *
 * O limite de tamanho é o motivo de este teste existir. A imagem não é lida e descartada: ela é
 * GUARDADA como data URL, e base64 infla um terço. Uma foto grande demais vira um `profiles.json`
 * pesado (lido inteiro em toda abertura do app) ou estoura a cota do `localStorage` no caso do
 * fundo — e nenhum dos dois dá erro visível, só deixa o app estranho. Um limite que ninguém testa é
 * um limite que some no primeiro refatorar.
 */

vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() }
}))

const { lerImagemComoDataUrl, TAMANHO_MAXIMO_DA_IMAGEM } = await import('./escolherImagem')

const pasta = join(tmpdir(), `reroll-teste-imagem-${process.pid}-${Date.now()}`)

async function criarArquivo(nome: string, bytes: number): Promise<string> {
  const caminho = join(pasta, nome)
  await fs.writeFile(caminho, Buffer.alloc(bytes, 7))
  return caminho
}

describe('ler imagem escolhida', () => {
  beforeAll(async () => {
    await fs.mkdir(pasta, { recursive: true })
  })

  afterAll(async () => {
    await fs.rm(pasta, { recursive: true, force: true })
  })

  it('devolve data URL com o tipo certo pra cada extensão', async () => {
    const png = await lerImagemComoDataUrl(await criarArquivo('foto.png', 4))
    expect(png.startsWith('data:image/png;base64,')).toBe(true)

    // `.jpg` e `.jpeg` são o mesmo tipo, e a maiúscula não pode mudar a resposta: no Windows a
    // extensão vem como o arquivo foi salvo, e câmera nenhuma combinou de usar minúscula.
    const jpg = await lerImagemComoDataUrl(await criarArquivo('foto.JPG', 4))
    expect(jpg.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('recusa formato fora da lista', async () => {
    const caminho = await criarArquivo('ficha.pdf', 4)
    await expect(lerImagemComoDataUrl(caminho)).rejects.toThrow(/não suportado/)
  })

  it('recusa imagem acima do limite ANTES de trazer os bytes pra memória', async () => {
    const caminho = await criarArquivo('enorme.png', TAMANHO_MAXIMO_DA_IMAGEM + 1)
    await expect(lerImagemComoDataUrl(caminho)).rejects.toThrow(/grande demais/)
  })

  it('aceita exatamente no limite — o corte é acima dele, não nele', async () => {
    const caminho = await criarArquivo('no-limite.png', TAMANHO_MAXIMO_DA_IMAGEM)
    await expect(lerImagemComoDataUrl(caminho)).resolves.toContain('data:image/png;base64,')
  })

  it('explica em vez de estourar com erro de sistema quando o arquivo sumiu', async () => {
    await expect(lerImagemComoDataUrl(join(pasta, 'que-nao-existe.png'))).rejects.toThrow()
  })

  it('recusa pasta escolhida no lugar de arquivo', async () => {
    const subpasta = join(pasta, 'uma-pasta.png')
    await fs.mkdir(subpasta, { recursive: true })
    await expect(lerImagemComoDataUrl(subpasta)).rejects.toThrow(/não é um arquivo/)
  })
})
