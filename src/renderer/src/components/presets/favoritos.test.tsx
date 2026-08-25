// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Preset } from '@shared/types/preset'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { PresetList } from './PresetList'
import { CompactWidget } from '../compact/CompactWidget'

/**
 * A ESTRELA na tela (spec §3.9): favorito sobe pro topo com as setas, a estrela do não-favorito some
 * no teto, e o modo compacto mostra SÓ os favoritos quando existem — na ordem deles.
 */
const apiFalsa = {
  profiles: {
    get: vi.fn(() => Promise.resolve({ profiles: [{ id: 'p1', name: 'Teste', system: '', photo: null, createdAt: 1 }], activeId: 'p1' })),
    save: vi.fn((estado: unknown) => Promise.resolve(estado)),
    pickPhoto: vi.fn(() => Promise.resolve(null))
  },
  windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) }
}

function preset(id: string, name: string, favorito?: number): Preset {
  return { id, name, expression: { groups: [{ count: 1, sides: 20 }], modifiers: [] }, createdAt: 1, updatedAt: 1, ...(favorito === undefined ? {} : { favorito }) }
}

const LISTA = [preset('a', 'Espada'), preset('b', 'Bola de fogo', 1), preset('c', 'Percepção', 0), preset('d', 'Cura')]

function envolver(ui: React.ReactElement) {
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa
  return render(
    <ProfilesProvider>
      <SettingsProvider>{ui}</SettingsProvider>
    </ProfilesProvider>
  )
}

afterEach(cleanup)

describe('favoritos na lista', () => {
  it('favoritos no topo na ordem deles, com estrela cheia e setas; os outros com estrela vazia', () => {
    const onToggleFavorite = vi.fn()
    const onMoveFavorite = vi.fn()
    envolver(
      <PresetList presets={LISTA} onRoll={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onCreate={vi.fn()} onExport={vi.fn()} onImport={vi.fn()} onToggleFavorite={onToggleFavorite} onMoveFavorite={onMoveFavorite} />
    )
    const nomes = Array.from(document.querySelectorAll('.preset-card-name')).map((el) => el.textContent)
    expect(nomes).toEqual(['Percepção', 'Bola de fogo', 'Espada', 'Cura'])

    expect(screen.getAllByLabelText('Tirar dos favoritos')).toHaveLength(2)
    expect(screen.getAllByLabelText(/^Favoritar/)).toHaveLength(2)

    // A seta de subir do PRIMEIRO favorito está travada; a de descer do último também.
    const subir = screen.getAllByLabelText('Subir na fileira de favoritos')
    const descer = screen.getAllByLabelText('Descer na fileira de favoritos')
    expect((subir[0] as HTMLButtonElement).disabled).toBe(true)
    expect((descer[1] as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(descer[0])
    expect(onMoveFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), 1)
    fireEvent.click(screen.getAllByLabelText(/^Favoritar/)[0])
    expect(onToggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  it('no teto de seis, a estrela do não-favorito trava com o motivo', () => {
    const seis = Array.from({ length: 6 }, (_, i) => preset(`f${i}`, `F${i}`, i))
    envolver(
      <PresetList presets={[...seis, preset('x', 'Fora')]} onRoll={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onCreate={vi.fn()} onExport={vi.fn()} onImport={vi.fn()} onToggleFavorite={vi.fn()} onMoveFavorite={vi.fn()} />
    )
    const travada = screen.getByTitle(/Máximo de 6 favoritos/)
    expect((travada as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('favoritos no modo compacto', () => {
  it('mostra SÓ os favoritos, na ordem deles; sem favorito mostra todos', () => {
    envolver(<CompactWidget presets={LISTA} result={null} onRoll={vi.fn()} recursos={[]} onChangeRecursos={vi.fn()} />)
    let botoes = Array.from(document.querySelectorAll('.compact-preset-name')).map((el) => el.textContent)
    expect(botoes).toEqual(['Percepção', 'Bola de fogo'])
    cleanup()

    envolver(<CompactWidget presets={[preset('a', 'Espada'), preset('d', 'Cura')]} result={null} onRoll={vi.fn()} recursos={[]} onChangeRecursos={vi.fn()} />)
    botoes = Array.from(document.querySelectorAll('.compact-preset-name')).map((el) => el.textContent)
    expect(botoes).toEqual(['Espada', 'Cura'])
  })
})
