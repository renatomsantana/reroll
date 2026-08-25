/**
 * MEDIÇÃO DAS BARRAS DE RECURSO NO MODO COMPACTO — medido, não olhado.
 *
 * A janelinha compacta foi medida sem barra nenhuma (280×240; ver `windowSizes.ts`), e cada barra
 * de recurso (spec §3.4) faz a janela crescer `ALTURA_DA_BARRA_COMPACTA` pixels. Este script abre
 * uma janela OCULTA do Electron (nunca captura da tela — o PC está sempre em uso), monta a
 * estrutura REAL do widget compacto com o CSS DE PRODUÇÃO, com zero, uma e três barras, no tamanho
 * que a janela teria em cada caso, e mede:
 *
 * - a altura do painel do dado (`.compact-stage`) — tem que ser a MESMA com e sem barras, senão
 *   a conta de `alturaExtraCompacta` está errada e o dado encolhe;
 * - se alguma coisa vaza (`scrollHeight > clientHeight` no `.app-main`).
 *
 * Também grava um PNG por caso em `out/medir-barras/` pra olhar. Rodar depois de
 * `npx electron-vite build`:
 *
 *     npx electron scripts/medirBarrasCompactas.mjs
 *
 * Sai com código 1 se o painel do dado mudou de altura ou algo vazou.
 */
