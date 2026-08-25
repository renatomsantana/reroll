import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@shared/types/profile'
import './ProfileSelect.css'

/**
 * Seletor de personagem com MINIATURA 3×4 ao lado do nome — pedido do usuário ("ter uma mini foto
 * 3x4 na lista com o nome do personagem").
 *
 * Existe pelo mesmo motivo do `FontSelect`: `<option>` não desenha imagem em navegador nenhum. O
 * `<select>` nativo que estava aqui só conseguia mostrar texto, e a foto é justamente o que faz
 * reconhecer o personagem de relance numa lista de vários.
 *
 * A miniatura é QUADRADA, como avatar da Steam — pedido do usuário ("mais quadrada, tipo um zoom no
 * rosto"); já foi 3×4 de foto de documento. `object-fit: cover` recorta o que sobra em vez de
 * espremer (uma foto larga achatada deforma o rosto), e `object-position: center 20%` puxa o
 * recorte pra cima, onde o rosto está — ver `ProfileBadge.css`.
 */

/** Teto de altura da lista; tem cópia em `.profile-select-list` e as duas precisam andar juntas. */
const LIST_MAX_HEIGHT = 260

interface ProfileSelectProps {
  profiles: Profile[]
  activeId: string
  onSelect: (id: string) => void
  /** Nome mostrado quando o personagem ainda não tem um — "Personagem 2", pela posição. */
  fallbackName: (index: number) => string
  label: string
  emptyPhotoLabel: string
}

interface ListPosition {
  left: number
  top: number
  width: number
}

export function ProfileSelect({
  profiles,
  activeId,
  onSelect,
  fallbackName,
  label,
  emptyPhotoLabel
}: ProfileSelectProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<ListPosition | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedIndex = Math.max(
    0,
    profiles.findIndex((profile) => profile.id === activeId)
  )
  const selected = profiles[selectedIndex]

  /**
   * Lista em `position: fixed`, posicionada à mão a partir do botão — mesma escolha do `FontSelect`,
   * e pelo mesmo motivo: o painel que a contém rola, e uma lista `absolute` seria cortada pela borda
   * dele justo quando não coubesse, que é quando ela mais precisa aparecer inteira.
   */
  function openList(): void {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const fitsBelow = window.innerHeight - rect.bottom >= LIST_MAX_HEIGHT
    setPosition({
      left: rect.left,
      top: fitsBelow ? rect.bottom : Math.max(4, rect.top - LIST_MAX_HEIGHT),
      width: Math.max(rect.width, 180)
    })
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  function choose(index: number): void {
    onSelect(profiles[index].id)
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

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
    function handleScroll(event: Event): void {
      if (listRef.current?.contains(event.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  function handleListKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') setActiveIndex((index) => Math.min(profiles.length - 1, index + 1))
    else if (e.key === 'ArrowUp') setActiveIndex((index) => Math.max(0, index - 1))
    else if (e.key === 'Home') setActiveIndex(0)
    else if (e.key === 'End') setActiveIndex(profiles.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') choose(activeIndex)
    else if (e.key === 'Escape') {
      setOpen(false)
      buttonRef.current?.focus()
    } else return
    e.preventDefault()
    e.stopPropagation()
  }

  function renderPhoto(profile: Profile) {
    return profile.photo ? (
      <img className="profile-select-photo" src={profile.photo} alt="" draggable={false} />
    ) : (
      <span className="profile-select-photo profile-select-photo-empty">{emptyPhotoLabel}</span>
    )
  }

  return (
    <div className="profile-select" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="profile-select-value"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        title={label}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            openList()
          }
        }}
      >
        {renderPhoto(selected)}
        <span className="profile-select-name">{selected.name || fallbackName(selectedIndex)}</span>
        <span className="profile-select-arrow" aria-hidden="true">
          ▼
        </span>
      </button>

      {open && position && (
        <ul
          ref={listRef}
          className="profile-select-list"
          role="listbox"
          tabIndex={-1}
          style={{ left: position.left, top: position.top, width: position.width }}
          onKeyDown={handleListKeyDown}
        >
          {profiles.map((profile, index) => (
            <li key={profile.id}>
              <button
                type="button"
                role="option"
                aria-selected={profile.id === activeId}
                className={`profile-select-option ${
                  index === activeIndex ? 'profile-select-option-active' : ''
                }`}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                {renderPhoto(profile)}
                <span className="profile-select-name">{profile.name || fallbackName(index)}</span>
                {profile.system && <span className="profile-select-system">{profile.system}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
