import { useEffect, useRef, useState } from 'react'
import { FONT_OPTIONS, type FontId } from '@renderer/settings/SettingsContext'
import { FontMascot } from './FontMascot'
import './FontSelect.css'

/**
 * Seletor de fonte próprio, no lugar do `<select>` nativo. Existe por um motivo só: `<option>` não
 * desenha imagem em nenhum navegador, e o usuário pediu a caveirinha do easter egg TAMBÉM na lista
 * ("coloca na lista também, tipo papyrus (caveira), comic sans (caveira)"), não só ao lado da fonte
 * já escolhida.
 *
 * Mantém o desenho da caixa de combinação do 98: campo afundado com o valor atual e um botãozinho
 * em relevo com a seta na ponta. Cada linha é escrita NA PRÓPRIA FONTE dela — é um seletor de
 * fonte, e ver o desenho da letra vale mais que ler o nome.
 */

/**
 * Teto de altura da lista — também decide se ela abre pra baixo ou pra cima, então não é só estética.
 * Tem cópia em `.font-select-list` (`FontSelect.css`) e as duas precisam andar juntas: divergindo, a
 * conta do flip usa uma altura que a lista não tem. Cabem as 11 fontes de `FONT_OPTIONS`
 * (11 x 26px + 8px de borda e padding = 294).
 */
const LIST_MAX_HEIGHT = 300

interface FontSelectProps {
  value: FontId
  onChange: (value: FontId) => void
}

interface ListPosition {
  left: number
  top: number
  width: number
}

export function FontSelect({ value, onChange }: FontSelectProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<ListPosition | null>(null)
  /** Linha sob o teclado (setas), que não é a mesma coisa que a fonte escolhida enquanto a lista está aberta. */
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedIndex = Math.max(
    0,
    FONT_OPTIONS.findIndex((font) => font.id === value)
  )
  const selected = FONT_OPTIONS[selectedIndex]

  /**
   * A lista é `position: fixed` e posicionada à mão a partir do botão. O painel de Preferências tem
   * `overflow-y: auto`, então uma lista posicionada por `absolute` seria CORTADA pela borda dele
   * justamente quando não coubesse — que é quando ela mais precisa aparecer inteira.
   */
  function openList(): void {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const fitsBelow = window.innerHeight - rect.bottom >= LIST_MAX_HEIGHT
    setPosition({
      left: rect.left,
      top: fitsBelow ? rect.bottom : Math.max(4, rect.top - LIST_MAX_HEIGHT),
      width: rect.width
    })
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  function choose(index: number): void {
    onChange(FONT_OPTIONS[index].id)
    setOpen(false)
    buttonRef.current?.focus()
  }

  // Foco vai pra lista ao abrir: é ela que responde às setas, e sem isso o teclado ficaria preso no
  // botão com uma lista aberta que não anda.
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  // Fecha ao clicar fora ou ao a janela mudar de tamanho/rolar — a lista está presa a coordenadas
  // calculadas no momento da abertura, então qualquer coisa que mova o botão a deixa deslocada.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    function close(): void {
      setOpen(false)
    }
    /**
     * Rolagem de FORA fecha (a lista está presa a coordenadas calculadas na abertura, então rolar o
     * painel a deixaria flutuando no lugar errado) — mas a rolagem DENTRO dela, não. Sem essa
     * distinção a lista se fechava sozinha na primeira volta da rodinha do mouse, que é justamente
     * como se chega no fim dela; peguei isso capturando a lista rolada num teste.
     */
    function handleScroll(event: Event): void {
      if (listRef.current?.contains(event.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', close)
    // `true` = fase de captura: pega a rolagem de qualquer ancestral, inclusive a do próprio painel.
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  function handleListKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') setActiveIndex((index) => Math.min(FONT_OPTIONS.length - 1, index + 1))
    else if (e.key === 'ArrowUp') setActiveIndex((index) => Math.max(0, index - 1))
    else if (e.key === 'Home') setActiveIndex(0)
    else if (e.key === 'End') setActiveIndex(FONT_OPTIONS.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') choose(activeIndex)
    else if (e.key === 'Escape') {
      setOpen(false)
      buttonRef.current?.focus()
    } else return
    e.preventDefault()
    // O `Escape` no modal fecha as Preferências inteiras (ver `SettingsPanel.tsx`); com a lista
    // aberta ele tem que fechar só a lista.
    e.stopPropagation()
  }

  return (
    <div className="font-select" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="font-select-value"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            openList()
          }
        }}
      >
        <span className="font-select-label" style={{ fontFamily: selected.family }}>
          {selected.label}
        </span>
        <FontMascot fontId={selected.id} />
        <span className="font-select-arrow" aria-hidden="true">
          ▼
        </span>
      </button>

      {open && position && (
        <ul
          ref={listRef}
          className="font-select-list"
          role="listbox"
          tabIndex={-1}
          style={{ left: position.left, top: position.top, width: position.width }}
          onKeyDown={handleListKeyDown}
        >
          {FONT_OPTIONS.map((font, index) => (
            <li key={font.id}>
              <button
                type="button"
                role="option"
                aria-selected={font.id === value}
                className={`font-select-option ${
                  index === activeIndex ? 'font-select-option-active' : ''
                }`}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <span className="font-select-label" style={{ fontFamily: font.family }}>
                  {font.label}
                </span>
                <FontMascot fontId={font.id} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
