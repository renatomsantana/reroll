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
 * Estado das anotações e a gravação. Toda mudança grava o arquivo inteiro: é texto curto, e o
 * alternativo (guardar na memória e gravar ao sair) já custou dados perdidos em app deste tipo.
 *
 * As funções de página existem aqui, e não na tela, porque todas mexem em `pages` E em `currentPage`
 * ao mesmo tempo — apagar um dia tem que reposicionar em quem sobrou, criar tem que pular pra ele.
 *
 * É UMA INSTÂNCIA SÓ por app, servida pelo `NotesProvider`, e isso não era assim: a aba Ficha e a aba
 * Anotações chamavam este hook cada uma por conta, duas cópias do mesmo arquivo, e funcionava porque
 * nunca estavam montadas ao mesmo tempo. As barras de recurso acabaram com isso — elas ficam na tela
 * de rolagem, sempre montada, e gravam a cada clique: com uma cópia própria, o clique gravaria as
 * seções que ela conhecia por cima do que a pessoa acabou de escrever.
 */
export function useNotesState() {
  const [notes, setNotes] = useState<NotesData>(() => normalizeNotes(DEFAULT_NOTES))
  const [loading, setLoading] = useState(true)
  /**
   * De QUAL personagem são as anotações que estão em `notes` neste instante. Entre trocar de personagem
   * e a leitura do disco voltar existe um intervalo em que `notes` ainda é do anterior, e quem tomar
   * decisão baseada nelas nesse intervalo decide errado — foi assim que o nome do personagem antigo
   * vazou pro recém-criado. Mais honesto que um `loading` booleano: diz de quem é o conteúdo.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)
  /**
   * A LEITURA falhou. Precisa ser dito, e não só registrado no console, porque a consequência é a ficha
   * ficar somente-leitura: sem saber o que há no arquivo, gravar por cima seria trocar o conteúdo real
   * pelo padrão vazio. Sem aviso, isso apareceria como "não consigo digitar nada", que é exatamente uma
   * das coisas que ele já relatou.
   */
  const [loadError, setLoadError] = useState(false)
  const { activeId } = useProfiles()
  /**
   * Pedido explícito de RELER do disco, sem trocar de personagem. Existe pela importação de ficha em
   * cima do personagem que JÁ ESTÁ aberto: o processo principal grava a ficha nova e o `activeId` não
   * muda, então o efeito abaixo não dispara e as anotações em memória continuam as de ANTES da
   * importação — a próxima tecla na Ficha gravaria essas por cima das novas.
   *
   * Um contador, e não um `reload()` solto, pra passar pelo MESMO efeito, e pela mesma trava de resposta
   * atrasada, que a troca de personagem usa.
   */
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((atual) => atual + 1), [])

  /**
   * Recarrega quando o PERSONAGEM muda: anotações e presets moram na pasta do perfil aberto (ver
   * `ProfilesRepository.activeDirectory`), então trocar de perfil sem reler deixaria a tela mostrando
   * a ficha do personagem anterior — e, pior, a primeira digitação gravaria esse conteúdo velho por
   * cima do arquivo do novo.
   */
  useEffect(() => {
    /**
     * A resposta que chega DEPOIS de já ter trocado de personagem é descartada. Trocar duas vezes rápido
     * deixa duas leituras no ar, e elas não voltam necessariamente na ordem em que saíram: sem esta
     * trava, a leitura do personagem ANTERIOR pode chegar por último e ficar na tela, e daí em diante
     * tudo o que for digitado grava a ficha do anterior na pasta do atual.
     */
    let atual = true
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
        if (atual) setLoading(false)
      })
    return () => {
      atual = false
    }
  }, [activeId, versao])

  /**
   * O conteúdo em `notes` é do personagem ABERTO? Enquanto não for, gravar é destruir.
   *
   * Entre trocar de personagem e a leitura voltar do disco, a tela continua mostrando a ficha do
   * ANTERIOR e os campos continuam editáveis: uma tecla digitada nesse intervalo mandava o conteúdo
   * velho pro `notes.save`, que escreve na pasta do personagem ATIVO. É a janela curta da mesma perda
   * que ele relatou ("quando troquei de Matais para Rodrigo todas as informações sumiram").
   *
   * Num ref porque `update` é estável e precisa ler o valor do momento da digitação.
   */
  const prontoRef = useRef(false)
  prontoRef.current = loadedFor === activeId

  /** Aplica a mudança e grava. Recebe função pra sempre partir do estado ATUAL, não do que a tela viu. */
  const update = useCallback((change: (previous: NotesData) => NotesData) => {
    // Ficha ainda não carregada pra este personagem: ver `prontoRef`. Melhor perder uma tecla que a ficha.
    if (!prontoRef.current) return
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
