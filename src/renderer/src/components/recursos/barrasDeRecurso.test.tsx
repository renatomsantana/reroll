// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesData } from '@shared/types/notes'
import { DEFAULT_NOTES } from '@shared/types/notes'
import type { ProfilesState } from '@shared/types/profile'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { NotesProvider, useNotes } from '@renderer/hooks/useNotes'
import { BarrasDeRecurso } from './BarrasDeRecurso'

/**
 * AS BARRAS DE RECURSO (spec §3.4), no que importa numa sessão: cada clique muda o número certo e
 * CHEGA AO DISCO. A montagem usa o `NotesProvider` de verdade — o mesmo caminho da tela —, porque
 * o defeito que este arquivo mais precisa pegar é a gravação que não acontece (a guarda `prontoRef`
 * do `useNotes`), não a conta em si, que `recursoVital.test.ts` já cobre.
 */

const PERFIS: ProfilesState = {
  profiles: [{ id: 'p1', name: 'Matias', system: 'Ordem Paranormal', photo: null, createdAt: 1 }],
  activeId: 'p1'
}

function fichaComBarras(): NotesData {
  return {
    ...DEFAULT_NOTES,
    characterName: 'Matias',
    pages: [{ id: 'dia-1', title: '', text: '', createdAt: 1 }],
    recursos: [
      { id: 'pv', nome: 'PV', atual: 30, maximo: 45 },
      { id: 'san', nome: 'Sanidade', atual: 10, maximo: 40, cor: '#800080' }
    ]
  }
}

const gravacoes: NotesData[] = []

function apiFalsa() {
  return {
    profiles: {
      get: vi.fn(() => Promise.resolve(structuredClone(PERFIS))),
      save: vi.fn((estado: ProfilesState) => Promise.resolve(estado)),
      pickPhoto: vi.fn(() => Promise.resolve(null))
    },
    windowControls: { setAppIcon: vi.fn(() => Promise.resolve()), setCompact: vi.fn(() => Promise.resolve()) },
    notes: {
      get: vi.fn(() => Promise.resolve(fichaComBarras())),
      save: vi.fn((dados: NotesData) => {
        gravacoes.push(structuredClone(dados))
        return Promise.resolve(dados)
      })
    }
  }
}

/** As barras ligadas às anotações de verdade, como o `App` faz. */
function Tela() {
  const notas = useNotes()
  return <BarrasDeRecurso recursos={notas.notes.recursos} onChange={(lista) => notas.updateField('recursos', lista)} />
}

async function montar() {
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
  render(
    <ProfilesProvider>
      <SettingsProvider>
        <NotesProvider>
          <Tela />
        </NotesProvider>
      </SettingsProvider>
    </ProfilesProvider>
  )
  await waitFor(() => expect(screen.getByLabelText('Tirar de PV')).toBeTruthy())
}

/**
 * Clica e ESPERA a gravação — a mesma corrida real de `lacunasNaFicha.test.tsx`: o `useNotes`
 * descarta mudança enquanto `loadedFor !== activeId`, e o clique perdido é o comportamento certo.
 */
async function clicarAteGravar(el: Element, opcoes?: object): Promise<NotesData> {
  const antes = gravacoes.length
  await waitFor(() => {
    fireEvent.click(el, opcoes)
    expect(gravacoes.length).toBeGreaterThan(antes)
  })
  return gravacoes[gravacoes.length - 1]
}

const pv = (dados: NotesData) => dados.recursos.find((r) => r.nome === 'PV')!

beforeEach(() => {
  localStorage.clear()
  gravacoes.length = 0
})

afterEach(cleanup)

