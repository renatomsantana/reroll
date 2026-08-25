// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesData } from '@shared/types/notes'
import { DEFAULT_NOTES } from '@shared/types/notes'
import { useNotes } from './useNotes'

/**
 * O DIÁRIO FUNCIONA? — o teste que faltava, e que existe porque o usuário relatou duas vezes que
 * "as anotações não estão funcionando" e "criar outros dias também não".
 *
 * Nenhum teste do projeto tocava neste caminho, e ele tem uma armadilha que a leitura não denuncia:
 * `useNotes` recusa gravar enquanto o conteúdo em memória não for comprovadamente do personagem
 * ABERTO (a guarda `prontoRef`, que existe pra impedir a ficha de um sobrescrever a do outro). Se
 * essa guarda nunca liberar, o resultado na tela é exatamente o relatado — digitar não faz nada,
 * criar dia não faz nada, e não aparece erro nenhum, porque do ponto de vista do código está tudo
 * "protegido".
 *
 * Por isso o teste é de COMPORTAMENTO e não de unidade: ele monta o hook de verdade, com o
 * `ProfilesContext` de verdade, e pergunta a única coisa que interessa — o que eu digito chega ao
 * disco?
 */

const notesNoDisco = { valor: DEFAULT_NOTES }
const salvos: NotesData[] = []

/** O `activeId` que o processo principal diz ter — o mesmo que a lista de perfis traz. */
const ID_DO_PERSONAGEM = '3f1a7c4e-0000-4000-8000-000000000001'

function apiFalsa() {
  return {
    notes: {
      get: vi.fn(() => Promise.resolve(structuredClone(notesNoDisco.valor))),
      save: vi.fn((notes: NotesData) => {
        salvos.push(structuredClone(notes))
        notesNoDisco.valor = structuredClone(notes)
        return Promise.resolve(notes)
      })
    },
    profiles: {
      get: vi.fn(() =>
        Promise.resolve({
          profiles: [
            { id: ID_DO_PERSONAGEM, name: 'Matais', system: 'Ordem Paranormal', photo: null, createdAt: 1 }
          ],
          activeId: ID_DO_PERSONAGEM
        })
      ),
      save: vi.fn((estado: unknown) => Promise.resolve(estado)),
      pickPhoto: vi.fn(() => Promise.resolve(null))
    }
  }
}

/** Expõe o hook pra fora, pra o teste poder chamar as funções dele. */
type Controle = ReturnType<typeof useNotes>
let controle: Controle | null = null

function Sonda() {
  const notas = useNotes()
  controle = notas
  useEffect(() => {
    controle = notas
  })
  const pagina = notas.notes.pages[notas.notes.currentPage]
  return (
    <div>
      <span data-testid="pronto">{notas.loadedFor ?? 'nada'}</span>
      <span data-testid="paginas">{notas.notes.pages.length}</span>
      <span data-testid="texto">{pagina?.text ?? 'SEM PÁGINA'}</span>
    </div>
  )
}

/** Monta a sonda dentro do provedor de perfis de verdade — é ele que decide o `activeId`. */
async function montar() {
  const { ProfilesProvider } = await import('@renderer/settings/ProfilesContext')
  const { NotesProvider } = await import('./useNotes')
  render(
    <ProfilesProvider>
      <NotesProvider>
        <Sonda />
      </NotesProvider>
    </ProfilesProvider>
  )
  // Espera a lista de perfis chegar do "disco" e as anotações carregarem para ELE.
  await waitFor(() => {
    expect(screen.getByTestId('pronto').textContent).toBe(ID_DO_PERSONAGEM)
  })
}

describe('escrever no diário chega ao disco', () => {
  beforeEach(() => {
    salvos.length = 0
    notesNoDisco.valor = { ...DEFAULT_NOTES }
    controle = null
    ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
  })

  afterEach(() => {
    /**
     * `cleanup` à mão: a limpeza automática da Testing Library só se registra sozinha quando o
     * framework de teste expõe `afterEach` no escopo global, e o vitest deste projeto roda sem
     * globais. Sem ela, a árvore de um teste fica no documento e o `getByTestId` do próximo
     * encontra DOIS elementos e estoura — que foi exatamente o que aconteceu na primeira execução
     * deste arquivo, e que por um momento pareceu defeito do app.
     */
    cleanup()
    vi.restoreAllMocks()
  })

  it('carrega e libera a edição para o personagem aberto', async () => {
    await montar()
    // A guarda de gravação é `loadedFor === activeId`. Enquanto ela não fechar, TUDO é descartado
    // em silêncio — é a causa raiz de "digitar não faz nada".
    expect(screen.getByTestId('pronto').textContent).toBe(ID_DO_PERSONAGEM)
  })

  it('o texto digitado é gravado', async () => {
    await montar()

    await act(async () => {
      controle?.updatePage({ text: 'O agente entrou no porão.' })
    })

    await waitFor(() => expect(salvos.length).toBeGreaterThan(0))
    expect(salvos.at(-1)?.pages[0].text).toBe('O agente entrou no porão.')
    expect(screen.getByTestId('texto').textContent).toBe('O agente entrou no porão.')
  })

  it('CRIAR OUTRO DIA acrescenta a página e já abre nela', async () => {
    await montar()

    await act(async () => {
      controle?.addPage()
    })

    await waitFor(() => expect(screen.getByTestId('paginas').textContent).toBe('2'))
    expect(salvos.at(-1)?.pages).toHaveLength(2)
    // Abriu no dia novo, e não continuou no anterior — virar a página é o gesto inteiro.
    expect(salvos.at(-1)?.currentPage).toBe(1)
  })

  it('o dia novo aceita texto próprio, sem misturar com o anterior', async () => {
    await montar()

    await act(async () => {
      controle?.updatePage({ text: 'Dia um.' })
    })
    await act(async () => {
      controle?.addPage()
    })
    await act(async () => {
      controle?.updatePage({ text: 'Dia dois.' })
    })

    await waitFor(() => expect(salvos.at(-1)?.pages).toHaveLength(2))
    expect(salvos.at(-1)?.pages[0].text).toBe('Dia um.')
    expect(salvos.at(-1)?.pages[1].text).toBe('Dia dois.')
  })

  it('a formatação da barra também é gravada', async () => {
    await montar()

    await act(async () => {
      controle?.updateField('bold', true)
    })

    await waitFor(() => expect(salvos.at(-1)?.bold).toBe(true))
  })

  it('apagar o último dia deixa um vazio, e não zero — a tela precisa de página', async () => {
    await montar()

    await act(async () => {
      controle?.removePage()
    })

    await waitFor(() => expect(salvos.length).toBeGreaterThan(0))
    expect(salvos.at(-1)?.pages).toHaveLength(1)
    expect(salvos.at(-1)?.currentPage).toBe(0)
  })
})
