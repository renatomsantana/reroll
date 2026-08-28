/**
 * MEDE a diferença de cor entre a mesa (cena real) e a prévia da aba Estilo, offscreen.
 *
 *   npx esbuild out/harness/coresEntry.ts --bundle --format=iife --platform=browser \
 *     --outfile=out/harness/coresBundle.js "--alias:@renderer=<raiz>/src/renderer/src" \
 *     "--alias:@shared=<raiz>/src/shared" "--define:import.meta.env.DEV=false"
 *   npx electron scripts/medirCoresDaPrevia.mjs
 *
 * Grava `out/harness/cores-*.png` e imprime as amostras. Harness descartável — não julga, mede.
 */
import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { join, resolve } from 'path'

const RAIZ = resolve(import.meta.dirname, '..')
const PASTA = join(RAIZ, 'out', 'harness')

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 600,
    height: 600,
    webPreferences: { backgroundThrottling: false }
  })
  win.webContents.on('console-message', (_e, _n, msg) => console.log('[page]', msg))
  await win.loadFile(join(PASTA, 'cores.html'))

  let bruto = null
  for (let i = 0; i < 50 && !bruto; i++) {
    await espera(200)
    try {
      bruto = await win.webContents.executeJavaScript('window.__resultado ?? null')
    } catch (erro) {
      console.log('executeJavaScript falhou:', String(erro))
      break
    }
  }

  if (!bruto) {
    console.log('SEM RESULTADO — a página não terminou.')
    win.destroy()
    app.exit(1)
    return
  }

  const resultado = JSON.parse(bruto)
  if (resultado.erro) {
    console.log('ERRO NA PÁGINA:\n' + resultado.erro)
    win.destroy()
    app.exit(1)
    return
  }

  for (const [nome, amostra] of Object.entries(resultado)) {
    const png = Buffer.from(amostra.png.split(',')[1], 'base64')
    writeFileSync(join(PASTA, `cores-${nome}.png`), png)
    console.log(
      `${nome}: centro rgb(${amostra.centro}) | patch centro rgb(${amostra.mediaCentro}) | faixa do meio rgb(${amostra.faixaMeio})`
    )
  }

  win.destroy()
  app.exit(0)
})
