import { describe, expect, it } from 'vitest'
import { botaoDeExplodeVisivel } from './explodeDoSistema'

describe('botaoDeExplodeVisivel', () => {
  it('aparece pras grafias de D&D que existem de verdade', () => {
    // "D&D 5e" é o que o leitor de ficha grava; o resto é como as pessoas digitam.
    for (const system of ['D&D 5e', 'd&d', 'D & D', 'dnd 5e', 'DnD', 'Dungeons & Dragons']) {
      expect(botaoDeExplodeVisivel(system), `"${system}" deveria mostrar o botão`).toBe(true)
    }
  })

  it('aparece pra Kids on Bikes, onde explodir é a regra de todo atributo', () => {
    for (const system of ['Kids on Bikes', 'kids on bikes', 'KidsOnBikes']) {
      expect(botaoDeExplodeVisivel(system), `"${system}" deveria mostrar o botão`).toBe(true)
    }
  })

  it('some pros outros sistemas e pro perfil sem sistema', () => {
    for (const system of ['', 'Ordem Paranormal', 'Oblivio', 'Pathfinder 2e', 'Call of Cthulhu', 'Tormenta20']) {
      expect(botaoDeExplodeVisivel(system), `"${system}" não deveria mostrar o botão`).toBe(false)
    }
  })
})
