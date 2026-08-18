import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Prende o foco de teclado dentro do modal enquanto ele está aberto — sem isso, Tab escapa
 * pro conteúdo por trás do overlay (script.md: "keyboard usability, visible focus states").
 * Também foca o primeiro campo ao abrir, já que nenhum modal tinha isso além do
 * `autoFocus` manual do campo de nome do preset.
 */
export function useModalFocusTrap(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    function getFocusable(): HTMLElement[] {
      if (!container) return []
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    }

    const focusable = getFocusable()
    if (focusable.length > 0 && !container.contains(document.activeElement)) {
      focusable[0].focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      /**
       * Restaura o foco no PRÓXIMO tick, não sincronamente aqui dentro do cleanup — chamar
       * `.focus()` direto neste ponto (dentro do próprio unmount do React, disparado por
       * dentro de um clique) trava a aba inteira por vários segundos sempre que isso acontece
       * enquanto a cena 3D está renderizando ativamente (um dado ainda rolando quando o modal
       * fecha) — reproduzido de forma determinística: fechar um modal enquanto um dado está no
       * ar sempre travava, fechar depois do dado assentar nunca travava. `setTimeout` tira a
       * chamada de dentro da pilha de execução do clique/unmount, sem perder o comportamento
       * (o foco ainda volta pro elemento certo, só um instante depois).
       */
      setTimeout(() => previouslyFocused?.focus?.(), 0)
    }
  }, [containerRef])
}
