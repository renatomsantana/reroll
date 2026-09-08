import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useProfiles } from '@renderer/settings/ProfilesContext'
import {
  createNotesPage,
  DEFAULT_NOTES,
  normalizeNotes,
  type NotesData,
  type NotesPage
} from '@shared/types/notes'

/**
 * Estado das anotações e a gravação. Toda mudança grava o arquivo inteiro: é texto curto, e guardar
 * na memória pra gravar ao sair já custou dados perdidos em app deste tipo. As funções de página
 * moram aqui, e não na tela, porque todas mexem em `pages` E em `currentPage` ao mesmo tempo.
 *
 * É UMA INSTÂNCIA SÓ por app, servida pelo `NotesProvider`. Não era: a aba Ficha e a aba Anotações
 * chamavam o hook cada uma por conta, e funcionava porque nunca estavam montadas juntas. As barras
 * de recurso acabaram com isso — elas ficam na tela de rolagem, sempre montada, e gravam a cada
 * clique, então a cópia delas escreveria por cima do que a pessoa acabou de digitar.
 */
export function useNotesState() {
  const [notes, setNotes] = useState<NotesData>(() => normalizeNotes(DEFAULT_NOTES))
  const [loading, setLoading] = useState(true)
  /**
   * De QUAL personagem são as anotações que estão em `notes` agora. Entre trocar de personagem e a
   * leitura voltar, `notes` ainda é do anterior, e quem decidir por elas nesse intervalo decide
   * errado — foi assim que o nome do personagem antigo vazou pro recém-criado.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  /**
   * A LEITURA falhou. Precisa ser dito na tela, e não só no console, porque a consequência é a ficha
   * ficar somente-leitura: sem saber o que há no arquivo, gravar por cima trocaria o conteúdo real
   * pelo padrão vazio. Sem aviso, isso vira "não consigo digitar nada".
   */
  const [loadError, setLoadError] = useState(false)
  const { activeId } = useProfiles()
  /**
   * Pedido explícito de RELER do disco, sem trocar de personagem: a importação de ficha em cima do
   * personagem que JÁ ESTÁ aberto grava pelo processo principal sem mudar o `activeId`, então o
   * efeito abaixo não dispararia e a próxima tecla gravaria as anotações de antes por cima.
   *
   * Um contador, e não um `reload()` solto, pra passar pelo MESMO efeito e pela mesma trava de
   * resposta atrasada que a troca de personagem usa.
   */
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((atual) => atual + 1), [])
  /**
   * Tem leitura EM VOO agora? `loadedFor === activeId` não cobre a releitura pedida por
   * `recarregar()`: ali o personagem é o mesmo, então a marca continua fechada enquanto o disco ainda
   * está sendo lido, e uma tecla nesse intervalo gravaria as anotações de ANTES da importação por
   * cima das novas. Num ref, e não em estado, pra não piscar o HUD a cada releitura.
   */
  const lendoRef = useRef(false)

  /**
   * Recarrega quando o PERSONAGEM muda: anotações e presets moram na pasta do perfil aberto, então
   * trocar sem reler deixaria a ficha do anterior na tela — e a primeira digitação a gravaria por
   * cima do arquivo do novo.
   */
  useEffect(() => {
    /**
     * A resposta que chega DEPOIS de já ter trocado de personagem é descartada: trocar duas vezes
     * rápido deixa duas leituras no ar, e elas não voltam na ordem em que saíram. Sem esta trava, a
     * leitura do ANTERIOR pode chegar por último e daí em diante tudo grava a ficha errada.
     */
    let atual = true
    lendoRef.current = true
    setLoading(true)
    window.api.notes
      .get()
      .then((loaded) => {
        if (!atual) return
        setNotes(normalizeNotes({ ...DEFAULT_NOTES, ...loaded }))
        setLoadedFor(activeId)
        setLoadError(false)
      })
      .catch((error: unknown) => {
        if (!atual) return
        console.error('Falha ao carregar anotações:', error)
        setLoadError(true)
      })
      .finally(() => {
        if (!atual) return
        lendoRef.current = false
        setLoading(false)
      })
    return () => {
      atual = false
    }
  }, [activeId, versao])

  /**
   * O conteúdo em `notes` é do personagem ABERTO? Enquanto não for, gravar é destruir: entre trocar
   * de personagem e a leitura voltar, a tela mostra a ficha do ANTERIOR e os campos continuam
   * editáveis, e uma tecla mandava esse conteúdo velho pro `notes.save`, que escreve na pasta do
   * personagem ATIVO ("quando troquei de Matais para Rodrigo todas as informações sumiram").
   *
   * Num ref porque `update` é estável e precisa ler o valor do momento da digitação.
   */
  const prontoRef = useRef(false)
  prontoRef.current = loadedFor === activeId

  /** Aplica a mudança e grava. Recebe função pra sempre partir do estado ATUAL, não do que a tela viu. */
  const update = useCallback((change: (previous: NotesData) => NotesData) => {
    // Ficha ainda não carregada pra este personagem, ou sendo relida agora: ver `prontoRef` e
    // `lendoRef`. Melhor perder uma tecla que a ficha.
    if (!prontoRef.current || lendoRef.current) return
    setNotes((previous) => {
      const next = change(previous)
      window.api.notes
        .save(next)
        .then(() => setSaveError(false))
        .catch((error: unknown) => {
          console.error('Falha ao salvar anotações:', error)
          setSaveError(true)
        })
      return next
    })
  }, [])

  const updateField = useCallback(
    <K extends keyof NotesData>(key: K, value: NotesData[K]) => {
      update((previous) => ({ ...previous, [key]: value }))
    },
    [update]
  )

  /** Muda um campo da página ABERTA (texto ou nome do dia). */
  const updatePage = useCallback(
    (change: Partial<Pick<NotesPage, 'title' | 'text'>>) => {
      update((previous) => ({
        ...previous,
        pages: previous.pages.map((page, index) =>
          index === previous.currentPage ? { ...page, ...change } : page
        )
      }))
    },
    [update]
  )

  const goToPage = useCallback(
    (index: number) => {
      update((previous) => ({
        ...previous,
        currentPage: Math.min(Math.max(0, index), previous.pages.length - 1)
      }))
    },
    [update]
  )

  /** Cria o dia seguinte e já abre nele — virar a página e continuar escrevendo é o gesto inteiro. */
  const addPage = useCallback(() => {
    update((previous) => ({
      ...previous,
      pages: [...previous.pages, createNotesPage()],
      currentPage: previous.pages.length
    }))
  }, [update])

  /**
   * Apaga o dia aberto. Nunca deixa o diário sem nenhuma página: apagar a última esvazia a página em
   * vez de remover, senão a tela ficaria sem nada pra mostrar e sem botão pra criar.
   */
  const removePage = useCallback(() => {
    update((previous) => {
      if (previous.pages.length <= 1) {
        return { ...previous, pages: [createNotesPage()], currentPage: 0 }
      }
      const pages = previous.pages.filter((_, index) => index !== previous.currentPage)
      return { ...previous, pages, currentPage: Math.min(previous.currentPage, pages.length - 1) }
    })
  }, [update])

  return {
    notes,
    loading,
    loadedFor,
    saveError,
    loadError,
    recarregar,
    update,
    updateField,
    updatePage,
    goToPage,
    addPage,
    removePage
  }
}

export type NotesControl = ReturnType<typeof useNotesState>

const NotesContext = createContext<NotesControl | null>(null)

/** A instância única das anotações do personagem aberto — ver o cabeçalho de `useNotesState`. */
export function NotesProvider({ children }: { children: ReactNode }) {
  const valor = useNotesState()
  return createElement(NotesContext.Provider, { value: valor }, children)
}

export function useNotes(): NotesControl {
  const contexto = useContext(NotesContext)
  if (!contexto) {
    throw new Error('useNotes precisa estar dentro de um NotesProvider — ver hooks/useNotes.ts.')
  }
  return contexto
}
