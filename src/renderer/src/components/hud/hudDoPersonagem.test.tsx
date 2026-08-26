// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '@shared/types/profile'
import type { RecursoVital } from '@shared/types/recursoVital'
import type { Condicao, EstadoDoHud } from '@shared/types/hud'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { HudDoPersonagem } from './HudDoPersonagem'

/**
 * O HUD (spec §3.6) no que grava: encolher, esconder e voltar, ligar/desligar/acrescentar/remover
 * condição, e o ENCAIXE no canto ao soltar o arrasto — com a geometria da cena falsificada, porque
 * o jsdom não mede nada.
 */
const apiFalsa = {
  profiles: {
    get: vi.fn(() => Promise.resolve({ profiles: [{ id: 'p1', name: 'Matias', system: 'Ordem Paranormal', photo: null, createdAt: 1 }], activeId: 'p1' })),
    save: vi.fn((estado: unknown) => Promise.resolve(estado)),
    pickPhoto: vi.fn(() => Promise.resolve(null))
  },
  windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) }
}

const PERFIL: Profile = { id: 'p1', name: 'Matias', system: 'Ordem Paranormal', photo: null, createdAt: 1 }
const RECURSOS: RecursoVital[] = [{ id: 'pv', nome: 'PV', atual: 12, maximo: 45 }]
const CONDICOES: Condicao[] = [{ id: 'm', nome: 'Machucado', ativa: false }]
const HUD: EstadoDoHud = { canto: 'se', visivel: true, mini: false }

function montar(hud: EstadoDoHud = HUD) {
  const acoes = { onChangeRecursos: vi.fn(), onChangeCondicoes: vi.fn(), onChangeHud: vi.fn(), onRest: vi.fn() }
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa
  render(
    <ProfilesProvider>
      <SettingsProvider>
        <div className="cena">
          <HudDoPersonagem profile={PERFIL} fallbackName="Personagem 1" recursos={RECURSOS} condicoes={CONDICOES} hud={hud} {...acoes} />
        </div>
      </SettingsProvider>
    </ProfilesProvider>
  )
  return acoes
}

afterEach(cleanup)

describe('o HUD do personagem', () => {
  it('mostra nome, barra e condição; a inicial faz de retrato sem foto', () => {
    montar()
    expect(screen.getByText('Matias')).toBeTruthy()
    expect(screen.getByText('M')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'PV' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Machucado — desligada/ })).toBeTruthy()
  })

  it('encolher, esconder e mostrar de novo gravam o estado', () => {
    const acoes = montar()
    fireEvent.click(screen.getByRole('button', { name: /Encolher/ }))
    expect(acoes.onChangeHud).toHaveBeenLastCalledWith({ ...HUD, mini: true })
    fireEvent.click(screen.getByRole('button', { name: 'Esconder o HUD' }))
    expect(acoes.onChangeHud).toHaveBeenLastCalledWith({ ...HUD, visivel: false })
    cleanup()

    const escondido = montar({ ...HUD, visivel: false })
    expect(screen.queryByText('Matias')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar o HUD do personagem' }))
    expect(escondido.onChangeHud).toHaveBeenLastCalledWith({ ...HUD, visivel: true })
  })

  it('a condição liga com um clique, some pelo ×, e o "+" acrescenta outra', () => {
    const acoes = montar()
    fireEvent.click(screen.getByRole('button', { name: /Machucado — desligada/ }))
    expect(acoes.onChangeCondicoes).toHaveBeenLastCalledWith([{ id: 'm', nome: 'Machucado', ativa: true }])

    fireEvent.click(screen.getByRole('button', { name: 'Remover a condição Machucado' }))
    expect(acoes.onChangeCondicoes).toHaveBeenLastCalledWith([])

    fireEvent.click(screen.getByTitle('Adicionar condição'))
    const campo = screen.getByRole('textbox', { name: 'Adicionar condição' })
    fireEvent.change(campo, { target: { value: 'Caído' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    const ultima = acoes.onChangeCondicoes.mock.calls.at(-1)![0] as Condicao[]
    expect(ultima.map((c) => c.nome)).toEqual(['Machucado', 'Caído'])
    expect(ultima[1].ativa).toBe(false)
  })

  it('soltar o arrasto encaixa no canto mais perto do centro do cartão; um clique curto não muda nada', () => {
    const acoes = montar()
    const hud = screen.getByRole('region', { name: 'Personagem' })
    const cena = hud.parentElement!
    cena.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    const cabecalho = hud.querySelector('.hud-cabecalho')!

    // Arrastou pra cima e pra esquerda: o CABEÇALHO (o que se segura) ficou no quadrante noroeste —
    // mesmo com o cartão alto demais pra ter o centro lá (12 barras passam da metade da cena).
    hud.getBoundingClientRect = () => ({ left: 20, top: 20, width: 236, height: 450, right: 256, bottom: 470, x: 20, y: 20, toJSON: () => ({}) })
    ;(cabecalho as HTMLElement).getBoundingClientRect = () => ({ left: 20, top: 20, width: 236, height: 50, right: 256, bottom: 70, x: 20, y: 20, toJSON: () => ({}) })
    // O mover e o soltar chegam pela JANELA (o mouse sai do cabeçalho em todo arrasto rápido).
    fireEvent.pointerDown(cabecalho, { button: 0, clientX: 700, clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 80, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 100, clientY: 80, pointerId: 1 })
    expect(acoes.onChangeHud).toHaveBeenLastCalledWith({ ...HUD, canto: 'nw' })

    acoes.onChangeHud.mockClear()
    fireEvent.pointerDown(cabecalho, { button: 0, clientX: 700, clientY: 500, pointerId: 2 })
    fireEvent.pointerMove(window, { clientX: 702, clientY: 501, pointerId: 2 })
    fireEvent.pointerUp(window, { clientX: 702, clientY: 501, pointerId: 2 })
    expect(acoes.onChangeHud).not.toHaveBeenCalled()
  })
})
