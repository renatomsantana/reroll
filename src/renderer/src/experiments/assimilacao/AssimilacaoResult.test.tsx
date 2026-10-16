// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RollResult } from '@shared/types/dice'
import { AssimilacaoDesk, lerRegistros, textoDoRegistro, type RegistroAssimilacao } from './AssimilacaoResult'
import { translations } from '../../i18n/translations'

vi.mock('../../i18n/useTranslation', () => ({ useTranslation: () => translations['pt-BR'] }))
const KEY = 'reroll:assimilacao:testes:v1'
const result: RollResult = {
  id: 'teste-misto', timestamp: 1791740000000, label: '1d6 + 1d10 + 1d12',
  groups: [{ sides: 6, rolls: [1], subtotal: 1 }, { sides: 10, rolls: [10], subtotal: 10 }, { sides: 12, rolls: [11], subtotal: 11 }],
  modifierTotal: 0, total: 22
}
const props = { result, rolling: false, limite: 1, todos: false, simples: false, nome: 'Investigar o laboratório' }
const registro: RegistroAssimilacao = {
  id: result.id, timestamp: result.timestamp, nome: props.nome, anotacao: 'Encontrei a pista.',
  faces: [{ sides: 6, value: 1 }, { sides: 10, value: 10 }, { sides: 12, value: 11 }], indices: [2], simples: false, todos: false
}
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('seleção e registro do teste misto', () => {
  it('não escolhe pelo jogador; troca o dado mantido e salva a face inteira com anotação', () => {
    const view = render(<AssimilacaoDesk {...props} />)
    expect((screen.getByRole('button', { name: 'Registrar teste' })).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Dado 2, d10:/ }))
    expect(screen.getByLabelText('Sucesso: 2')).toBeTruthy()
    expect(screen.getByLabelText('Pressão: 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Dado 3, d12:/ }))
    expect(screen.getByLabelText('Sucesso: 1')).toBeTruthy()
    expect(screen.getByLabelText('Adaptação: 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Dado 2, d10:/ }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.change(screen.getByLabelText('Anotação do teste'), { target: { value: 'Encontrei a pista.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar teste' }))
    expect(screen.getByText('Salvo neste navegador.')).toBeTruthy()
    expect(lerRegistros(localStorage.getItem(KEY))).toEqual([registro])
    view.unmount()
    render(<AssimilacaoDesk {...props} result={null} />)
    fireEvent.click(screen.getByText('Histórico de testes'))
    const history = screen.getByRole('article')
    expect(within(history).getByText(props.nome)).toBeTruthy()
    expect(history.textContent).toContain('1 sucesso · 2 adaptações · 1 pressão')
    expect(history.textContent).toContain('Nota: Encontrei a pista.')
    expect(history.textContent).not.toContain('Total: 22')
  })
  it('respeita dois mantidos e permite desmarcar para trocar', () => {
    render(<AssimilacaoDesk {...props} limite={2} />)
    fireEvent.click(screen.getByRole('button', { name: /Dado 2,/ }))
    fireEvent.click(screen.getByRole('button', { name: /Dado 3,/ }))
    expect(screen.getByLabelText('Sucesso: 3')).toBeTruthy()
    expect(screen.getByLabelText('Pressão: 2')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Dado 1,/ })).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Dado 2,/ }))
    expect((screen.getByRole('button', { name: /Dado 1,/ })).hasAttribute('disabled')).toBe(false)
  })
  it('separa a contagem bruta da resolução simples e permite manter todos explicitamente', () => {
    const view = render(<AssimilacaoDesk {...props} simples />)
    fireEvent.click(screen.getByRole('button', { name: /Dado 3,/ }))
    expect(screen.getByLabelText('Adaptação: 2')).toBeTruthy()
    expect(screen.getByText(/1 pressão evitada/)).toBeTruthy()
    expect(screen.getByText('0 pressões')).toBeTruthy()
    view.rerender(<AssimilacaoDesk {...props} todos />)
    expect(screen.getByLabelText('Sucesso: 3')).toBeTruthy()
    expect(screen.getByLabelText('Pressão: 2')).toBeTruthy()
    expect(screen.getByText('3/3 mantidos')).toBeTruthy()
  })
  it('o texto de chat inclui pilha, seleção, símbolos e nota, nunca soma numérica', () => {
    expect(textoDoRegistro(registro)).toContain('Mantidos 1/3: d12: Sucesso + Adaptação + Adaptação + Pressão')
    expect(textoDoRegistro({ ...registro, simples: true })).toContain('Ação simples: 1 adaptação · 0 pressões.')
  })
  it('tolera armazenamento corrompido sem carregar registros com faces ou datas impossíveis', () => {
    expect(lerRegistros('{')).toEqual([])
    expect(lerRegistros(JSON.stringify([registro, { ...registro, timestamp: 1e30 }, { ...registro, faces: [{ sides: 6, value: 7 }] }, { ...registro, indices: [2, 2] }]))).toEqual([registro])
  })
})
