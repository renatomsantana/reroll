import { describe, expect, it } from 'vitest'
import { ehPermitido } from './seguranca'

/**
 * A lista branca de rede é a promessa mais forte que o app faz a quem instala: ele não fala com
 * lugar nenhum além do GitHub, e só pra perguntar se existe versão nova.
 *
 * Estes testes existem por causa dos DOIS jeitos de essa promessa quebrar, e os dois são silenciosos:
 * alargar demais (e deixar passar um host de atacante) ou apertar demais (e matar a atualização de
 * quem já instalou, sem ninguém perceber por meses).
 */
describe('lista branca de rede', () => {
  it('deixa passar o caminho da atualização', () => {
    expect(ehPermitido('https://api.github.com/repos/renatomsantana/reroll/releases/latest')).toBe(true)
    expect(ehPermitido('https://github.com/renatomsantana/reroll/releases.atom')).toBe(true)
    // Os anexos saem de subdomínios que mudam sem aviso — por isso o curinga de um domínio só.
    expect(ehPermitido('https://objects.githubusercontent.com/x.exe')).toBe(true)
    expect(ehPermitido('https://release-assets.githubusercontent.com/y.exe')).toBe(true)
  })

  it('bloqueia qualquer outro destino', () => {
    expect(ehPermitido('https://example.com/')).toBe(false)
    expect(ehPermitido('https://telemetria.qualquer/coleta')).toBe(false)
  })

  it('não cai no truque do domínio parecido', () => {
    // O ponto antes do domínio é o que separa "subdomínio do GitHub" de "domínio que TERMINA nele".
    expect(ehPermitido('https://githubusercontent.com.site-do-atacante.net/x')).toBe(false)
    expect(ehPermitido('https://api.github.com.evil.net/x')).toBe(false)
    expect(ehPermitido('https://fakegithub.com/x')).toBe(false)
  })

  it('exige HTTPS — em HTTP alguém no caminho troca o que o app baixa', () => {
    expect(ehPermitido('http://github.com/x')).toBe(false)
    expect(ehPermitido('http://api.github.com/x')).toBe(false)
  })

  it('deixa a própria interface carregar (arquivo local, dados embutidos)', () => {
    expect(ehPermitido('file:///C:/app/index.html')).toBe(true)
    expect(ehPermitido('data:image/png;base64,AAAA')).toBe(true)
  })

  it('não engasga com endereço malformado', () => {
    expect(ehPermitido('nao é url')).toBe(false)
    expect(ehPermitido('')).toBe(false)
  })
})
