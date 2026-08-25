/**
 * OLHAR O HUD (spec §3.6) numa janela OCULTA com o CSS de produção: a estrutura real do cartão
 * (retrato, nome, barras finas, condições, Descansar) nos estados cheio, mini e escondido, por cima
 * de um fundo escuro que faz as vezes da cena. Não julga nada — é pra olhar antes de instalar.
 *
 *     npx electron-vite build && npx electron scripts/olharHud.mjs
 *
 * Grava `out/olhar-hud/hud.png`.
 */
import { app, BrowserWindow } from 'electron'
import { readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const RAIZ = resolve(import.meta.dirname, '..')
const ASSETS = join(RAIZ, 'out', 'renderer', 'assets')
const css = readdirSync(ASSETS).find((n) => n.startsWith('index-') && n.endsWith('.css'))
if (!css) throw new Error('Rode `npx electron-vite build` antes.')

const barra = (nome, atual, maximo, estado) =>
  `<div class="barra-recurso barra-${estado} barra-compacta"><span class="barra-nome">${nome}</span><div class="barra-trilho"><div class="barra-preenchido" style="width:${(atual / maximo) * 100}%"></div></div><button class="barra-passo">−</button><button class="barra-valor">${atual}<span class="barra-valor-max">/${maximo}</span></button><button class="barra-passo">+</button></div>`
const barras = `<div class="barras-compactas">${barra('PV', 12, 45, 'aviso')}${barra('PE', 2, 12, 'perigo')}${barra('Sanidade', 38, 40, 'normal')}</div>`
const cabecalho = (mini) =>
  `<div class="hud-cabecalho"><span class="hud-retrato hud-retrato-vazio">M</span>${mini ? '' : '<span class="hud-nome">Matias Oliveira</span>'}<span class="hud-botoes"><button class="hud-botao">${mini ? '▢' : '▁'}</button><button class="hud-botao">✕</button></span></div>`
const condicoes = `<div class="hud-condicoes"><button class="hud-condicao hud-condicao-ativa">Machucado<span class="hud-condicao-remover">×</span></button><button class="hud-condicao">Enlouquecendo<span class="hud-condicao-remover">×</span></button><button class="hud-condicao hud-condicao-nova">+</button></div>`

const html = `<!DOCTYPE html><html data-theme="day"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(ASSETS, css)).href}">
<style>html,body{margin:0;height:100%;background:#c0c0c0}.dice-roller-3d-canvas{position:relative;width:100%;height:100%;background:#1c2430}</style>
</head><body><div class="dice-roller-3d-canvas">
  <div class="hud hud-se">${cabecalho(false)}${barras}${condicoes}<button class="hud-descansar">Descansar</button></div>
  <div class="hud hud-mini hud-sw">${cabecalho(true)}${barras}</div>
  <button class="hud-mostrar hud-ne">M</button>
</div></body></html>`

app.whenReady().then(async () => {
  const pasta = join(RAIZ, 'out', 'olhar-hud')
  mkdirSync(pasta, { recursive: true })
  const arquivo = join(pasta, 'hud.html')
  writeFileSync(arquivo, html)
  const win = new BrowserWindow({ show: false, width: 640, height: 420, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } })
  await win.loadFile(arquivo)
  await new Promise((r) => setTimeout(r, 400))
  writeFileSync(join(pasta, 'hud.png'), (await win.webContents.capturePage()).toPNG())
  console.log('gravado hud.png')
  win.destroy()
  app.exit(0)
})
