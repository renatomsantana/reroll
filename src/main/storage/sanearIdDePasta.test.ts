import { describe, expect, it } from 'vitest'
import { sanearIdDePasta } from './ProfilesRepository'

/**
 * O id do perfil vira NOME DE PASTA dentro de `userData` (ver `activeDirectory`), e ele chega de
 * dois lugares que não são de confiança: do renderer, por `profiles.save`, e do `profiles.json`, um
 * arquivo que qualquer coisa rodando na máquina pode editar.
 *
 * Sem saneamento, um id com `..` faz o app gravar a ficha do personagem FORA da pasta dele — o app
 * viraria a ferramenta de escrita de quem plantou o id. Estes testes existem pra essa porta não
 * reabrir num refactor distraído.
 */
describe('saneamento do id de perfil que vira pasta', () => {
  it('deixa passar o que o app realmente gera (uuid)', () => {
    const uuid = '9f2a1c7e-4b3d-4a10-9c6f-2b8e5d1a7c40'
    expect(sanearIdDePasta(uuid)).toBe(uuid)
  })

  it('não deixa escapar da pasta de perfis', () => {
    for (const ataque of ['../fora', '..\\..\\Startup', '/etc/passwd', 'C:\\Windows\\System32']) {
      const limpo = sanearIdDePasta(ataque)
      expect(limpo).not.toContain('..')
      expect(limpo).not.toContain('/')
      expect(limpo).not.toContain('\\')
      expect(limpo).not.toContain(':')
    }
  })

  it('nunca devolve vazio, `.` nem `..` — os três viram a pasta de perfis ou a de cima dela', () => {
    // O ponto não está na lista branca, então vira `_` como qualquer caractere de fora: `..` sai
    // como `__`. O que importa é que nenhuma das três formas perigosas sobrevive.
    expect(sanearIdDePasta('')).toBe('_')
    expect(sanearIdDePasta('.')).toBe('_')
    expect(sanearIdDePasta('..')).toBe('__')
  })

  it('corta id absurdamente longo, que estoura o limite de caminho do Windows', () => {
    expect(sanearIdDePasta('a'.repeat(500))).toHaveLength(64)
  })

  it('preserva caracteres inofensivos e troca o resto por sublinhado', () => {
    expect(sanearIdDePasta('perfil_do-Renato')).toBe('perfil_do-Renato')
    expect(sanearIdDePasta('perfil do Renato')).toBe('perfil_do_Renato')
  })
})