describe('as barras de recurso', () => {
  it('mostra atual e máximo, e a proporção da barra', async () => {
    await montar()
    const barra = screen.getByRole('progressbar', { name: 'PV' })
    expect(barra.getAttribute('aria-valuenow')).toBe('30')
    expect(barra.getAttribute('aria-valuemax')).toBe('45')
    expect((barra.firstElementChild as HTMLElement).style.width).toBe(`${(30 / 45) * 100}%`)
  })

  it('"−" tira 1 e grava; Shift+clique tira 5', async () => {
    await montar()
    const menos = screen.getByLabelText('Tirar de PV')
    let gravado = await clicarAteGravar(menos)
    expect(pv(gravado).atual).toBe(29)
    gravado = await clicarAteGravar(menos, { shiftKey: true })
    expect(pv(gravado).atual).toBe(24)
    // A outra barra não mexeu.
    expect(gravado.recursos.find((r) => r.nome === 'Sanidade')?.atual).toBe(10)
  })

  it('"+" não passa do máximo', async () => {
    await montar()
    const mais = screen.getByLabelText('Somar em Sanidade')
    // Sanidade está em 10 de 40: Shift sobe de 5 em 5.
    let gravado = await clicarAteGravar(mais, { shiftKey: true })
    expect(gravado.recursos[1].atual).toBe(15)
    for (let i = 0; i < 10; i++) gravado = await clicarAteGravar(mais, { shiftKey: true })
    expect(gravado.recursos[1].atual).toBe(40)
  })

  it('clicar no número abre o campo; "-7" desconta, Enter grava', async () => {
    await montar()
    fireEvent.click(screen.getByRole('button', { name: /PV: 30 de 45/ }))
    const campo = screen.getByRole('textbox', { name: /PV: 30 de 45/ })
    const antes = gravacoes.length
    fireEvent.change(campo, { target: { value: '-7' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    await waitFor(() => expect(gravacoes.length).toBeGreaterThan(antes))
    expect(pv(gravacoes[gravacoes.length - 1]).atual).toBe(23)
    // O campo fechou e o número voltou.
    expect(screen.getByRole('button', { name: /PV: 23 de 45/ })).toBeTruthy()
  })

  it('"12/40" no campo grava atual E máximo de uma vez', async () => {
    await montar()
    fireEvent.click(screen.getByRole('button', { name: /PV: 30 de 45/ }))
    const campo = screen.getByRole('textbox', { name: /PV/ })
    const antes = gravacoes.length
    fireEvent.change(campo, { target: { value: '12/40' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    await waitFor(() => expect(gravacoes.length).toBeGreaterThan(antes))
    expect(pv(gravacoes[gravacoes.length - 1])).toMatchObject({ atual: 12, maximo: 40 })
  })

  it('Esc no campo cancela sem gravar; texto que não lê também não grava', async () => {
    await montar()
    fireEvent.click(screen.getByRole('button', { name: /PV: 30 de 45/ }))
    const campo = screen.getByRole('textbox', { name: /PV/ })
    fireEvent.change(campo, { target: { value: '5' } })
    fireEvent.keyDown(campo, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /PV: 30 de 45/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /PV: 30 de 45/ }))
    const outro = screen.getByRole('textbox', { name: /PV/ })
    fireEvent.change(outro, { target: { value: 'muito' } })
    fireEvent.keyDown(outro, { key: 'Enter' })
    expect(screen.getByRole('button', { name: /PV: 30 de 45/ })).toBeTruthy()
    expect(gravacoes.filter((g) => pv(g).atual !== 30)).toHaveLength(0)
  })

  it('cor de estado: nos 40% avisa e o preenchimento amarela; cor fixa é a cor de cheia', async () => {
    await montar()
    const pvEl = screen.getByRole('progressbar', { name: 'PV' }).parentElement!
    expect(pvEl.className).toContain('barra-normal')
    // PV 30 de 45 (67%): cheia o bastante, pintada com a cor dela (bordô pelo nome).
    expect(pvEl.style.getPropertyValue('--recurso-preenchido')).toBe('#800000')
    const sanEl = screen.getByRole('progressbar', { name: 'Sanidade' }).parentElement!
    // 10 de 40 = 25%: abaixo dos 40% é aviso, acima dos 15% ainda não é perigo.
    expect(sanEl.className).toContain('barra-aviso')
    expect(sanEl.className).toContain('barra-cor-fixa')
    expect(sanEl.style.getPropertyValue('--recurso-cor')).toBe('#800080')
    // A cor escolhida continua sendo a da barra; o preenchimento de agora é amarelo.
    expect(sanEl.style.getPropertyValue('--recurso-preenchido')).toBe('#ffff00')
  })

  it('uma linha fina por barra, e nada na tela quando não há recurso', async () => {
    await montar()
    expect(screen.getByRole('group', { name: 'Recursos' })).toBeTruthy()
    expect(screen.getByLabelText('Tirar de PV').closest('.barra-compacta')).toBeTruthy()
    cleanup()

    ;(globalThis as unknown as { api: unknown }).api = {
      ...apiFalsa(),
      notes: {
        get: vi.fn(() => Promise.resolve({ ...fichaComBarras(), recursos: [] })),
        save: vi.fn((dados: NotesData) => Promise.resolve(dados))
      }
    }
    const { container } = render(
      <ProfilesProvider>
        <SettingsProvider>
          <NotesProvider>
            <Tela />
          </NotesProvider>
        </SettingsProvider>
      </ProfilesProvider>
    )
    await waitFor(() => expect(screen.queryByRole('group')).toBeNull())
    expect(container.innerHTML).toBe('')
  })
})
