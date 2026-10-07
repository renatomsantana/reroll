// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { limparEstatisticasAntigas } from './limparEstatisticasAntigas'

describe('remoção das estatísticas antigas', () => {
  it('remove apenas a preferência e cookies do Analytics, preservando o tabuleiro', () => {
    const armazenamento = new Map([
      ['reroll.analytics.consent.v1', 'granted'],
      ['tabuleiro', 'meus dados']
    ])
    vi.stubGlobal('localStorage', { removeItem: (chave: string) => armazenamento.delete(chave) })
    const cookies = vi.spyOn(document, 'cookie', 'get').mockReturnValue('_ga=abc; _ga_GEP6DCNPDV=xyz; outro=valor')
    const apagar = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {})
    try {
      limparEstatisticasAntigas()
      expect(armazenamento.has('reroll.analytics.consent.v1')).toBe(false)
      expect(armazenamento.get('tabuleiro')).toBe('meus dados')
      expect(apagar).toHaveBeenCalledTimes(6)
      expect(apagar.mock.calls.every(([cookie]) => cookie.startsWith('_ga'))).toBe(true)
      expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull()
    } finally {
      cookies.mockRestore()
      apagar.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('continua funcionando com armazenamento bloqueado', () => {
    vi.stubGlobal('localStorage', { removeItem: () => { throw new Error('bloqueado') } })
    try {
      expect(() => limparEstatisticasAntigas()).not.toThrow()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
