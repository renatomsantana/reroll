// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const CHAVE = 'reroll.analytics.consent.v1'
const janela = window as Window & {
  dataLayer?: IArguments[]
  gtag?: (...args: unknown[]) => void
  'ga-disable-G-GEP6DCNPDV'?: boolean
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('location', { hostname: 'reroll.com.br' })
  const armazenamento = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (chave: string) => armazenamento.get(chave) ?? null,
    setItem: (chave: string, valor: string) => armazenamento.set(chave, valor),
    clear: () => armazenamento.clear()
  })
  localStorage.clear()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  delete janela.dataLayer
  delete janela.gtag
  delete janela['ga-disable-G-GEP6DCNPDV']
})

afterEach(() => vi.unstubAllGlobals())

describe('escolha de estatísticas', () => {
  it('não carrega a tag nem cria fila de eventos antes da escolha', async () => {
    await import('./analytics')
    expect(document.querySelector('script')).toBeNull()
    expect(janela.dataLayer).toBeUndefined()
    expect(document.querySelector<HTMLElement>('.analytics-consent')?.hidden).toBe(false)
  })

  it('aceitar inicia a medição com comandos no formato do Google e sem anúncios', async () => {
    await import('./analytics')
    document.querySelectorAll<HTMLButtonElement>('.analytics-consent-actions button')[1].click()
    expect(localStorage.getItem(CHAVE)).toBe('granted')
    expect(document.querySelector<HTMLScriptElement>('script')?.src).toContain('G-GEP6DCNPDV')
    const comando = janela.dataLayer?.[0]
    expect(Object.prototype.toString.call(comando)).toBe('[object Arguments]')
    expect(comando?.[2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied' })
  })

  it('respeita a recusa salva em visitas futuras', async () => {
    localStorage.setItem(CHAVE, 'denied')
    await import('./analytics')
    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector<HTMLElement>('.analytics-consent')?.hidden).toBe(true)
    expect(janela['ga-disable-G-GEP6DCNPDV']).toBe(true)
  })

  it('permite revogar a escolha e desativa a tag já carregada', async () => {
    localStorage.setItem(CHAVE, 'granted')
    await import('./analytics')
    document.querySelector<HTMLButtonElement>('.analytics-privacy-button')?.click()
    document.querySelector<HTMLButtonElement>('.analytics-consent-actions button')?.click()
    expect(localStorage.getItem(CHAVE)).toBe('denied')
    expect(janela['ga-disable-G-GEP6DCNPDV']).toBe(true)
    expect(janela.dataLayer?.at(-1)?.[2]).toEqual({ analytics_storage: 'denied' })
  })

  it('não mede localhost ou domínios de desenvolvimento', async () => {
    vi.stubGlobal('location', { hostname: 'localhost' })
    await import('./analytics')
    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('.analytics-consent')).toBeNull()
  })
})
