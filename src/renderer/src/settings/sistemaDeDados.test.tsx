// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider, useSettings } from './SettingsContext'
import { SISTEMA_LOCAL_STORAGE_KEY } from '../experiments/assimilacao/enabled'

vi.mock('./ProfilesContext', () => ({ useProfiles: () => ({ activeId: 'teste' }) }))
function Controle() {
  const { gameSystem, setGameSystem, diceBodyColor } = useSettings()
  return <><span>{gameSystem}</span><span>{diceBodyColor}</span><button onClick={() => setGameSystem('assimilacao')}>Assimilação</button><button onClick={() => setGameSystem('padrao')}>Padrão</button></>
}
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('troca do sistema pelas preferências', () => {
  it('troca na hora, persiste e volta ao Padrão sem alterar a aparência', () => {
    const view = render(<SettingsProvider><Controle /></SettingsProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Assimilação' }))
    expect(screen.getByText('assimilacao')).toBeTruthy()
    expect(localStorage.getItem(SISTEMA_LOCAL_STORAGE_KEY)).toBe('assimilacao')
    view.unmount()
    render(<SettingsProvider><Controle /></SettingsProvider>)
    expect(screen.getByText('assimilacao')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Padrão' }))
    expect(screen.getByText('padrao')).toBeTruthy()
    expect(screen.getByText('#e01818')).toBeTruthy()
    expect(localStorage.getItem(SISTEMA_LOCAL_STORAGE_KEY)).toBe('padrao')
  })
})