import { app, BrowserWindow } from 'electron'
import { readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const RAIZ = resolve(import.meta.dirname, '..')
const ASSETS = join(RAIZ, 'out', 'renderer', 'assets')

// Os mesmos números de `windowSizes.ts` — repetidos aqui porque o script roda fora do bundle.
const COMPACT = { width: 280, height: 240 }
const ALTURA_DA_BARRA_COMPACTA = 19
const alturaExtra = (n) => (n <= 0 ? 0 : n * ALTURA_DA_BARRA_COMPACTA + 3)
/** Barra de título + barra de ferramentas do app, medidas: 65px (ver `CompactWidget.css`). */
const CROMO = 65

function cssDeProducao() {
  const candidatos = readdirSync(ASSETS).filter((n) => n.startsWith('index-') && n.endsWith('.css'))
  if (candidatos.length === 0) throw new Error('Rode `npx electron-vite build` antes: não há CSS em out/renderer/assets.')
  return join(ASSETS, candidatos[0])
}

function barra(nome, atual, maximo, estado) {
  const pct = maximo > 0 ? (atual / maximo) * 100 : 0
  return `<div class="barra-recurso barra-${estado} barra-compacta"><span class="barra-nome">${nome}</span><div class="barra-trilho"><div class="barra-preenchido" style="width:${pct}%"></div></div><button class="barra-passo">−</button><button class="barra-valor">${atual}<span class="barra-valor-max">/${maximo}</span></button><button class="barra-passo">+</button></div>`
}

function widget(barras) {
  const faixa = barras.length ? `<div class="barras-compactas">${barras.join('')}</div>` : ''
  const presets = Array.from({ length: 4 }, (_, i) => `<button class="compact-preset"><span class="compact-preset-icon">R</span><span class="compact-preset-name">Preset ${i + 1}</span></button>`).join('')
  return `<div class="app-window app-window-compact" style="height:${COMPACT.height + alturaExtra(barras.length) - CROMO}px">
  <div class="app-layout"><main class="app-main"><div class="compact-widget">
    <div class="compact-stage"><div class="compact-stage-total"><span class="compact-stage-total-label">Total</span><strong class="compact-stage-total-value">17</strong></div><span class="compact-stage-detail">Percepção · 12+5</span></div>
    ${faixa}
    <div class="compact-widget-presets">${presets}</div>
  </div></main></div></div>`
}

const CASOS = [
  { id: 'zero', barras: [] },
  { id: 'uma', barras: [barra('PV', 30, 45, 'normal')] },
  { id: 'tres', barras: [barra('PV', 12, 45, 'aviso'), barra('PE', 2, 12, 'perigo'), barra('Sanidade', 38, 40, 'normal')] }
]

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const pasta = join(RAIZ, 'out', 'medir-barras')
  mkdirSync(pasta, { recursive: true })
  const css = pathToFileURL(cssDeProducao()).href
  let falhas = 0
  let alturaDoPainelSemBarra = null

  /**
   * UMA janela, redimensionada entre os casos. Uma janela nova por caso falhava em `loadFile` do
   * segundo (ERR_FAILED) — o destruir da anterior ainda no ar. Redimensionar é o que o app faz de
   * verdade quando entra uma barra, então também é a medida mais honesta.
   */
  const win = new BrowserWindow({
    show: false,
    width: COMPACT.width,
    height: COMPACT.height - CROMO,
    useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })

  for (const caso of CASOS) {
    const alturaDaJanela = COMPACT.height + alturaExtra(caso.barras.length)
    win.setContentSize(COMPACT.width, alturaDaJanela - CROMO)
    const html = `<!DOCTYPE html><html data-theme="day"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"><style>html,body{margin:0;height:100%;overflow:hidden}</style></head><body>${widget(caso.barras)}</body></html>`
    const arquivo = join(pasta, `${caso.id}.html`)
    writeFileSync(arquivo, html)
    await win.loadFile(arquivo)
    await espera(300)

    const medidas = await win.webContents.executeJavaScript(`(() => {
      const main = document.querySelector('.app-main')
      const stage = document.querySelector('.compact-stage')
      const faixa = document.querySelector('.barras-compactas')
      const presets = document.querySelector('.compact-widget-presets')
      return {
        painel: stage.getBoundingClientRect().height,
        faixa: faixa ? faixa.getBoundingClientRect().height : 0,
        presets: presets.getBoundingClientRect().height,
        vazou: main.scrollHeight > main.clientHeight + 1,
        janela: document.documentElement.clientHeight
      }
    })()`)

    const imagem = await win.webContents.capturePage()
    writeFileSync(join(pasta, `${caso.id}.png`), imagem.toPNG())

    if (alturaDoPainelSemBarra === null) alturaDoPainelSemBarra = medidas.painel
    const painelIgual = Math.abs(medidas.painel - alturaDoPainelSemBarra) <= 1
    const ok = painelIgual && !medidas.vazou
    if (!ok) falhas++
    console.log(
      `${ok ? 'OK ' : 'ERR'} ${caso.id.padEnd(5)} janela=${alturaDaJanela} conteúdo=${medidas.janela} painel=${medidas.painel.toFixed(1)} faixa=${medidas.faixa.toFixed(1)} presets=${medidas.presets.toFixed(1)} vazou=${medidas.vazou}`
    )
  }
  /**
   * A versão CHEIA (a caixa de grupo da tela de rolagem), só pra olhar — não é julgada: a largura
   * ali é elástica, e o que importa é a família de botões, que `afundarDosBotoes.mjs` já mede.
   */
  win.setContentSize(760, 130)
  const cheia = `<!DOCTYPE html><html data-theme="day"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"><style>html,body{margin:0;background:#c0c0c0;padding:12px}</style></head><body>
    <fieldset class="barras-de-recurso"><legend>Recursos <button class="barras-editar">✎</button></legend><div class="barras-lista">
      ${barra('PV', 12, 45, 'aviso').replace(' barra-compacta', '')}${barra('PE', 2, 12, 'perigo').replace(' barra-compacta', '')}${barra('Sanidade', 38, 40, 'normal').replace(' barra-compacta', '')}${barra('Sorte', 5, 5, 'normal').replace(' barra-compacta', '').replace('barra-normal', 'barra-normal barra-cor-fixa" style="--recurso-cor:#000080')}
    </div></fieldset></body></html>`
  const arquivoCheia = join(pasta, 'cheia.html')
  writeFileSync(arquivoCheia, cheia)
  await win.loadFile(arquivoCheia)
  await espera(300)
  writeFileSync(join(pasta, 'cheia.png'), (await win.webContents.capturePage()).toPNG())
  win.destroy()

  console.log(falhas === 0 ? 'Painel do dado mantido em todos os casos.' : `${falhas} caso(s) com o painel espremido ou vazando.`)
  app.exit(falhas === 0 ? 0 : 1)
})
