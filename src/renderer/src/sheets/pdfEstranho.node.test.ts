import { describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { abrirPdfDeBytes } from './testes/abrirPdfNoNode'
import { montarPdf, pdfDeUmaPagina, widget } from './testes/pdfDeMentira'
import type { SheetImport } from '@shared/types/sheetImport'

/**
 * A importação contra PDF DE VERDADE, mas TORTO — pdf.js de verdade, conversão de produção
 * (`sheetFromPdfDocument`), leitor de produção (`readSheet`).
 *
 * Por que isto existe separado de `robustez.test.ts`: aquele monta a `PdfSheet` à mão e testa o
 * LEITOR. Este testa a camada de baixo, a que abre o arquivo — e é ela que roda primeiro no app.
 * Um leitor perfeito não serve de nada se a extração estourar antes de chamá-lo.
 *
 * O contrato é o pedido do usuário — "qualquer pessoa com o app possa uploadar seus PDFs e
 * funcionem normalmente" — traduzido em duas regras:
 *
 * 1. arquivo LEGÍVEL nunca faz a importação estourar, por mais torto que esteja; o pior caso é
 *    importar menos coisa, com aviso;
 * 2. arquivo ILEGÍVEL (não é PDF, está truncado, está com senha) rejeita de forma CAPTURÁVEL, que é
 *    o que `useSheetImport` transforma na mensagem da tela.
 *
 * A segunda regra é tão importante quanto a primeira: rejeição capturável vira "não consegui ler
 * este PDF"; exceção fora do `try` vira botão que não faz nada.
 */

/** Toda ficha importada precisa sair com rótulo E valor em todo campo — linha vazia é ruído puro. */
function conferirInvariantes(lido: SheetImport): void {
  expect(typeof lido.readerId).toBe('string')
  expect(Array.isArray(lido.fields)).toBe(true)
  expect(Array.isArray(lido.presets)).toBe(true)
  expect(Array.isArray(lido.warnings)).toBe(true)
  for (const campo of lido.fields) {
    expect(campo.label.trim()).not.toBe('')
    expect(campo.value.trim()).not.toBe('')
  }
  for (const preset of lido.presets) {
    expect(preset.name.trim()).not.toBe('')
    expect(preset.expression.groups.length).toBeGreaterThan(0)
  }
}

async function importar(nome: string, bytes: Uint8Array): Promise<SheetImport> {
  const lido = readSheet(await abrirPdfDeBytes(nome, bytes))
  conferirInvariantes(lido)
  return lido
}

describe('PDF legível, mas torto — importa o que dá, sem estourar', () => {
  /**
   * TETO DE 20s, e não os 5s padrão do vitest: este é o PRIMEIRO teste do arquivo, e é ele que paga
   * a partida a frio do pdf.js — carregar o módulo, montar o worker e ler o primeiro documento. Na
   * máquina do desenvolvedor isso cabe folgado nos 5s; num runner do GitHub Actions frio ele mediu
   * 5146ms e derrubou uma release inteira por 146 milissegundos. O teste não é lento por defeito, e
   * afrouxar o teto aqui não afrouxa nada: quem falha de verdade falha por asserção, não por tempo,
   * e os outros treze testes do arquivo continuam no teto padrão porque o módulo já está quente.
   */
  it('o caso de controle: campo e texto bem formados são lidos de verdade', async () => {
    const lido = await importar(
      'ok.pdf',
      pdfDeUmaPagina({
        widgets: [widget('Nome', 'Ana Prado')],
        linhas: [{ texto: 'NOME', x: 60, y: 705 }]
      })
    )
    // Sem esta asserção o resto do arquivo poderia estar passando por não ler NADA de nenhum PDF.
    expect(lido.fields.some((c) => c.value === 'Ana Prado')).toBe(true)
  }, 20_000)

  it('widget SEM /Rect não derruba a importação nem leva o campo bom junto', async () => {
    const semRect = '<< /Type /Annot /Subtype /Widget /FT /Tx /T (Forca) /V (12) >>'
    const lido = await importar('sem-rect.pdf', pdfDeUmaPagina({ widgets: [semRect, widget('Nome', 'Ana')] }))
    expect(lido.fields.some((c) => c.value === 'Ana')).toBe(true)
  })

  /**
   * Medido: o pdf.js normaliza QUALQUER `/Rect` torto pra `[0,0,0,0]` antes de entregar. Este teste
   * fixa esse comportamento — não porque a guarda de `sheetFromPdfDocument` conserte um estouro
   * (não conserta, ver o comentário de lá), mas porque o dia em que a normalização mudar, os
   * leitores começariam a fazer conta de distância com `NaN` sem ninguém perceber.
   */
  it('/Rect curto, com texto no lugar de número e com valores absurdos vira retângulo utilizável', async () => {
    const tortos = [
      widget('A', '1', '[100 700]'),
      widget('B', '2', '[(texto) 700 250 720]'),
      widget('C', '3', '[]'),
      widget('D', '4', '[1e400 -1e400 0 0]')
    ]
    await expect(importar('rect-torto.pdf', pdfDeUmaPagina({ widgets: tortos }))).resolves.toBeTruthy()
  })

  it('campo com valor NÃO textual (número, nome PDF, ausente) não vira "[object Object]" na ficha', async () => {
    const widgets = [
      '<< /Type /Annot /Subtype /Widget /FT /Tx /T (Numero) /V 42 /Rect [10 10 20 20] >>',
      '<< /Type /Annot /Subtype /Widget /FT /Btn /T (Marcado) /V /Yes /Rect [30 10 40 20] >>',
      '<< /Type /Annot /Subtype /Widget /FT /Tx /T (Vazio) /Rect [50 10 60 20] >>'
    ]
    const lido = await importar('valor-estranho.pdf', pdfDeUmaPagina({ widgets }))
    for (const campo of lido.fields) expect(campo.value).not.toContain('[object')
  })

  it('campo sem nome é descartado em vez de virar linha sem identidade', async () => {
    const anonimo = '<< /Type /Annot /Subtype /Widget /FT /Tx /V (perdido) /Rect [10 10 20 20] >>'
    const lido = await importar('anonimo.pdf', pdfDeUmaPagina({ widgets: [anonimo] }))
    expect(lido.fields.some((c) => c.value === 'perdido')).toBe(false)
  })

  it('ficha DIGITALIZADA (página sem texto e sem formulário) avisa em vez de fingir que leu', async () => {
    const lido = await importar('digitalizada.pdf', pdfDeUmaPagina({}))
    expect(lido.fields).toEqual([])
    expect(lido.warnings.length).toBeGreaterThan(0)
  })

  it('/Count mentindo sobre o número de páginas não trava nem lança', async () => {
    // Declara 9 páginas e entrega 1 — o laço de páginas pede as que não existem.
    await expect(importar('conta-errada.pdf', pdfDeUmaPagina({ paginas: 9 }))).resolves.toBeTruthy()
  })

  it('ficha com 2000 campos importa em tempo utilizável', async () => {
    const widgets = Array.from({ length: 2000 }, (_, i) =>
      widget(
        `Campo${i}`,
        `Valor ${i}`,
        `[${10 + (i % 50) * 10} ${700 - Math.floor(i / 50) * 12} ${60 + (i % 50) * 10} ${712 - Math.floor(i / 50) * 12}]`
      )
    )
    const inicio = Date.now()
    const lido = await importar('gigante.pdf', pdfDeUmaPagina({ widgets }))
    // Teto folgado: o que se protege é a ordem de grandeza, não o milissegundo.
    expect(Date.now() - inicio).toBeLessThan(20_000)
    expect(lido.fields.length).toBeGreaterThan(0)
  })

  it('parêntese e contrabarra no valor atravessam sem virar lixo', async () => {
    const lido = await importar(
      'escapes.pdf',
      pdfDeUmaPagina({
        widgets: [widget('Nome', 'Ana (a Braba) \\ Prado'), widget('Conceito', 'Investigadora ansiosa')],
        linhas: [{ texto: 'NOME', x: 60, y: 705 }]
      })
    )
    expect(lido.fields.some((c) => c.value.includes('Braba'))).toBe(true)
  })

  it('PDF sem página nenhuma devolve ficha vazia com aviso', async () => {
    const vazio = montarPdf([
      { corpo: '<< /Type /Catalog /Pages 2 0 R >>' },
      { corpo: '<< /Type /Pages /Kids [] /Count 0 >>' }
    ])
    const lido = await importar('sem-paginas.pdf', vazio)
    expect(lido.fields).toEqual([])
    expect(lido.warnings.length).toBeGreaterThan(0)
  })
})

describe('PDF ilegível — rejeita de forma capturável, nunca em silêncio', () => {
  /**
   * O que se exige aqui é uma PROMESSA REJEITADA, e não uma mensagem específica: a mensagem vem do
   * pdf.js e muda de versão pra versão. Rejeitar é o que `useSheetImport` consegue transformar em
   * "Não consegui ler este PDF"; estourar fora da promessa, não.
   */
  async function deveRejeitar(nome: string, bytes: Uint8Array): Promise<void> {
    await expect(abrirPdfDeBytes(nome, bytes)).rejects.toBeTruthy()
  }

  it('arquivo que não é PDF, só renomeado', async () => {
    await deveRejeitar('mentira.pdf', new Uint8Array(Buffer.from('isto aqui e um .docx renomeado', 'utf8')))
  })

  it('arquivo vazio (0 byte)', async () => {
    await deveRejeitar('vazio.pdf', new Uint8Array(0))
  })

  it('PDF cortado no meio, como download interrompido', async () => {
    const inteiro = pdfDeUmaPagina({ widgets: [widget('Nome', 'Ana')] })
    await deveRejeitar('cortado.pdf', inteiro.slice(0, Math.floor(inteiro.length / 3)))
  })

  it('PDF protegido por senha', async () => {
    const comSenha = pdfDeUmaPagina({
      widgets: [widget('Nome', 'Ana')],
      trailerExtra:
        '/Encrypt << /Filter /Standard /V 1 /R 2 /O <0102030405060708090a0b0c0d0e0f10> /U <1112131415161718191a1b1c1d1e1f20> /P -1 >> /ID [<01> <02>] '
    })
    await deveRejeitar('com-senha.pdf', comSenha)
  })
})
