// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O BOTÃO VOLTAR do Android. O teste existe porque as duas falhas possíveis aqui são graves e
 * NENHUMA das duas aparece no PC:
 *
 * - fechar o app quando havia modal aberto: perde o histórico de rolagens da sessão, e o gesto que
 *   causa isso é o mais usado do aparelho;
 * - nunca fechar o app: o Android espera que voltar na tela inicial saia, e um app que se recusa a
 *   sair é um app que se desinstala.
 *
 * A ponte entre o botão e os modais é um Esc SINTÉTICO (ver `botaoVoltarDoAndroid.ts`), então o que
 * se verifica é: saiu um Esc na `window`, ou saiu um `exitApp`. Nunca os dois.
 */

const ouvintes: Array<() => void> = []
const exitApp = vi.fn()

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (evento: string, fn: () => void) => {
      if (evento === 'backButton') ouvintes.push(fn)
      return Promise.resolve({ remove: vi.fn() })
    },
    exitApp: () => {
      exitApp()
      return Promise.resolve()
    }
  }
}))

const { ligarBotaoVoltar } = await import('./botaoVoltarDoAndroid')

/** Aperta o botão voltar do aparelho. */
function apertarVoltar(): void {
  for (const ouvinte of ouvintes) ouvinte()
}

let escs = 0

beforeEach(() => {
  document.body.innerHTML = ''
  ouvintes.length = 0
  exitApp.mockClear()
  escs = 0
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') escs++
  })
  ligarBotaoVoltar()
})

describe('o botão voltar do Android', () => {
  it('com modal aberto, manda o Esc que fecha o modal e NÃO sai do app', () => {
    document.body.innerHTML = '<div class="modal-overlay"><div class="card">Histórico</div></div>'
    apertarVoltar()
    expect(escs).toBe(1)
    expect(exitApp).not.toHaveBeenCalled()
  })

  it('sem nada aberto, sai do app — que é o que o Android espera', () => {
    apertarVoltar()
    expect(escs).toBe(0)
    expect(exitApp).toHaveBeenCalledTimes(1)
  })

  it('fechado o modal, o voltar seguinte sai do app', () => {
    document.body.innerHTML = '<div class="modal-overlay"></div>'
    apertarVoltar()
    expect(exitApp).not.toHaveBeenCalled()
    // O modal saiu da tela ao receber o Esc; o próximo voltar não tem mais o que fechar.
    document.body.innerHTML = ''
    apertarVoltar()
    expect(exitApp).toHaveBeenCalledTimes(1)
  })

  it('o Esc sobe até a `window`, que é onde os modais escutam', () => {
    document.body.innerHTML = '<div class="modal-overlay"></div>'
    let chegouNaWindow = false
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') chegouNaWindow = true
    })
    apertarVoltar()
    expect(chegouNaWindow).toBe(true)
  })
})
