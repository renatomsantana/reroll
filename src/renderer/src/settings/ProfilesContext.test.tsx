// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfilesState } from '@shared/types/profile'
import { ProfilesProvider, useProfiles } from './ProfilesContext'

/**
 * A LISTA DE PERSONAGENS NÃO PODE SER GRAVADA ANTES DE SER LIDA.
 *
 * Este arquivo existe por causa de um defeito medido na máquina do usuário: quatorze pastas de
 * personagem em `%APPDATA%/reroll/profiles/` e o `profiles.json` listando UMA. Treze personagens
 * com anotações e presets continuavam no disco, inteiros, e não apareciam mais em canto nenhum do
 * app.
 *
 * A causa é sutil e o teste é simples. O provedor começa com uma lista INVENTADA, pra a tela ter o
 * que desenhar no primeiro quadro. Enquanto a leitura do disco não voltava, qualquer gravação
 * mandava essa lista fictícia pro arquivo — e `profiles.json` é o ÍNDICE: perdê-lo não perde um
 * personagem, perde todos.
 *
 * A janela é de milissegundos, e não é teórica: a aba Ficha copia o nome do personagem das
 * anotações pro perfil assim que os dois batem, e no primeiro quadro eles batem — as anotações vêm
 * do processo principal, que sabe qual é o perfil ativo de verdade, enquanto a lista aqui ainda é a
 * inventada.
 */

const REAIS: ProfilesState = {
  profiles: [
    { id: 'aaaa-1111', name: 'Matais', system: 'Ordem Paranormal', photo: null, createdAt: 1 },
    { id: 'bbbb-2222', name: 'Rodrigo', system: 'D&D 5e', photo: null, createdAt: 2 },
    { id: 'cccc-3333', name: 'Marina', system: 'Kids on Bikes', photo: null, createdAt: 3 }
  ],
  activeId: 'bbbb-2222'
}

const gravacoes: ProfilesState[] = []
let resolverLeitura: ((estado: ProfilesState) => void) | null = null
let rejeitarLeitura: ((causa: Error) => void) | null = null

function apiFalsa() {
  return {
    profiles: {
      get: vi.fn(
        () =>
          new Promise<ProfilesState>((resolve, reject) => {
            resolverLeitura = resolve
            rejeitarLeitura = reject
          })
      ),
      save: vi.fn((estado: ProfilesState) => {
        gravacoes.push(structuredClone(estado))
        return Promise.resolve(estado)
      }),
      pickPhoto: vi.fn(() => Promise.resolve(null))
    }
  }
}

type Controle = ReturnType<typeof useProfiles>
let controle: Controle | null = null

function Sonda() {
  const perfis = useProfiles()
  controle = perfis
  return (
    <div>
      <span data-testid="quantos">{perfis.profiles.length}</span>
      <span data-testid="ativo">{perfis.activeId}</span>
    </div>
  )
}

function montar() {
  render(
    <ProfilesProvider>
      <Sonda />
    </ProfilesProvider>
  )
}

/** Entrega a lista de verdade e espera a tela alcançá-la. */
async function leituraChega() {
  await act(async () => {
    resolverLeitura?.(structuredClone(REAIS))
  })
  await waitFor(() => expect(screen.getByTestId('quantos').textContent).toBe('3'))
}

describe('antes de a lista chegar do disco', () => {
  beforeEach(() => {
    gravacoes.length = 0
    controle = null
    resolverLeitura = null
    rejeitarLeitura = null
    ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renomear um personagem NÃO grava a lista inventada por cima da real', async () => {
    montar()

    // A tela já mostra alguma coisa — a lista fictícia, com um personagem só.
    expect(screen.getByTestId('quantos').textContent).toBe('1')

    await act(async () => {
      controle?.update(controle.activeId, { name: 'Nome vindo das anotações' })
    })

    // NADA foi ao disco. É a linha que separa "perdi uma edição" de "perdi treze personagens".
    expect(gravacoes).toHaveLength(0)

    await leituraChega()
    expect(gravacoes).toHaveLength(0)
    expect(screen.getByTestId('ativo').textContent).toBe('bbbb-2222')
  })

  it('criar personagem antes da leitura também não grava — ele reescreveria a lista inteira', async () => {
    montar()

    await act(async () => {
      controle?.create()
    })

    expect(gravacoes).toHaveLength(0)
    await leituraChega()
    expect(screen.getByTestId('quantos').textContent).toBe('3')
  })

  it('trocar de personagem antes da leitura não grava', async () => {
    montar()

    await act(async () => {
      controle?.select('qualquer-outro')
    })

    expect(gravacoes).toHaveLength(0)
    await leituraChega()
  })
})

describe('quando a leitura FALHA', () => {
  beforeEach(() => {
    gravacoes.length = 0
    controle = null
    ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('a lista fica somente leitura pela sessão inteira', async () => {
    /**
     * O instinto é liberar a edição pra o app "funcionar". É o instinto que apagava tudo: com a
     * leitura falhada, o que está em memória é a lista inventada, e gravá-la é substituir o índice
     * de personagens por um personagem em branco. Perder uma sessão é recuperável; perder o índice
     * não é.
     */
    montar()

    await act(async () => {
      rejeitarLeitura?.(new Error('disco inacessível'))
    })

    await act(async () => {
      controle?.update(controle.activeId, { name: 'não deve gravar' })
      controle?.create()
    })

    expect(gravacoes).toHaveLength(0)
  })

  it('um `reload` bem-sucedido devolve a permissão de gravar', async () => {
    montar()
    await act(async () => {
      rejeitarLeitura?.(new Error('disco inacessível'))
    })

    // A segunda tentativa funciona — e é ela que libera a edição de novo.
    const api = (globalThis as unknown as { api: { profiles: { get: ReturnType<typeof vi.fn> } } }).api
    api.profiles.get.mockResolvedValue(structuredClone(REAIS))

    await act(async () => {
      await controle?.reload()
    })
    await waitFor(() => expect(screen.getByTestId('quantos').textContent).toBe('3'))

    await act(async () => {
      controle?.update('aaaa-1111', { name: 'Matais Segundo' })
    })

    expect(gravacoes).toHaveLength(1)
    expect(gravacoes[0].profiles.map((p) => p.name)).toContain('Matais Segundo')
    // E os outros dois continuam lá — a gravação preserva a lista, não a substitui.
    expect(gravacoes[0].profiles).toHaveLength(3)
  })
})

describe('depois de a lista chegar', () => {
  beforeEach(() => {
    gravacoes.length = 0
    controle = null
    ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('editar grava normalmente, com a lista inteira preservada', async () => {
    montar()
    await leituraChega()

    await act(async () => {
      controle?.update('cccc-3333', { system: 'Tormenta' })
    })

    await waitFor(() => expect(gravacoes).toHaveLength(1))
    expect(gravacoes[0].profiles).toHaveLength(3)
    expect(gravacoes[0].profiles.find((p) => p.id === 'cccc-3333')?.system).toBe('Tormenta')
  })
})
