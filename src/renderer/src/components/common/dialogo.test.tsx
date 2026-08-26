// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { DialogoProvider, useDialogo } from './Dialogo'

/**
 * O diálogo do app no lugar do `confirm()`/`alert()` nativos (ver o cabeçalho de `Dialogo.tsx`):
 * a promessa resolve com o botão clicado, Esc cancela, Enter confirma, e fora do provedor o hook
 * cai no nativo — que é o que os testes das abas, montadas sozinhas, continuam usando.
 */
const apiFalsa = {
  profiles: {
    get: vi.fn(() => Promise.resolve({ profiles: [{ id: 'p1', name: 'Teste', system: '', photo: null, createdAt: 1 }], activeId: 'p1' })),
    save: vi.fn((estado: unknown) => Promise.resolve(estado)),
    pickPhoto: vi.fn(() => Promise.resolve(null))
  },
  windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) }
}

const respostas: string[] = []

function Sonda() {
  const dialogo = useDialogo()
  return (
    <div>
      <button onClick={() => void dialogo.confirmar('Apagar o preset "Espada"?').then((ok) => respostas.push(`confirmar:${ok}`))}>perguntar</button>
      <button onClick={() => void dialogo.avisar('Não deu.').then(() => respostas.push('avisar:fechou'))}>avisar</button>
    </div>
  )
}

function montar(comProvedor = true) {
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa
  respostas.length = 0
  render(
    <ProfilesProvider>
      <SettingsProvider>{comProvedor ? <DialogoProvider><Sonda /></DialogoProvider> : <Sonda />}</SettingsProvider>
    </ProfilesProvider>
  )
}

afterEach(cleanup)

describe('o diálogo do app', () => {
  it('confirmar: OK resolve true, Cancelar resolve false, e o texto está na tela', async () => {
    montar()
    fireEvent.click(screen.getByText('perguntar'))
    expect(screen.getByRole('alertdialog').textContent).toContain('Apagar o preset "Espada"?')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(respostas).toEqual(['confirmar:true']))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    fireEvent.click(screen.getByText('perguntar'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(respostas).toEqual(['confirmar:true', 'confirmar:false']))
  })

  it('Esc cancela e Enter confirma', async () => {
    montar()
    fireEvent.click(screen.getByText('perguntar'))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(respostas).toEqual(['confirmar:false']))
    fireEvent.click(screen.getByText('perguntar'))
    fireEvent.keyDown(window, { key: 'Enter' })
    await waitFor(() => expect(respostas).toEqual(['confirmar:false', 'confirmar:true']))
  })

  it('avisar: só o OK, e a promessa resolve ao fechar', async () => {
    montar()
    fireEvent.click(screen.getByText('avisar'))
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(respostas).toEqual(['avisar:fechou']))
  })

  it('fora do provedor cai no confirm() nativo', async () => {
    const nativo = vi.spyOn(window, 'confirm').mockReturnValue(false)
    montar(false)
    fireEvent.click(screen.getByText('perguntar'))
    await waitFor(() => expect(respostas).toEqual(['confirmar:false']))
    expect(nativo).toHaveBeenCalledWith('Apagar o preset "Espada"?')
    nativo.mockRestore()
  })
})
