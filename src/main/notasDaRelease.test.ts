import { describe, expect, it, vi } from 'vitest'

/**
 * O CHANGELOG que aparece no aviso de versão nova vem DE FORA — é a descrição de uma release,
 * escrita na internet, entregue pelo `electron-updater` já convertida em HTML pelo GitHub.
 *
 * Texto remoto que a interface do app vai exibir é a definição de entrada não confiável, e o
 * caminho tentador (renderizar o HTML) é justamente o que a CSP e as travas de navegação existem
 * pra impedir. Estes testes fixam a régua: sai texto, nunca marcação.
 */

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.9', isPackaged: false },
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] }
}))

const { textoDasNotas } = await import('./updater')

describe('notas da release', () => {
  it('texto simples passa inteiro', () => {
    expect(textoDasNotas('Consertado o diário.')).toBe('Consertado o diário.')
  })

  it('as tags HTML SOMEM, e o texto delas fica', () => {
    expect(textoDasNotas('<p>Consertado o <b>diário</b>.</p>')).toBe('Consertado o diário.')
  })

  it('uma lista vira lista legível em vez de um bloco só', () => {
    const html = '<ul><li>Dados explosivos</li><li>Modo rápido</li></ul>'
    expect(textoDasNotas(html)).toBe('• Dados explosivos\n• Modo rápido')
  })

  it('quebras de linha do HTML viram quebras de verdade', () => {
    expect(textoDasNotas('Uma coisa<br>Outra coisa')).toBe('Uma coisa\nOutra coisa')
  })

  it('script embutido não sobrevive — nem o conteúdo dele vira comando', () => {
    /**
     * O caso que interessa. Uma release descrita com `<script>` ou com um `<img onerror>` só é
     * perigosa se alguém renderizar isso como HTML. Aqui a marcação inteira é desmontada ANTES de
     * chegar à interface, e o que sobra é texto — que é o que o `<pre>` do aviso mostra.
     */
    const resultado = textoDasNotas('<script>alert(1)</script>Novidades')
    expect(resultado).not.toContain('<script>')
    expect(resultado).not.toContain('<')
    expect(resultado).toContain('Novidades')

    const comImagem = textoDasNotas('<img src=x onerror="alert(1)">Versão nova')
    expect(comImagem).not.toContain('onerror')
    expect(comImagem).toBe('Versão nova')
  })

  it('entidades HTML voltam a ser os caracteres que representam', () => {
    expect(textoDasNotas('Presets &amp; anotações')).toBe('Presets & anotações')
    expect(textoDasNotas('Use &lt;Enter&gt; pra rolar')).toBe('Use <Enter> pra rolar')
  })

  it('lista de várias releases é juntada na ordem', () => {
    const varias = [{ version: '1.0.8', note: 'Correções' }, { version: '1.0.9', note: 'Novidades' }]
    expect(textoDasNotas(varias)).toBe('Correções\n\nNovidades')
  })

  it('sem notas devolve AUSENTE, e não uma string vazia', () => {
    // A tela usa a ausência pra decidir se mostra a seção. String vazia desenharia um quadro vazio.
    expect(textoDasNotas(undefined)).toBeUndefined()
    expect(textoDasNotas('')).toBeUndefined()
    expect(textoDasNotas('   ')).toBeUndefined()
    expect(textoDasNotas('<p></p>')).toBeUndefined()
    expect(textoDasNotas(42)).toBeUndefined()
  })

  it('nota gigantesca é cortada — o aviso é uma janela, não um rolo', () => {
    const enorme = textoDasNotas('a'.repeat(5000))
    expect(enorme).toHaveLength(2000)
  })
})
