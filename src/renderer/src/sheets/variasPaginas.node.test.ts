import { describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { abrirPdfDeBytes } from './testes/abrirPdfNoNode'
import { pdfDeVariasPaginas, widget } from './testes/pdfDeMentira'

/**
 * FICHA DE VÁRIAS PÁGINAS — que é a forma normal de uma ficha de RPG.
 *
 * A página faz parte da identidade de campo e de texto (`PdfField.page`/`PdfText.page`), e é ela que
 * impede um campo da página 2 de adotar o rótulo impresso da página 1. Até aqui nenhum teste
 * exercitava isso: os PDFs fabricados tinham uma página só, então não havia outra de onde roubar, e
 * as três fichas de referência não têm rótulos coincidindo entre páginas.
 *
 * O caso duro, e é o que este arquivo monta: rótulos DIFERENTES nas MESMAS coordenadas de páginas
 * diferentes. Sem o recorte por página, todo campo veria três rótulos igualmente próximos e a
 * escolha viraria sorteio pela ordem interna da lista.
 */

/**
 * As três páginas têm a mesma diagramação de propósito — só o texto muda.
 *
 * Rótulo ACIMA da caixa, que é uma das duas posições canônicas (a outra é à esquerda) e a que
 * `labelForField` procura. As coordenadas não são decorativas: o casamento tem teto de distância
 * (70pt), então rótulo e campo precisam estar tão perto quanto ficam numa ficha de verdade — com o
 * rótulo jogado na margem, o teste mediria só o teto, não o recorte por página.
 */
const X_ROTULO = 120
const Y = 760
const RECT = '[120 730 220 750]'

function fichaDeTresPaginas(): Uint8Array {
  return pdfDeVariasPaginas([
    {
      linhas: [{ texto: 'INVESTIGADOR', x: X_ROTULO, y: Y }],
      widgets: [widget('p1c1', 'Elias Ramos', RECT)]
    },
    {
      linhas: [{ texto: 'ANTROPOLOGIA', x: X_ROTULO, y: Y }],
      widgets: [widget('p2c1', '55', RECT)]
    },
    {
      linhas: [{ texto: 'DANO DA ARMA', x: X_ROTULO, y: Y }],
      widgets: [widget('p3c1', '1d10+2', RECT)]
    }
  ])
}

describe('ficha espalhada por várias páginas', () => {
  it('cada campo fica com o rótulo da PRÓPRIA página, mesmo com todas iguais', async () => {
    const lido = readSheet(await abrirPdfDeBytes('tres-paginas.pdf', fichaDeTresPaginas()))
    const porValor = new Map(lido.fields.map((c) => [c.value, c.label]))

    expect(porValor.get('Elias Ramos')).toBe('INVESTIGADOR')
    expect(porValor.get('55')).toBe('ANTROPOLOGIA')
    expect(porValor.get('1d10+2')).toBe('DANO DA ARMA')
  })

  it('a extração marca a página certa em cada campo e em cada texto', async () => {
    const sheet = await abrirPdfDeBytes('tres-paginas.pdf', fichaDeTresPaginas())
    expect(sheet.pageCount).toBe(3)
    expect(sheet.fields.map((c) => c.page)).toEqual([1, 2, 3])
    expect(sheet.texts.map((t) => t.page)).toEqual([1, 2, 3])
  })

  it('rolagem escrita na ÚLTIMA página vira preset — a leitura não para na primeira', async () => {
    const lido = readSheet(await abrirPdfDeBytes('tres-paginas.pdf', fichaDeTresPaginas()))
    const preset = lido.presets.find((p) => p.source.includes('1d10'))
    expect(preset).toBeDefined()
    expect(preset?.name).toBe('DANO DA ARMA')
    expect(preset?.expression.groups).toEqual([{ sides: 10, count: 1 }])
    expect(preset?.expression.modifiers).toEqual([{ type: 'flat', value: 2 }])
  })

  it('página vazia no meio não interrompe a leitura das seguintes', async () => {
    /**
     * Acontece de verdade: fichas trazem uma página de anotações em branco, ou uma folha de arte
     * sem campo nenhum. Se o laço de páginas parasse ou estourasse ali, tudo depois dela sumiria —
     * e o que some é justamente o fim da ficha, que é onde ficam armas e magias.
     */
    const bytes = pdfDeVariasPaginas([
      { linhas: [{ texto: 'NOME', x: X_ROTULO, y: Y }], widgets: [widget('n', 'Elias', RECT)] },
      {},
      { linhas: [{ texto: 'DANO', x: X_ROTULO, y: Y }], widgets: [widget('d', '2d6', RECT)] }
    ])
    const lido = readSheet(await abrirPdfDeBytes('com-pagina-vazia.pdf', bytes))
    expect(lido.fields.map((c) => c.value)).toEqual(['Elias', '2d6'])
    expect(lido.presets.map((p) => p.name)).toEqual(['DANO'])
  })
})
