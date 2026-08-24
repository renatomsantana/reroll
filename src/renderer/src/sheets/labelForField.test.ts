import { describe, expect, it } from 'vitest'
import type { PdfField, PdfSheet, PdfText } from '@shared/types/sheetImport'
import { labelForField } from './labelForField'

/**
 * O rótulo impresso mais perto do campo — e "perto" medido da BORDA da caixa, não do centro.
 *
 * O caso que faltava, achado pela quinta leva de PDFs de teste: uma caixa de texto alta (a história
 * do personagem) com o rótulo colado no canto de cima. Do centro da caixa o rótulo ficava a 80pt,
 * fora do teto; da borda, a 4pt.
 */

function campo(name: string, rect: [number, number, number, number]): PdfField {
  return { name, value: '', type: 'tx', page: 1, rect }
}

function texto(text: string, x: number, y: number, width = text.length * 6, height = 12): PdfText {
  return { text, x, y, width, height, page: 1 }
}

function folha(fields: PdfField[], texts: PdfText[]): PdfSheet {
  return { fileName: 'teste.pdf', pageCount: 1, fields, texts }
}

describe('rótulo impresso de um campo', () => {
  it('campo de uma linha: o rótulo à esquerda, como sempre', () => {
    const nome = campo('n', [100, 700, 250, 720])
    expect(labelForField(folha([nome], [texto('NOME', 60, 704)]), nome)).toBe('NOME')
  })

  it('caixa ALTA: o rótulo no canto de cima é dela, mesmo longe do centro', () => {
    const historia = campo('Historia', [100, 600, 400, 740])
    const rotulo = texto('HISTÓRIA', 100, 744)
    expect(labelForField(folha([historia], [rotulo]), historia)).toBe('HISTÓRIA')
  })

  it('o teto continua valendo da borda pra fora', () => {
    const historia = campo('Historia', [100, 600, 400, 740])
    // 100pt acima da borda de cima: é o título da página, não o rótulo da caixa.
    expect(labelForField(folha([historia], [texto('FICHA', 100, 840)]), historia)).toBeNull()
  })

  it('entre dois rótulos, fica o mais perto da caixa', () => {
    const historia = campo('Historia', [100, 600, 400, 740])
    const perto = texto('HISTÓRIA', 100, 744)
    const longe = texto('APARÊNCIA', 100, 790)
    expect(labelForField(folha([historia], [longe, perto]), historia)).toBe('HISTÓRIA')
  })
})
