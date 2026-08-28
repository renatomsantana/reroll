/**
 * OLHAR o aviso de atualização nos DOIS temas (dia e noite), com o CSS de produção, numa janela
 * oculta — o relato foi "o update às vezes aparece BRANCO ou bugado" no modo noite (o changelog
 * usava uma variável de cor que não existe e caía no fallback branco).
 *
 *     npx electron-vite build && npx electron scripts/olharUpdatePrompt.mjs
 *
 * Grava `out/olhar-update/dia.png` e `noite.png`. Não julga nada: é pra olhar.
 */
import { app, BrowserWindow } from 'electron'
import { readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const RAIZ = resolve(import.meta.dirname, '..')
const ASSETS = join(RAIZ, 'out', 'renderer', 'assets')
const css = readdirSync(ASSETS).find((n) => n.startsWith('index-') && n.endsWith('.css'))
if (!css) throw new Error('Rode `npx electron-vite build` antes.')

const NOTAS = `Correções desta versão:
- A prévia da aba Estilo agora tem as mesmas cores da mesa
- A janela cheia cabe em qualquer monitor
- Enter no HUD não rola mais os dados sem querer`

const pagina = (tema) => `<!DOCTYPE html><html data-theme="${tema}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(ASSETS, css)).href}">
<style>html,body{margin:0;height:100%}</style></head><body>
<div class="modal-overlay update-prompt-overlay">
  <div class="card update-prompt">
    <h2 class="update-prompt-title">Atualização disponível</h2>
    <p class="update-prompt-text">A versão 1.1.0 está pronta pra baixar. Quer atualizar agora?</p>
    <p class="update-prompt-notes-title">Novidades</p>
    <pre class="update-prompt-notes">${NOTAS}</pre>
    <div class="update-prompt-bar"><div class="update-prompt-bar-fill" style="width:55%"></div></div>
    <div class="update-prompt-actions">
      <button class="btn btn-secondary">Agora não</button>
      <button class="btn btn-primary">Atualizar</button>
    </div>
  </div>
</div>
</body></html>`

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const pasta = join(RAIZ, 'out', 'olhar-update')
  mkdirSync(pasta, { recursive: true })
  const win = new BrowserWindow({
    show: false,
    width: 520,
    height: 440,
    useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  for (const tema of ['day', 'night']) {
    const arquivo = join(pasta, `${tema}.html`)
    writeFileSync(arquivo, pagina(tema))
    await win.loadFile(arquivo)
    await espera(400)
    const nome = tema === 'day' ? 'dia' : 'noite'
    writeFileSync(join(pasta, `${nome}.png`), (await win.webContents.capturePage()).toPNG())
    console.log(`gravado ${nome}.png`)
  }
  win.destroy()
  app.exit(0)
})
