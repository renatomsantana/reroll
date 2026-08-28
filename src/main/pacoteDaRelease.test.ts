import { createHash } from 'crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * O PACOTE QUE VAI PRO AR está coerente consigo mesmo?
 *
 * Este é o pedaço testável do caminho de atualização. O ciclo completo — publicar uma release,
 * o app instalado achar, baixar, conferir e instalar — exige o GitHub e uma máquina com uma versão
 * antiga instalada; isso continua sendo um passo manual (ver `CONTRIBUTING.md`). Mas a parte que já
 * QUEBROU DE VERDADE neste projeto dá pra conferir aqui, e é a mais idiota de todas:
 *
 * o `latest.yml` apontava pra `Reroll-Setup-<versão>.exe` com hífens enquanto o electron-builder
 * gerava "Reroll Setup <versão>.exe" com espaços, e o GitHub ainda troca espaço por ponto ao subir o
 * anexo. Resultado: todo mundo que tinha o app instalado passou a procurar um arquivo que não
 * existia na release. Update quebrado com 404 e nenhuma pista do motivo.
 *
 * O que se confere aqui:
 *
 * 1. o arquivo que o `latest.yml` nomeia EXISTE na pasta de release;
 * 2. o `sha512` que ele declara bate com o arquivo de verdade — é exatamente essa conferência que o
 *    `electron-updater` faz antes de executar o instalador baixado, e é o que a spec chama de
 *    "nunca execute código baixado sem verificar" (seção 4);
 * 3. a versão do `latest.yml` é a do `package.json` — publicar com a versão errada faz o app
 *    instalado achar que já está atualizado e nunca mais oferecer nada;
 * 4. o nome segue o `artifactName` do `electron-builder.yml`, sem espaço nenhum.
 *
 * PULA quando não há build. Rodar `npm test` sem ter empacotado é o caso normal do dia a dia, e um
 * teste vermelho por isso viraria ruído que se aprende a ignorar. No CI de release ele roda depois
 * do empacotamento, que é onde ele importa (ver `.github/workflows/release.yml`).
 */

const PASTA = join(process.cwd(), 'release')
const LATEST = join(PASTA, 'latest.yml')

/** Lê o `latest.yml` sem depender de uma biblioteca de YAML — o arquivo é raso e conhecido. */
function lerLatest(): { version: string; path: string; sha512: string } {
  const texto = readFileSync(LATEST, 'utf-8')
  const pegar = (chave: string): string => {
    const achado = new RegExp(`^${chave}:\\s*(.+)$`, 'm').exec(texto)
    if (!achado) throw new Error(`latest.yml sem o campo "${chave}"`)
    return achado[1].trim()
  }
  return { version: pegar('version'), path: pegar('path'), sha512: pegar('sha512') }
}

const temBuild = existsSync(LATEST)
const versaoDoPacote = (JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as {
  version: string
}).version

describe.skipIf(!temBuild)('o pacote de release', () => {
  it('o instalador que o `latest.yml` nomeia existe mesmo', () => {
    /**
     * O defeito histórico, em uma linha. O app instalado monta a URL de download a partir DESTE
     * nome; se ele não corresponder ao anexo da release, o update morre em 404 pra todo mundo ao
     * mesmo tempo e o console de quem instalou não diz nada útil.
     */
    const { path } = lerLatest()
    expect(existsSync(join(PASTA, path)), `${path} não está em release/`).toBe(true)
  })

  it('o sha512 declarado bate com o arquivo — é o que o updater confere antes de instalar', () => {
    const { path, sha512 } = lerLatest()
    const real = createHash('sha512').update(readFileSync(join(PASTA, path))).digest('base64')
    expect(real).toBe(sha512)
  })

  it('o tamanho declarado bate com o arquivo', () => {
    const { path } = lerLatest()
    const declarado = /size:\s*(\d+)/.exec(readFileSync(LATEST, 'utf-8'))
    expect(declarado).not.toBeNull()
    expect(statSync(join(PASTA, path)).size).toBe(Number(declarado?.[1]))
  })

  it('a versão publicada é a do `package.json`', () => {
    // Versão errada aqui faz o app instalado concluir que já está atualizado — e parar de oferecer.
    expect(lerLatest().version).toBe(versaoDoPacote)
  })

  it('o nome do instalador não tem espaço', () => {
    /**
     * A causa raiz do 404: o GitHub troca espaço por ponto no nome do anexo ao subir, então
     * "Reroll Setup 1.0.9.exe" vira "Reroll.Setup.1.0.9.exe" e deixa de bater com o `latest.yml`.
     * O `artifactName` do `electron-builder.yml` usa hífens justamente por isso.
     */
    const { path } = lerLatest()
    expect(path).not.toMatch(/\s/)
    expect(path).toBe(`Reroll-Setup-${versaoDoPacote}.exe`)
  })

  it('o `.blockmap` está junto — é ele que faz o update baixar só a diferença', () => {
    const { path } = lerLatest()
    expect(existsSync(join(PASTA, `${path}.blockmap`))).toBe(true)
  })

  it('o `app-update.yml` empacotado aponta pro repositório certo', () => {
    /**
     * É este arquivo, e não o código, que diz ao app instalado ONDE procurar versão nova — o
     * electron-builder o grava dentro do pacote a partir do bloco `publish`. Um repositório errado
     * aqui é um app que procura atualização no lugar de outra pessoa.
     */
    const caminho = join(PASTA, 'win-unpacked', 'resources', 'app-update.yml')
    if (!existsSync(caminho)) return
    const texto = readFileSync(caminho, 'utf-8')
    expect(texto).toContain('provider: github')
    expect(texto).toContain('owner: renatomsantana')
    expect(texto).toContain('repo: reroll')
  })

  it('o instalador da versão ATUAL é o mais novo da pasta', () => {
    /**
     * A pasta guarda os instaladores antigos, e o `latest.yml` é reescrito a cada build. Se um build
     * falhar no meio, sobra um `latest.yml` novo apontando pra um `.exe` velho — e aí a release sai
     * com o instalador errado, que é pior que sair sem nenhum.
     *
     * Só os INSTALADORES (`Reroll-Setup-*`): o build portátil (`Reroll-Portatil-*`, alvo `portable`
     * no `electron-builder.yml`) é empacotado DEPOIS do NSIS no mesmo build, então é sempre o
     * arquivo mais novo da pasta e não é o que o `latest.yml` nomeia. Foi o que derrubou o CI do
     * 1.1.2 na primeira tentativa: o pacote estava certo, o teste é que olhava o arquivo errado.
     */
    const exes = readdirSync(PASTA).filter((n) => /^Reroll-Setup-.*.exe$/.test(n))
    const maisNovo = exes
      .map((nome) => ({ nome, mtime: statSync(join(PASTA, nome)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]
    expect(maisNovo.nome).toBe(lerLatest().path)
  })
})
