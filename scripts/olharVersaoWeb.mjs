/**
 * OLHAR A VERSÃO WEB de pé, numa janela OCULTA (nunca captura de tela — o PC está sempre em uso):
 * sobe um servidor estático sobre `out/web/`, abre a página como um navegador abriria (origem
 * http://localhost, IndexedDB e `crypto.randomUUID` de verdade) e fotografa em dois tamanhos —
 * desktop e celular. Qualquer erro de console ou de página aparece no relatório e derruba o exit
 * code, então serve de fumaça além de foto.
 *
 *     npm run build:web && npx electron scripts/olharVersaoWeb.mjs
 *
 * Grava `out/olhar-web/desktop.png` e `out/olhar-web/celular.png`.
 */
import { app, BrowserWindow } from 'electron'
import { createServer } from 'http'
import { promises as fs, mkdirSync, writeFileSync } from 'fs'
import { extname, join, normalize, resolve } from 'path'

const RAIZ = resolve(import.meta.dirname, '..')
const PASTA_DO_SITE = join(RAIZ, 'out', 'web')
const SAIDA = join(RAIZ, 'out', 'olhar-web')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2'
}

const servidor = createServer((pedido, resposta) => {
  if (process.env.DEPURAR_OLHAR_WEB) console.log('pedido:', pedido.url)
  const caminho = normalize(join(PASTA_DO_SITE, pedido.url === '/' ? 'index.html' : pedido.url.split('?')[0]))
  if (!caminho.startsWith(PASTA_DO_SITE)) {
    resposta.writeHead(403).end()
    return
  }
  fs.readFile(caminho)
    .then((conteudo) => {
      const tipo = MIME[extname(caminho)] ?? 'application/octet-stream'
      // O Chromium pede o áudio com `Range` e ABORTA a conexão quando o servidor não fala isso —
      // e o aborto derruba o `loadURL` inteiro com ERR_FAILED, visto na prática.
      const range = /^bytes=(\d+)-(\d*)$/.exec(pedido.headers.range ?? '')
      if (range) {
        const inicio = Number(range[1])
        const fim = range[2] ? Number(range[2]) : conteudo.length - 1
        resposta.writeHead(206, {
          'Content-Type': tipo,
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${inicio}-${fim}/${conteudo.length}`
        })
        resposta.end(conteudo.subarray(inicio, fim + 1))
        return
      }
      resposta.writeHead(200, { 'Content-Type': tipo, 'Accept-Ranges': 'bytes' })
      resposta.end(conteudo)
    })
    .catch(() => resposta.writeHead(404).end())
})

const problemas = []

async function fotografar(url, nome, largura, altura) {
  const win = new BrowserWindow({
    show: false,
    width: largura,
    height: altura,
    useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  win.webContents.on('console-message', (_e, nivel, mensagem) => {
    if (nivel >= 3) problemas.push(`[${nome}] console: ${mensagem}`)
  })
  win.webContents.on('render-process-gone', (_e, detalhes) => {
    problemas.push(`[${nome}] renderer caiu: ${detalhes.reason}`)
  })
  // Um recurso abortado no meio (mídia, por exemplo) rejeita o `loadURL` mesmo com a página de pé;
  // a foto e os erros de console contam a história de verdade, então isto não é fatal. Uma segunda
  // tentativa cobre o aborto que acontece cedo demais, antes de o documento chegar.
  try {
    await win.loadURL(url)
  } catch (causa) {
    console.warn(`[${nome}] loadURL reclamou (${causa.code ?? causa}), tentando de novo`)
    await win.loadURL(url).catch((deNovo) => console.warn(`[${nome}] de novo: ${deNovo.code ?? deNovo}`))
  }
  // O arranque tem splash (com duração própria) + cena 3D; dez segundos atravessam os dois.
  await new Promise((r) => setTimeout(r, 10_000))
  console.log(`[${nome}] fotografando ${win.webContents.getURL()}`)
  writeFileSync(join(SAIDA, `${nome}.png`), (await win.webContents.capturePage()).toPNG())
  win.destroy()
}

// Sem isto o Electron SAI sozinho quando a primeira janela fecha — no meio da segunda foto.
app.on('window-all-closed', () => {})

app
  .whenReady()
  .then(async () => {
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
    const url = `http://127.0.0.1:${servidor.address().port}/`
    mkdirSync(SAIDA, { recursive: true })
    await fotografar(url, 'desktop', 1280, 800)
    await fotografar(url, 'celular', 390, 844)
    servidor.close()
    if (problemas.length > 0) {
      console.error('A versão web abriu com problemas:')
      for (const problema of problemas) console.error(`  ${problema}`)
      app.exit(1)
      return
    }
    console.log('gravado desktop.png e celular.png — sem erro de console')
    app.exit(0)
  })
  .catch((causa) => {
    console.error('Não deu pra olhar a versão web:', causa)
    app.exit(1)
  })
