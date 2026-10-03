// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeRichHtml } from './EditorDeAnotacoesRich'

describe('formatação das anotações', () => {
  it('preserva os estilos escritos e elimina marcação que não pertence ao editor', () => {
    const safe = sanitizeRichHtml('<b>forte</b> <i>leve</i><script>alert(1)</script><a href="https://fora">link</a>')

    expect(safe).toContain('<b>forte</b>')
    expect(safe).toContain('<i>leve</i>')
    expect(safe).toContain('link')
    expect(safe).not.toContain('<script')
    expect(safe).not.toContain('<a ')
  })

  it('mantém a cor escolhida pelo editor', () => {
    expect(sanitizeRichHtml('<font color="#e01818">vermelho</font>')).toBe(
      '<span style="color: rgb(224, 24, 24);">vermelho</span>'
    )
    expect(sanitizeRichHtml('<span style="color: rgb(224, 24, 24);">vermelho</span>')).toBe(
      '<span style="color: rgb(224, 24, 24);">vermelho</span>'
    )
  })
})
