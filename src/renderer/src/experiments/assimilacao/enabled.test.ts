import { describe, expect, it } from 'vitest'
import { sistemaInicial } from './enabled'

describe('escolha local de sistema', () => {
  it('começa no Padrão e mantém compatibilidade com o link antigo', () => {
    expect(sistemaInicial(null, '', true)).toBe('padrao')
    expect(sistemaInicial(null, '?assimilacao=1', true)).toBe('assimilacao')
  })
  it('lembra a escolha explícita, mesmo no link antigo', () => {
    expect(sistemaInicial('padrao', '?assimilacao=1', true)).toBe('padrao')
    expect(sistemaInicial('assimilacao', '', true)).toBe('assimilacao')
    expect(sistemaInicial('desconhecido', '', true)).toBe('padrao')
  })
  it('nunca habilita o experimento no site publicado', () => {
    expect(sistemaInicial('assimilacao', '?assimilacao=1', false)).toBe('padrao')
  })
})
