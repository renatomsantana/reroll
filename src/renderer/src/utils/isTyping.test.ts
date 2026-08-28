// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isTypingTarget, teclaVeioDeDigitacao } from './isTyping'

/**
 * O caso que virou bug relatado: "apertei enter para finalizar a condição do personagem e acabou
 * rolando". O Enter confirma e FECHA o editor da condição no HUD — o input desmonta antes de o
 * evento nativo chegar à `window`, então o atalho de rolar olhava `document.activeElement`, via o
 * `body`, e rolava. A guarda tem que olhar também o ALVO ORIGINAL do evento, que continua
 * apontando pro campo mesmo depois de ele sair do DOM.
 */
describe('teclaVeioDeDigitacao', () => {
  function eventoVindoDe(alvo: EventTarget | null): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key: 'Enter' })
    // `target` é read-only e definido no dispatch; aqui o teste o fixa direto, como o navegador o
    // deixaria depois de o evento ter passado pelo campo.
    Object.defineProperty(evento, 'target', { value: alvo })
    return evento
  }

  it('tecla nascida num input JÁ REMOVIDO do DOM ainda conta como digitação', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    const evento = eventoVindoDe(campo)
    // O confirmar desmonta o campo — foco volta pro body ANTES de o atalho global rodar.
    campo.remove()
    expect(document.activeElement).not.toBe(campo)

    expect(teclaVeioDeDigitacao(evento)).toBe(true)
  })

  it('tecla vinda de fora de campo de texto não conta', () => {
    const botao = document.createElement('button')
    document.body.appendChild(botao)
    const evento = eventoVindoDe(botao)
    expect(teclaVeioDeDigitacao(evento)).toBe(false)
    botao.remove()
  })

  it('com o foco num campo vivo, conta mesmo que o alvo seja outro', () => {
    const campo = document.createElement('textarea')
    document.body.appendChild(campo)
    campo.focus()
    expect(teclaVeioDeDigitacao(eventoVindoDe(document.body))).toBe(true)
    campo.remove()
  })
})

describe('isTypingTarget', () => {
  it('checkbox e rádio não são digitação — espaço neles é o gesto de marcar', () => {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const radio = document.createElement('input')
    radio.type = 'radio'
    expect(isTypingTarget(checkbox)).toBe(false)
    expect(isTypingTarget(radio)).toBe(false)
  })

  it('input de texto, textarea e select são digitação', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    expect(isTypingTarget(null)).toBe(false)
  })
})
