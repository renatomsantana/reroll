// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PROFILES, normalizeProfiles, type Profile, type ProfilesState } from '@shared/types/profile'
import { ProfilesProvider, useProfiles } from './ProfilesContext'

/**
 * O TETO DE PERSONAGENS — quinze (ver `MAX_PROFILES`).
 *
 * Duas regras, e a segunda é a que não é óbvia:
 *
 * 1. não se cria o décimo sexto;
 * 2. um arquivo que JÁ TENHA mais que quinze não perde ninguém. O teto vale na criação, nunca na
 *    leitura — um `profiles.json` restaurado de backup, ou escrito por uma versão em que o número
 *    era outro, não pode ter personagem apagado por causa de um limite que mudou depois.
 *
 * A segunda regra é o tipo de coisa que se implementa errado com a melhor das intenções: cortar a
 * lista na leitura parece "manter o limite", e é perda de dado silenciosa.
 */

const gravacoes: ProfilesState[] = []

function perfil(n: number): Profile {
  return { id: `p${n}`, name: `Personagem ${n}`, system: '', photo: null, createdAt: n }
}

function apiFalsa(estado: ProfilesState) {
  return {
    profiles: {
      get: vi.fn(() => Promise.resolve(structuredClone(estado))),
      save: vi.fn((proximo: ProfilesState) => {
        gravacoes.push(structuredClone(proximo))
        return Promise.resolve(proximo)
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
      <span data-testid="pode">{perfis.podeCriar ? 'sim' : 'nao'}</span>
    </div>
  )
}

async function montarCom(quantos: number) {
  const estado: ProfilesState = {
    profiles: Array.from({ length: quantos }, (_, i) => perfil(i + 1)),
    activeId: 'p1'
  }
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa(estado)
  render(
    <ProfilesProvider>
      <Sonda />
    </ProfilesProvider>
  )
  await waitFor(() => expect(screen.getByTestId('quantos').textContent).toBe(String(quantos)))
}

describe('teto de personagens', () => {
  beforeEach(() => {
    gravacoes.length = 0
    controle = null
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it(`com menos de ${MAX_PROFILES}, criar funciona`, async () => {
    await montarCom(MAX_PROFILES - 1)
    expect(screen.getByTestId('pode').textContent).toBe('sim')

    await act(async () => {
      controle?.create()
    })

    await waitFor(() => expect(screen.getByTestId('quantos').textContent).toBe(String(MAX_PROFILES)))
    expect(gravacoes.at(-1)?.profiles).toHaveLength(MAX_PROFILES)
  })

  it('no teto, criar não faz nada — e nada vai pro disco', async () => {
    await montarCom(MAX_PROFILES)
    expect(screen.getByTestId('pode').textContent).toBe('nao')

    await act(async () => {
      controle?.create()
    })

    expect(gravacoes).toHaveLength(0)
    expect(screen.getByTestId('quantos').textContent).toBe(String(MAX_PROFILES))
  })

  it('criar o último fecha a porta pro seguinte', async () => {
    await montarCom(MAX_PROFILES - 1)

    await act(async () => {
      controle?.create()
    })
    await waitFor(() => expect(screen.getByTestId('pode').textContent).toBe('nao'))

    const gravacoesAteAqui = gravacoes.length
    await act(async () => {
      controle?.create()
    })
    expect(gravacoes).toHaveLength(gravacoesAteAqui)
  })

  it('apagar um abre vaga de novo', async () => {
    await montarCom(MAX_PROFILES)
    expect(screen.getByTestId('pode').textContent).toBe('nao')

    await act(async () => {
      controle?.remove('p2')
    })
    await waitFor(() => expect(screen.getByTestId('pode').textContent).toBe('sim'))

    await act(async () => {
      controle?.create()
    })
    await waitFor(() => expect(screen.getByTestId('quantos').textContent).toBe(String(MAX_PROFILES)))
  })

  it('arquivo com MAIS que o teto não perde ninguém', async () => {
    /**
     * A regra que se implementa errado com boa intenção. Cortar a lista na leitura parece "fazer o
     * limite valer" e é perda de dado calada — e o caso real existe: um backup restaurado, ou um
     * arquivo escrito por uma versão em que o teto era outro.
     *
     * O certo é o que este teste fixa: todos continuam na lista, e o app só para de deixar criar.
     */
    const demais = MAX_PROFILES + 5
    await montarCom(demais)

    expect(screen.getByTestId('quantos').textContent).toBe(String(demais))
    expect(screen.getByTestId('pode').textContent).toBe('nao')
    // E nada foi regravado só por abrir — abrir o app não pode reescrever a lista de ninguém.
    expect(gravacoes).toHaveLength(0)
  })

  it('`normalizeProfiles` nunca corta a lista', async () => {
    // A mesma garantia no nível da função, sem React no meio.
    const demais = Array.from({ length: MAX_PROFILES + 3 }, (_, i) => perfil(i + 1))
    const saida = normalizeProfiles({ profiles: demais, activeId: 'p1' })
    expect(saida.profiles).toHaveLength(demais.length)
  })
})
