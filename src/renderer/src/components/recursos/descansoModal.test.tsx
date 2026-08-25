// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecursoVital } from '@shared/types/recursoVital'
import type { Descanso } from '@shared/types/descanso'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { DescansoModal } from './DescansoModal'

/**
 * A CONFIRMAÇÃO do descanso (spec §3.8): o delta na tela antes do clique, o tipo escolhível, e o
 * descanso completo quando não há tipo nenhum.
 */
const apiFalsa = {
  profiles: {
    get: vi.fn(() => Promise.resolve({ profiles: [{ id: 'p1', name: 'Teste', system: '', photo: null, createdAt: 1 }], activeId: 'p1' })),
    save: vi.fn((estado: unknown) => Promise.resolve(estado)),
    pickPhoto: vi.fn(() => Promise.resolve(null))
  },
  windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) }
}

const RECURSOS: RecursoVital[] = [
  { id: 'pv', nome: 'PV', atual: 12, maximo: 45 },
  { id: 'pe', nome: 'PE', atual: 4, maximo: 12 }
]

const TIPOS: Descanso[] = [
  { id: 'longo', nome: 'Descanso longo', efeitos: [{ recursoId: 'pv', modo: 'maximo' }, { recursoId: 'pe', modo: 'maximo' }] },
  { id: 'curto', nome: 'Descanso curto', efeitos: [{ recursoId: 'pe', modo: 'somar', quantidade: 3 }] }
]

function montar(descansos: Descanso[]) {
  const acoes = { onConfirm: vi.fn(), onEdit: vi.fn(), onCancel: vi.fn() }
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa
  render(
    <ProfilesProvider>
      <SettingsProvider>
        <DescansoModal recursos={RECURSOS} descansos={descansos} {...acoes} />
      </SettingsProvider>
    </ProfilesProvider>
  )
  return acoes
}

afterEach(cleanup)

describe('a confirmação do descanso', () => {
  it('mostra o delta do tipo escolhido, troca de tipo, e confirma com o tipo certo', () => {
    const acoes = montar(TIPOS)
    expect(screen.getByText('PV')).toBeTruthy()
    expect(screen.getByText('45')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'curto' } })
    // Só o PE muda no curto: 4 → 7.
    expect(screen.queryByText('PV')).toBeNull()
    expect(screen.getByText('7')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Descansar' }))
    expect(acoes.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'curto' }))
  })

  it('sem tipo nenhum, oferece o descanso completo — tudo ao máximo', () => {
    const acoes = montar([])
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('PV')).toBeTruthy()
    expect(screen.getByText('PE')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Descansar' }))
    const descanso = acoes.onConfirm.mock.calls[0][0] as Descanso
    expect(descanso.efeitos).toEqual([
      { recursoId: 'pv', modo: 'maximo' },
      { recursoId: 'pe', modo: 'maximo' }
    ])
  })

  it('"Editar tipos…" e Esc chamam quem deve', () => {
    const acoes = montar(TIPOS)
    fireEvent.click(screen.getByRole('button', { name: 'Editar tipos…' }))
    expect(acoes.onEdit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(acoes.onCancel).toHaveBeenCalledTimes(1)
  })
})
