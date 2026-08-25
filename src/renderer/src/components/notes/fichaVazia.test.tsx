// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesData } from '@shared/types/notes'
import { DEFAULT_NOTES } from '@shared/types/notes'
import type { ProfilesState } from '@shared/types/profile'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { SheetTab } from './SheetTab'

/**
 * A FICHA VAZIA (pedido do usuário pro beta: "deixa a ficha vazia, para a pessoa poder usufruir e
 * fazer questão de uploadar uma para testar"): personagem sem nada mostra o convite de importar, não
 * os cinco blocos; "preencher à mão" traz os blocos; uma ficha com qualquer conteúdo já vem com eles.
 */
const PERFIS: ProfilesState = {
  profiles: [{ id: 'p1', name: 'Novo', system: '', photo: null, createdAt: 1 }],
  activeId: 'p1'
}

let fichaNoDisco: NotesData

function apiFalsa() {
  return {
    profiles: {
      get: vi.fn(() => Promise.resolve(structuredClone(PERFIS))),
      save: vi.fn((estado: ProfilesState) => Promise.resolve(estado)),
      pickPhoto: vi.fn(() => Promise.resolve(null))
    },
    windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) },
    notes: {
      get: vi.fn(() => Promise.resolve(structuredClone(fichaNoDisco))),
      save: vi.fn((dados: NotesData) => Promise.resolve(dados))
    },
    sheets: { pickPdf: vi.fn(() => Promise.resolve({ ok: false, motivo: 'cancelado' })), apply: vi.fn() }
  }
}

async function montar() {
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
  render(
    <ProfilesProvider>
      <SettingsProvider>
        <SheetTab />
      </SettingsProvider>
    </ProfilesProvider>
  )
  await waitFor(() => expect(screen.getByDisplayValue('Novo')).toBeTruthy())
}

beforeEach(() => {
  localStorage.clear()
  fichaNoDisco = { ...DEFAULT_NOTES, pages: [{ id: 'd1', title: '', text: '', createdAt: 1 }] }
})

afterEach(cleanup)

describe('a ficha vazia', () => {
  it('personagem sem nada: o convite de importar, e nenhum bloco de texto', async () => {
    await montar()
    expect(screen.getByText('Esta ficha está vazia.')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /Atributos|História|Inventário/ })).toBeNull()
    expect(document.querySelectorAll('.sheet-textarea')).toHaveLength(0)
    // O botão de importar está no convite E no cabeçalho — dois caminhos pro mesmo lugar.
    expect(screen.getAllByRole('button', { name: 'Importar ficha (PDF)' }).length).toBeGreaterThanOrEqual(1)
  })

  it('"preencher à mão" traz os cinco blocos', async () => {
    await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Prefiro preencher à mão' }))
    expect(screen.queryByText('Esta ficha está vazia.')).toBeNull()
    expect(document.querySelectorAll('.sheet-textarea')).toHaveLength(5)
  })

  it('ficha com qualquer conteúdo já vem com os blocos, sem convite', async () => {
    fichaNoDisco = { ...fichaNoDisco, backstory: 'Nasceu em Porto Alegre.' }
    await montar()
    expect(screen.queryByText('Esta ficha está vazia.')).toBeNull()
    expect(screen.getByDisplayValue('Nasceu em Porto Alegre.')).toBeTruthy()
  })
})
