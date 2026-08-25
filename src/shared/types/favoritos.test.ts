import { describe, expect, it } from 'vitest'
import { comFavoritosNoTopo, favoritoSaneado, favoritosOrdenados, reindexarFavoritos } from './preset'

/** Os favoritos (spec §3.9) — a ordem é da pessoa, e a lista nunca pode ficar com buraco. */
describe('favoritos', () => {
  const lista = [
    { id: 'a', favorito: 2 },
    { id: 'b' },
    { id: 'c', favorito: 0 },
    { id: 'd', favorito: 5 }
  ]

  it('ordena pelos números, e põe no topo mantendo o resto como estava', () => {
    expect(favoritosOrdenados(lista).map((p) => p.id)).toEqual(['c', 'a', 'd'])
    expect(comFavoritosNoTopo(lista).map((p) => p.id)).toEqual(['c', 'a', 'd', 'b'])
  })

  it('reindexa 0..n−1 sem mudar a ordem relativa, e não toca em quem não é favorito', () => {
    const reindexados = reindexarFavoritos(lista)
    expect(reindexados).toEqual([
      { id: 'a', favorito: 1 },
      { id: 'b' },
      { id: 'c', favorito: 0 },
      { id: 'd', favorito: 2 }
    ])
  })

  it('o que vem do disco torto não é favorito', () => {
    expect(favoritoSaneado(3)).toBe(3)
    expect(favoritoSaneado(0)).toBe(0)
    expect(favoritoSaneado('1')).toBeUndefined()
    expect(favoritoSaneado(1.5)).toBeUndefined()
    expect(favoritoSaneado(-1)).toBeUndefined()
    expect(favoritoSaneado(true)).toBeUndefined()
  })
})
