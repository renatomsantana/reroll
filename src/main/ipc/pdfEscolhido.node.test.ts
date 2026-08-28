import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lerPdfEscolhido } from './registerSheetHandlers'
import { TAMANHO_MAXIMO_DA_FICHA } from '@shared/types/sheetImport'

/**
 * O que acontece ENTRE escolher o arquivo e conseguir ler os bytes dele.
 *
 * Esta faixa não tinha teste nenhum, e é onde moram as falhas que não são culpa do PDF: o arquivo
 * saiu do lugar depois de escolhido, a pasta de rede caiu, a permissão nega a leitura, o arquivo é
 * grande demais pra caber na memória três vezes (disco → IPC → pdf.js). Antes, todas elas viravam
 * promessa rejeitada num ponto do renderer que não tinha `try` — ou seja, o botão "Importar ficha"
 * simplesmente não fazia nada, sem mensagem e sem console.
 *
 * O contrato que se testa: `lerPdfEscolhido` NUNCA rejeita. Ela devolve o motivo, e é o motivo que
 * a tela transforma em frase.
 */

let pasta: string

beforeAll(async () => {
  pasta = await fs.mkdtemp(join(tmpdir(), 'reroll-ficha-'))
})

afterAll(async () => {
  await fs.rm(pasta, { recursive: true, force: true })
})

describe('ler o PDF escolhido', () => {
  it('arquivo normal volta com nome e bytes', async () => {
    const caminho = join(pasta, 'ficha.pdf')
    await fs.writeFile(caminho, Buffer.from('%PDF-1.7\nconteudo qualquer\n'))

    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.fileName).toBe('ficha.pdf')
    expect(resultado.bytes.length).toBeGreaterThan(0)
    // Os bytes precisam ser os DO ARQUIVO — um `Uint8Array` vazio também passaria no teste acima.
    expect(Buffer.from(resultado.bytes).toString('latin1')).toContain('%PDF')
  })

  it('arquivo que não existe devolve motivo, e não uma promessa rejeitada', async () => {
    const resultado = await lerPdfEscolhido(join(pasta, 'nunca-existiu.pdf'))
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toBe('ilegivel')
  })

  it('pasta no lugar de arquivo não vira EISDIR obscuro', async () => {
    const resultado = await lerPdfEscolhido(pasta)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    if (resultado.motivo !== 'ilegivel') return
    expect(resultado.detalhe).toContain('não é um arquivo')
  })

  it('arquivo acima do limite é recusado ANTES de virar bytes na memória', async () => {
    /**
     * Arquivo ESPARSO: só o tamanho importa aqui, e escrever 80 MB de verdade a cada rodada
     * deixaria a suíte lenta por nada. `truncate` reserva o tamanho sem gravar o conteúdo.
     */
    const caminho = join(pasta, 'gigante.pdf')
    const alca = await fs.open(caminho, 'w')
    await alca.truncate(TAMANHO_MAXIMO_DA_FICHA + 1)
    await alca.close()

    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toBe('muito-grande')
    if (resultado.motivo !== 'muito-grande') return
    expect(resultado.tamanho).toBe(TAMANHO_MAXIMO_DA_FICHA + 1)
  })

  it('arquivo exatamente no limite ainda é aceito — o limite não pode comer o caso de borda', async () => {
    const caminho = join(pasta, 'no-limite.pdf')
    const alca = await fs.open(caminho, 'w')
    await alca.write('%PDF-1.4\n')
    // `truncate` pra cima estende com zeros: o cabeçalho fica, o tamanho bate no limite exato.
    await alca.truncate(TAMANHO_MAXIMO_DA_FICHA)
    await alca.close()

    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado.ok).toBe(true)
  })

  it('arquivo vazio é recusado aqui como "não é PDF" — zero bytes não tem a assinatura', async () => {
    /**
     * Esta regra já foi "quem recusa PDF vazio é o pdf.js": os bytes atravessavam o IPC pra
     * falharem do outro lado. Com a conferência da assinatura `%PDF-` (Stage 0 do spec de
     * importação), a recusa vem daqui — com motivo próprio, que a tela traduz em "não é PDF".
     */
    const caminho = join(pasta, 'vazio.pdf')
    await fs.writeFile(caminho, Buffer.alloc(0))

    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.motivo).toBe('nao-e-pdf')
  })

  it('arquivo que não é PDF diz isso, e o personagem exportado pelo Reroll aponta o botão certo', async () => {
    // Pedido dele: "se uploadarem o arquivo errado, aparecer uma mensagem". Antes os dois eram "ilegível".
    const docx = join(pasta, 'ficha.docx')
    await fs.writeFile(docx, 'PK\u0003\u0004 isto é um zip de docx')
    expect(await lerPdfEscolhido(docx)).toEqual({ ok: false, motivo: 'nao-e-pdf' })

    const pacote = join(pasta, 'Matias - Reroll.html')
    await fs.writeFile(pacote, '<html><body><script id="reroll-personagem" type="application/json">{"formato":"reroll-personagem"}</script></body></html>', 'utf-8')
    expect(await lerPdfEscolhido(pacote)).toEqual({ ok: false, motivo: 'pacote-do-reroll' })

    const json = join(pasta, 'matias.json')
    await fs.writeFile(json, '{"formato":"reroll-personagem","versao":1}', 'utf-8')
    expect(await lerPdfEscolhido(json)).toEqual({ ok: false, motivo: 'pacote-do-reroll' })
  })

  it('nome com acento, espaço e parêntese volta inteiro', async () => {
    const nome = 'Ficha do Getúlio (versão 2).pdf'
    const caminho = join(pasta, nome)
    await fs.writeFile(caminho, Buffer.from('%PDF-1.7\n'))

    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.fileName).toBe(nome)
  })
})

/**
 * A ASSINATURA do formato — Stage 0 do spec da importação: "verify the `%PDF-` magic bytes, not
 * just the extension". Um `.pdf` renomeado é a coisa mais comum que chega num diálogo de arquivo.
 */
describe('assinatura %PDF-', () => {
  it('um arquivo renomeado pra .pdf é recusado como "não é PDF", antes de atravessar o IPC', async () => {
    const caminho = join(pasta, 'video.pdf')
    await fs.writeFile(caminho, Buffer.from('RIFF\u0000\u0000\u0000\u0000AVI LIST'))
    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado).toEqual({ ok: false, motivo: 'nao-e-pdf' })
  })

  it('cabeçalho com lixo antes do %PDF- passa — o padrão tolera até 1024 bytes', async () => {
    const caminho = join(pasta, 'com-lixo.pdf')
    await fs.writeFile(caminho, Buffer.from('\r\n\r\nlixo do gerador\n%PDF-1.4\n'))
    expect((await lerPdfEscolhido(caminho)).ok).toBe(true)
  })
})
