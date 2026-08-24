// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Profile } from '@shared/types/profile'
import { ProfileBadge } from './ProfileBadge'

/**
 * O crachá do personagem — o que as Anotações e a Rolagem mostram no lugar do seletor, que ficou
 * só na Ficha (pedido do usuário).
 */

afterEach(cleanup)

const FOTO = 'data:image/png;base64,iVBORw0KGgo='

function perfil(extra: Partial<Profile> = {}): Profile {
  return { id: 'p1', name: 'Aurora Valente', system: 'Ordem Paranormal', photo: null, createdAt: 1, ...extra }
}

describe('o crachá do personagem', () => {
  it('mostra a foto e o nome inteiro, com o sistema no título', () => {
    render(<ProfileBadge profile={perfil({ photo: FOTO })} fallbackName="Personagem 1" emptyPhotoLabel="sem foto" />)
    const cracha = screen.getByTestId('profile-badge')
    expect(cracha.textContent).toBe('Aurora Valente')
    expect(cracha.getAttribute('title')).toBe('Aurora Valente — Ordem Paranormal')
    const foto = cracha.querySelector('img')
    expect(foto?.getAttribute('src')).toBe(FOTO)
    expect(foto?.getAttribute('alt')).toBe('')
  })

  it('sem foto, o quadro fica com o aviso; sem nome, entra o nome pela posição', () => {
    render(<ProfileBadge profile={perfil({ name: '', system: '' })} fallbackName="Personagem 3" emptyPhotoLabel="sem foto" />)
    const cracha = screen.getByTestId('profile-badge')
    expect(cracha.querySelector('img')).toBeNull()
    expect(cracha.querySelector('.profile-badge-photo-empty')?.textContent).toBe('sem foto')
    expect(cracha.querySelector('.profile-badge-name')?.textContent).toBe('Personagem 3')
    expect(cracha.getAttribute('title')).toBe('Personagem 3')
  })

  it('não é um controle: nenhum botão, nenhuma lista', () => {
    render(<ProfileBadge profile={perfil()} fallbackName="Personagem 1" emptyPhotoLabel="sem foto" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(document.querySelector('.profile-select')).toBeNull()
  })

  it('a versão mini só muda a classe — o conteúdo é o mesmo', () => {
    render(<ProfileBadge profile={perfil({ photo: FOTO })} fallbackName="Personagem 1" emptyPhotoLabel="sem foto" mini />)
    const cracha = screen.getByTestId('profile-badge')
    expect(cracha.className).toContain('profile-badge-mini')
    expect(cracha.textContent).toBe('Aurora Valente')
    expect(cracha.querySelector('img')?.getAttribute('src')).toBe(FOTO)
  })
})
