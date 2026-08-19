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
 * conta do flip usa uma altura que a lista não tem. Cabem as 12 fontes de `FONT_OPTIONS` mais a
 * linha opcional de "fonte padrão" (13 x 26px + 8px de borda e padding = 346).
 */
const LIST_MAX_HEIGHT = 350

/**
 * `''` = "usar a fonte do app", a linha extra que só aparece quando `defaultLabel` é passado. Existe
 * pelas ANOTAÇÕES: lá a fonte do texto pode simplesmente acompanhar a do app, o que nas Preferências
 * não faria sentido (é lá que a fonte do app é escolhida).
 */
export type FontSelectValue = FontId | ''

interface FontSelectProps {
  value: FontSelectValue
  onChange: (value: FontSelectValue) => void
  /** Rótulo da linha "fonte padrão". Sem ele, o seletor só oferece fontes concretas. */
  defaultLabel?: string
}

interface ListPosition {
  left: number
  top: number
  width: number
}

export function FontSelect({ value, onChange, defaultLabel }: FontSelectProps) {
  /**
   * A lista real: as fontes de `FONT_OPTIONS` e, na frente, a linha de padrão quando pedida. Todo o
   * resto do componente trabalha por ÍNDICE (setas do teclado, item ativo, escolha), então a entrada
   * extra precisa estar no mesmo array — tratá-la como caso especial multiplicaria os `+1`/`-1` por
   * todo lado, que é onde esse tipo de lista costuma quebrar.
   */
  const options: { id: FontSelectValue; label: string; family: string; credit?: string }[] = [
    ...(defaultLabel ? [{ id: '' as const, label: defaultLabel, family: 'inherit' }] : []),
    ...FONT_OPTIONS.map((font) => ({
      id: font.id as FontSelectValue,
      label: font.label,
      family: font.family,
      credit: 'credit' in font ? font.credit : undefined
    }))
  ]
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<ListPosition | null>(null)
  /** Linha sob o teclado (setas), que não é a mesma coisa que a fonte escolhida enquanto a lista está aberta. */
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedIndex = Math.max(
    0,
    options.findIndex((font) => font.id === value)
  )
  const selected = options[selectedIndex]

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
    onChange(options[index].id)
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
    if (e.key === 'ArrowDown') setActiveIndex((index) => Math.min(options.length - 1, index + 1))
    else if (e.key === 'ArrowUp') setActiveIndex((index) => Math.max(0, index - 1))
    else if (e.key === 'Home') setActiveIndex(0)
    else if (e.key === 'End') setActiveIndex(options.length - 1)
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
        {selected.credit && <span className="font-select-credit">{selected.credit}</span>}
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
          {options.map((font, index) => (
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
                {/* Crédito de quem indicou a fonte — escrito na fonte do APP, não na da linha: em
                    Impact ou Janda ele competiria com o próprio nome que está ali pra ser lido. */}
                {font.credit && <span className="font-select-credit">{font.credit}</span>}
                <FontMascot fontId={font.id} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
