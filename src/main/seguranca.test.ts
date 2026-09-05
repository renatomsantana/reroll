import { afterEach, describe, expect, it, vi } from 'vitest'
import { ehPaginaDoApp, ehPermitido, podeNavegarPara, remetenteConfiavel } from './seguranca'

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

/**
 * NAVEGAR é uma pergunta diferente de ALCANÇAR, e a diferença é o tamanho do estrago.
 *
 * O atualizador precisa falar com o github.com, então ele passa em `ehPermitido`. Se a navegação
 * usasse a mesma lista, uma página do GitHub poderia TOMAR O LUGAR da interface — rodando com o
 * preload do Reroll, ou seja, com as pontes de IPC na mão. Estes testes são o que impede as duas
 * listas de virarem uma só num dia de pressa.
 */
describe('o que pode virar a página do app', () => {
  it('não deixa nem `file:` — a interface entra por `loadFile`, que não passa por aqui', () => {
    /**
     * Parece contraintuitivo e é o ponto: a única navegação `file:` que chegaria neste ponto seria
     * uma partindo DA PÁGINA, e um `file:///C:/...` colado numa anotação viraria uma página qualquer
     * do disco rodando com o preload do Reroll.
     */
    expect(podeNavegarPara('file:///C:/Program%20Files/Reroll/resources/app.asar/index.html')).toBe(false)
    expect(podeNavegarPara('file:///C:/Users/alguem/Downloads/pagina-baixada.html')).toBe(false)
  })

  it('NÃO deixa o GitHub tomar o lugar da interface, mesmo ele podendo ser alcançado', () => {
    // As duas asserções juntas são o teste: alcançável sim, navegável não.
    expect(ehPermitido('https://github.com/renatomsantana/reroll')).toBe(true)
    expect(podeNavegarPara('https://github.com/renatomsantana/reroll')).toBe(false)
  })

  it('bloqueia página remota e endereço malformado', () => {
    expect(podeNavegarPara('https://site-do-atacante.net/')).toBe(false)
    expect(podeNavegarPara('javascript:alert(1)')).toBe(false)
    expect(podeNavegarPara('nao é url')).toBe(false)
  })
})

/**
 * O SERVIDOR DE DESENVOLVIMENTO é a única exceção das duas listas, e ele chega por variável de
 * ambiente — comparada por ORIGEM desde este teste.
 *
 * O `startsWith` que estava aqui deixava passar `http://localhost:5173.dominio-de-alguem.net`, que
 * COMEÇA com o endereço do dev. É a mesma armadilha do domínio parecido, testada logo acima pro lado
 * do GitHub, do outro lado do mesmo arquivo — e no dev a janela roda com o preload carregado.
 */
describe('exceção do servidor de desenvolvimento', () => {
  /**
   * `vi.stubEnv` em vez de mexer em `process.env` na mão: os tipos do Electron declaram
   * `ELECTRON_RENDERER_URL` como SOMENTE LEITURA, então atribuir ali não compila — e o `npm test`
   * sozinho não pegaria isso, porque o vitest não checa tipo.
   */
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('deixa passar o próprio servidor, e só ele', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
    expect(ehPermitido('http://localhost:5173/src/main.tsx')).toBe(true)
    expect(podeNavegarPara('http://localhost:5173/')).toBe(true)
    // Outra porta na mesma máquina já é outra origem.
    expect(podeNavegarPara('http://localhost:5174/')).toBe(false)
  })

  it('não cai no domínio que só COMEÇA igual', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
    expect(ehPermitido('http://localhost:5173.dominio-de-alguem.net/x')).toBe(false)
    expect(podeNavegarPara('http://localhost:5173.dominio-de-alguem.net/x')).toBe(false)
  })

  it('sem a variável, não há exceção nenhuma', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', undefined)
    expect(ehPermitido('http://localhost:5173/')).toBe(false)
    expect(podeNavegarPara('http://localhost:5173/')).toBe(false)
  })
})

/**
 * QUEM PODE FALAR COM OS CANAIS DE IPC: só o quadro principal da página do app. Um handler que
 * atende qualquer `webContents` é um handler que atende uma página que tomou o lugar da interface;
 * a conferência do remetente é o que faz as travas de navegação valerem também do lado de dentro.
 */
describe('quem pode falar com os canais de IPC', () => {
  it('a interface empacotada e o servidor de desenvolvimento, e mais ninguém', () => {
    expect(ehPaginaDoApp('file:///D:/Reroll/resources/app.asar/out/renderer/index.html')).toBe(true)
    expect(ehPaginaDoApp('file:///C:/Users/x/AppData/Local/Programs/Reroll/resources/app.asar/out/renderer/index.html')).toBe(true)
    expect(ehPaginaDoApp('file:///C:/qualquer/pagina.html')).toBe(false)
    expect(ehPaginaDoApp('file:///C:/qualquer/out/renderer/index.html.evil/x.html')).toBe(false)
    expect(ehPaginaDoApp('https://github.com/renatomsantana/reroll')).toBe(false)
    expect(ehPaginaDoApp('nao é url')).toBe(false)
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
    expect(ehPaginaDoApp('http://localhost:5173/')).toBe(true)
    expect(ehPaginaDoApp('http://localhost:5173.dominio-de-alguem.net/')).toBe(false)
    vi.unstubAllEnvs()
  })

  it('o evento precisa vir do quadro PRINCIPAL da página do app; quadro morto ou filho não', () => {
    const principal = { url: 'file:///D:/Reroll/resources/app.asar/out/renderer/index.html' }
    const sender = { mainFrame: principal }
    const evento = (senderFrame: unknown) => ({ senderFrame, sender }) as unknown as Parameters<typeof remetenteConfiavel>[0]
    expect(remetenteConfiavel(evento(principal))).toBe(true)
    // Quadro já destruído: o Electron entrega `null`.
    expect(remetenteConfiavel(evento(null))).toBe(false)
    // Mesma URL, OUTRO quadro (um filho): não é o principal.
    expect(remetenteConfiavel(evento({ url: principal.url }))).toBe(false)
    const outra = { url: 'https://github.com/x' }
    expect(remetenteConfiavel({ senderFrame: outra, sender: { mainFrame: outra } } as unknown as Parameters<typeof remetenteConfiavel>[0])).toBe(false)
  })
})
