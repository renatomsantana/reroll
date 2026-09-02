/**
 * OLHAR AS NOTAS DA RELEASE como quem recebe a atualização vai vê-las, numa janela oculta com o
 * CSS de produção — pedido dele (02/09/2026): "me mostra como tá a página de atualização falando de
 * cada atualização, quero decidir o que vai tá lá antes".
 *
 * O caminho real: a primeira seção do `CHANGELOG.md` vira o corpo da release no GitHub
 * (`release.yml`), o GitHub converte o Markdown em HTML, o `electron-updater` entrega esse HTML ao
 * app, e `textoDasNotas` (`updater.ts`) tira as tags e CORTA EM 2000 CARACTERES antes de o aviso
 * mostrar num `<pre>`. Este script refaz esse caminho de ponta a ponta, sem rede.
 *
 *     npx electron-vite build && npx electron scripts/olharNotasDaRelease.mjs
 *
 * Grava `out/olhar-update/notas-<versão>.png` (o aviso como aparece) e `notas-<versão>.txt` (o
 * texto inteiro, com a marca de onde o corte cai). Não julga nada: é pra olhar.
 */
import { app, BrowserWindow } from 'electron'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const RAIZ = resolve(import.meta.dirname, '..')
const ASSETS = join(RAIZ, 'out', 'renderer', 'assets')
const css = readdirSync(ASSETS).find((n) => n.startsWith('index-') && n.endsWith('.css'))
if (!css) throw new Error('Rode `npx electron-vite build` antes.')

const versao = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version
/** O mesmo teto de `textoDasNotas`. */
const CORTE = 2000

/** A primeira seção `## [...]` do CHANGELOG, como o `release.yml` recorta. */
function secaoMaisNova() {
  const linhas = readFileSync(join(RAIZ, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n').split('\n')
  let inicio = -1
  let fim = linhas.length
  for (let i = 0; i < linhas.length; i++) {
    if (/^## \[/.test(linhas[i])) {
      if (inicio < 0) inicio = i
      else {
        fim = i
        break
      }
    }
  }
  if (inicio < 0) throw new Error('CHANGELOG.md sem nenhuma seção de versão')
  return { titulo: linhas[inicio], corpo: linhas.slice(inicio + 1, fim) }
}

/**
 * Markdown → o texto que sobra depois de GitHub (HTML) e `textoDasNotas` (sem tags): títulos viram
 * linha própria, itens viram "• ", negrito e código perdem as marcas, e as linhas quebradas à mão
 * de um mesmo parágrafo voltam a ser um parágrafo só (é o que o HTML faz com elas).
 */
function comoOAppMostra(linhas) {
  const saida = []
  let paragrafo = ''
  const fecha = () => {
    if (paragrafo.trim()) saida.push(paragrafo.trim())
    paragrafo = ''
  }
  for (const bruta of linhas) {
    const linha = bruta.replace(/\*\*/g, '').replace(/`/g, '')
    if (!linha.trim()) {
      fecha()
      continue
    }
    const titulo = /^#{1,6}\s+(.*)$/.exec(linha)
    if (titulo) {
      fecha()
      saida.push(titulo[1].trim())
      continue
    }
    const item = /^\s*[-*]\s+(.*)$/.exec(linha)
    if (item) {
      fecha()
      paragrafo = `• ${item[1]}`
      continue
    }
    paragrafo = paragrafo ? `${paragrafo} ${linha.trim()}` : linha.trim()
  }
  fecha()
  return saida.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

const { titulo, corpo } = secaoMaisNova()
const inteiro = comoOAppMostra(corpo)
const noAviso = inteiro.slice(0, CORTE)

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const pagina = (tema) => `<!DOCTYPE html><html data-theme="${tema}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(ASSETS, css)).href}">
<style>html,body{margin:0;height:100%}</style></head><body>
<div class="modal-overlay">
  <div class="card update-prompt">
    <h2 class="update-prompt-title">Atualização disponível</h2>
    <p class="update-prompt-text">A versão ${versao} está pronta pra baixar. Quer atualizar agora?</p>
    <p class="update-prompt-notes-title">Novidades</p>
    <pre class="update-prompt-notes">${escapar(noAviso)}</pre>
    <div class="update-prompt-actions">
      <button class="btn btn-secondary">Agora não</button>
      <button class="btn btn-primary">Atualizar</button>
    </div>
  </div>
</div>
</body></html>`

app.whenReady().then(async () => {
  const pasta = join(RAIZ, 'out', 'olhar-update')
  mkdirSync(pasta, { recursive: true })
  const relatorio = [
    `${titulo}`,
    ``,
    `Seção do CHANGELOG: ${corpo.join('\n').length} caracteres em Markdown; ${inteiro.length} depois de virar texto.`,
    `O aviso dentro do app mostra os primeiros ${CORTE}: ${inteiro.length > CORTE ? `CORTA em "...${inteiro.slice(CORTE - 40, CORTE)}"` : 'cabe inteiro'}.`,
    `A página da release no GitHub mostra tudo, mais o rodapé de .github/release-footer.md.`,
    ``,
    `===== O QUE O AVISO MOSTRA (até ${CORTE}) =====`,
    noAviso,
    ``,
    `===== O RESTO, que só a página da release mostra =====`,
    inteiro.slice(CORTE) || '(nada)'
  ].join('\n')
  writeFileSync(join(pasta, `notas-${versao}.txt`), relatorio, 'utf8')

  const win = new BrowserWindow({
    show: false,
    width: 560,
    height: 520,
    useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  const arquivo = join(pasta, `notas-${versao}.html`)
  writeFileSync(arquivo, pagina('day'))
  await win.loadFile(arquivo)
  await new Promise((r) => setTimeout(r, 500))
  // O `<pre>` rola por dentro: a captura mostra o que aparece SEM rolar, que é o que a pessoa lê.
  writeFileSync(join(pasta, `notas-${versao}.png`), (await win.webContents.capturePage()).toPNG())
  console.log(`gravado notas-${versao}.png e .txt em out/olhar-update (${inteiro.length} caracteres, corte em ${CORTE})`)
  win.destroy()
  app.exit(0)
})
