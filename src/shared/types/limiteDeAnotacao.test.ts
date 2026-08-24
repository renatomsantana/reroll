import { describe, expect, it } from 'vitest'
import { TAMANHO_MAXIMO_DA_ANOTACAO, textoDeAnotacaoLimitado, normalizeNotes, createNotesPage } from './notes'

describe('o teto de caracteres da sessão de anotações', () => {
  it('o que cabe passa inteiro; o que passa do teto entra cortado NELE, não em outro número', () => {
    const justo = 'a'.repeat(TAMANHO_MAXIMO_DA_ANOTACAO)
    expect(textoDeAnotacaoLimitado(justo)).toBe(justo)
    expect(textoDeAnotacaoLimitado(justo + 'estoura')).toBe(justo)
    expect(textoDeAnotacaoLimitado('')).toBe('')
  })

  it('sessão ANTIGA acima do teto não é cortada na leitura — arquivo velho não perde conteúdo', () => {
    // A mesma regra do teto de personagens: o limite vale pra crescer, nunca pra ler.
    const gigante = 'x'.repeat(TAMANHO_MAXIMO_DA_ANOTACAO * 3)
    const lido = normalizeNotes({ pages: [{ ...createNotesPage(gigante) }] })
    expect(lido.pages[0].text).toHaveLength(TAMANHO_MAXIMO_DA_ANOTACAO * 3)
  })
})
