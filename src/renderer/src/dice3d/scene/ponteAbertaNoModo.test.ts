import { describe, expect, it } from 'vitest'
import { ponteAbertaNoModo } from './ponteAbertaNoModo'

/**
 * A regra de QUANDO a ponte levadiça pode ficar levantada.
 *
 * Existe por um defeito real, encontrado ao testar as rolagens depois que a ponte passou a abrir e
 * fechar: o clique só é aceito na torre de enfeite, mas o ESTADO vive no React e sobrevive à troca
 * de modo. Fechar a ponte no enfeite e voltar pro modo torre entregava uma rolagem com a folha em
 * pé bem na boca — e sem clique que reabrisse, porque no modo torre o clique é ignorado. A medição
 * de que o dado atravessa a folha nessa situação está em `ponteLevadica.test.ts`.
 */
describe('ponte levantada só no enfeite', () => {
  it('na torre de ENFEITE a escolha do usuário vale', () => {
    expect(ponteAbertaNoModo('towerDecor', true)).toBe(true)
    expect(ponteAbertaNoModo('towerDecor', false)).toBe(false)
  })

  it('no modo TORRE a ponte fica abaixada, mesmo com a ponte fechada no enfeite', () => {
    expect(ponteAbertaNoModo('tower', false)).toBe(true)
    expect(ponteAbertaNoModo('tower', true)).toBe(true)
  })

  it('no modo BANDEJA também — não há torre na cena, e o estado não pode vazar pra próxima', () => {
    expect(ponteAbertaNoModo('tray', false)).toBe(true)
  })
})
