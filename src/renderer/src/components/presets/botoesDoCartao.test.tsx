// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Preset } from '@shared/types/preset'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { PresetList } from './PresetList'

/**
 * OS BOTÕES DO CARTÃO E DA LISTA DE PRESETS — a outra metade do "checa todos".
 *
 * O que se confere aqui é o CONTRATO de cada botão: quem ele chama, com qual preset, e quando ele
 * fica travado. Travamento errado é a classe de defeito mais fácil de passar despercebida, porque um
 * botão que não responde parece "clique que não pegou" — e a pessoa clica de novo, não reporta.
 */

const apiFalsa = {
  profiles: {
    get: vi.fn(() =>
      Promise.resolve({ profiles: [{ id: 'p1', name: 'Teste', system: '', photo: null, createdAt: 1 }], activeId: 'p1' })
    ),
    save: vi.fn((estado: unknown) => Promise.resolve(estado)),
    pickPhoto: vi.fn(() => Promise.resolve(null))
  },
  windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) }
}

function preset(id: string, name: string): Preset {
  return {
    id,
    name,
    icon: '⚔️',
    expression: { groups: [{ count: 1, sides: 20 }], modifiers: [] },
    createdAt: 1,
    updatedAt: 1
  } satisfies Preset
}

const DOIS = [preset('a', 'Espada'), preset('b', 'Bola de fogo')]

function montar(props: Partial<Parameters<typeof PresetList>[0]> = {}) {
  const acoes = {
    onRoll: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCreate: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn()
  }
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa
  render(
    <ProfilesProvider>
      <SettingsProvider>
        <PresetList presets={DOIS} {...acoes} {...props} />
      </SettingsProvider>
    </ProfilesProvider>
  )
  return acoes
}

const desabilitado = (elemento: HTMLElement): boolean => (elemento as HTMLButtonElement).disabled

afterEach(cleanup)

describe('botões do cartão de preset', () => {
  it('clicar no cartão rola AQUELE preset', () => {
    const acoes = montar()
    fireEvent.click(screen.getByText('Bola de fogo'))
    expect(acoes.onRoll).toHaveBeenCalledTimes(1)
    expect(acoes.onRoll.mock.calls[0][0].id).toBe('b')
  })

  it('o lápis e o ✕ mandam o preset da PRÓPRIA linha', () => {
    const acoes = montar()
    // Segundo cartão: se algum dia a lista passar o índice errado, é aqui que aparece.
    fireEvent.click(screen.getAllByLabelText('Editar')[1])
    fireEvent.click(screen.getAllByLabelText('Excluir')[1])
    expect(acoes.onEdit.mock.calls[0][0].id).toBe('b')
    expect(acoes.onDelete.mock.calls[0][0].id).toBe('b')
  })

  it('durante uma rolagem, editar e excluir travam', () => {
    montar({ disabled: true })
    expect(desabilitado(screen.getAllByLabelText('Editar')[0])).toBe(true)
    expect(desabilitado(screen.getAllByLabelText('Excluir')[0])).toBe(true)
  })

  /**
   * Rolar é o único que fica LIVRE durante a rolagem na bandeja (pedido do usuário: "que aconteça a
   * qualquer momento"), e travado só na torre, onde os dados saem em fila e cortar no meio deixa
   * dado preso. É a distinção que `rollDisabled` existe pra fazer — se ela se perder, ou o preset
   * para de responder na bandeja, ou volta a travar a fila da torre.
   */
  it('rolar continua livre com editar travado (o caso da bandeja)', () => {
    const acoes = montar({ disabled: true, rollDisabled: false })
    const cartao = screen.getByText('Espada').closest('button') as HTMLButtonElement
    expect(cartao.disabled).toBe(false)
    fireEvent.click(cartao)
    expect(acoes.onRoll).toHaveBeenCalledTimes(1)
  })

  it('na torre, rolar trava junto', () => {
    montar({ disabled: true, rollDisabled: true })
    expect((screen.getByText('Espada').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('botões do cabeçalho da lista', () => {
  it('Novo preset, Importar e Exportar chamam cada um o seu', () => {
    const acoes = montar()
    fireEvent.click(screen.getByText('+ Novo preset'))
    fireEvent.click(screen.getByText('Importar'))
    fireEvent.click(screen.getByText('Exportar'))
    expect(acoes.onCreate).toHaveBeenCalledTimes(1)
    expect(acoes.onImport).toHaveBeenCalledTimes(1)
    expect(acoes.onExport).toHaveBeenCalledTimes(1)
  })

  it('sem preset nenhum: Exportar trava, Importar e Novo continuam vivos', () => {
    const acoes = {
      onRoll: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
      onCreate: vi.fn(), onExport: vi.fn(), onImport: vi.fn()
    }
    ;(globalThis as unknown as { api: unknown }).api = apiFalsa
    render(
      <ProfilesProvider>
        <SettingsProvider>
          <PresetList presets={[]} {...acoes} />
        </SettingsProvider>
      </ProfilesProvider>
    )
    // Exportar arquivo vazio é um arquivo que ninguém consegue importar de volta com sentido.
    expect(desabilitado(screen.getByText('Exportar'))).toBe(true)
    expect(desabilitado(screen.getByText('Importar'))).toBe(false)
    expect(desabilitado(screen.getByText('+ Novo preset'))).toBe(false)
  })

  /**
   * O cabeçalho NÃO trava durante a rolagem: `disabled` é do cartão (editar/excluir), e criar ou
   * importar um preset enquanto os dados rolam não mexe em nada que esteja em curso. Se um dia
   * alguém propagar o `disabled` pra cá "por simetria", este teste explica por que não.
   */
  it('o cabeçalho segue vivo durante uma rolagem', () => {
    montar({ disabled: true, rollDisabled: true })
    expect(desabilitado(screen.getByText('+ Novo preset'))).toBe(false)
    expect(desabilitado(screen.getByText('Importar'))).toBe(false)
  })
})
