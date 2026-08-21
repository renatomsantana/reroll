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
    await alca.truncate(TAMANHO_MAXIMO_DA_FICHA)
    await alca.close()

    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado.ok).toBe(true)
  })

  it('arquivo vazio passa daqui — quem recusa PDF vazio é o pdf.js, com a mensagem certa', async () => {
    const caminho = join(pasta, 'vazio.pdf')
    await fs.writeFile(caminho, Buffer.alloc(0))

    const resultado = await lerPdfEscolhido(caminho)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.bytes.length).toBe(0)
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
