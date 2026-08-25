/**
 * OLHAR O CLARÃO de crítico e de falha (spec §3.7) numa janela OCULTA, com o CSS de produção, com a
 * animação CONGELADA no meio (`animation-play-state: paused` + `animation-delay` negativo) — é o
 * jeito de ver o quadro que a pessoa vê no meio do segundo, sem capturar a tela do PC.
 *
 *     npx electron-vite build && npx electron scripts/olharClarao.mjs
 *
 * Grava `out/olhar-clarao/critico.png` e `falha.png`. Não julga nada: é pra olhar.
 */
import { app, BrowserWindow } from 'electron'
import { readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const RAIZ = resolve(import.meta.dirname, '..')
const ASSETS = join(RAIZ, 'out', 'renderer', 'assets')
const css = readdirSync(ASSETS).find((n) => n.startsWith('index-') && n.endsWith('.css'))
if (!css) throw new Error('Rode `npx electron-vite build` antes.')

const faiscas = Array.from({ length: 8 }, (_, i) => `<span class="dice-crit-faisca" style="--angulo:${i * 45}deg"></span>`).join('')
const pagina = (tipo, texto) => `<!DOCTYPE html><html data-theme="day"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(ASSETS, css)).href}">
<style>html,body{margin:0;height:100%;background:#c0c0c0}
.dice-roller-3d-canvas{position:relative;width:100%;height:100%;background:#1c2430}
/* Congela cada animação num instante do meio: as faíscas a 40% do voo, o painel já assentado. */
.dice-crit, .dice-crit-texto, .dice-crit-faisca { animation-play-state: paused !important; animation-delay: -0.32s !important; }
</style></head><body><div class="dice-roller-3d-canvas"><div class="dice-crit dice-crit-${tipo}">${tipo === 'critico' ? faiscas : ''}<span class="dice-crit-texto">${texto}</span></div></div></body></html>`

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const pasta = join(RAIZ, 'out', 'olhar-clarao')
  mkdirSync(pasta, { recursive: true })
  const win = new BrowserWindow({ show: false, width: 520, height: 320, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } })
  for (const [tipo, texto] of [['critico', '⭐ Crítico!'], ['falha', '💀 Falha crítica!']]) {
    const arquivo = join(pasta, `${tipo}.html`)
    writeFileSync(arquivo, pagina(tipo, texto))
    await win.loadFile(arquivo)
    await espera(400)
    writeFileSync(join(pasta, `${tipo}.png`), (await win.webContents.capturePage()).toPNG())
    console.log(`gravado ${tipo}.png`)
  }
  win.destroy()
  app.exit(0)
})
