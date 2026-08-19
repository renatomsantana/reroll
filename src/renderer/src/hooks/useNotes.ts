import { useCallback, useEffect, useState } from 'react'
import { useProfiles } from '@renderer/settings/ProfilesContext'
import {
  createNotesPage,
  DEFAULT_NOTES,
  normalizeNotes,
  type NotesData,
  type NotesPage
} from '@shared/types/notes'

/**
 * Estado das anotações + gravação. Toda mudança grava o arquivo inteiro — é texto curto, e o
 * alternativo (guardar na memória e gravar ao sair) já custou dados perdidos em app deste tipo.
 *
 * As funções de página existem aqui, e não na tela, porque todas elas mexem em `pages` E em
 * `currentPage` ao mesmo tempo: apagar um dia tem que reposicionar em quem sobrou, criar um tem que
 * pular pra ele. Espalhar isso pela interface é como se cria página órfã e índice fora do intervalo.
 */
export function useNotes() {
  const [notes, setNotes] = useState<NotesData>(() => normalizeNotes(DEFAULT_NOTES))
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState(false)
  const { activeId } = useProfiles()

  /**
   * Recarrega quando o PERSONAGEM muda: anotações e presets moram na pasta do perfil aberto (ver
   * `ProfilesRepository.activeDirectory`), então trocar de perfil sem reler deixaria a tela mostrando
   * a ficha do personagem anterior — e, pior, a primeira digitação gravaria esse conteúdo velho por
   * cima do arquivo do novo.
   */
  useEffect(() => {
    setLoading(true)
    window.api.notes
      .get()
      .then((loaded) => setNotes(normalizeNotes({ ...DEFAULT_NOTES, ...loaded })))
      .catch((error: unknown) => console.error('Falha ao carregar anotações:', error))
      .finally(() => setLoading(false))
  }, [activeId])

  /** Aplica a mudança e grava. Recebe função pra sempre partir do estado ATUAL, não do que a tela viu. */
  const update = useCallback((change: (previous: NotesData) => NotesData) => {
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
    saveError,
    updateField,
    updatePage,
    goToPage,
    addPage,
    removePage
  }
}
