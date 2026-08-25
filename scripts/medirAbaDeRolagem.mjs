/**
 * MEDIR A ABA DE ROLAGEM — o app de verdade, numa janela OCULTA, no tamanho padrão (1300×800).
 *
 * Relato do usuário depois das specs novas: "rolar os dados, recursos e presets estão passando um
 * em cima do outro". Este script abre o RENDERER COMPILADO (`out/renderer/index.html`) com o preload
 * de produção e handlers de IPC falsos (um personagem com três barras e quatro presets), espera o
 * splash passar, e mede as três seções da aba de Rolagem: onde cada uma começa e termina, e se o
 * conteúdo da cena (que tem `min-height` próprio) vaza pra cima das que vêm depois.
 *
 *     npx electron-vite build && npx electron scripts/medirAbaDeRolagem.mjs
 *
 * Grava `out/medir-aba/rolagem.png` e sai com código 1 se alguma seção se sobrepõe à seguinte.
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

const RAIZ = resolve(import.meta.dirname, '..')

/**
 * Uma foto DE VERDADE no perfil falso, quando há uma à mão (a pasta `ideias/` não viaja no clone):
 * é o que deixa ver o recorte quadrado no rosto — crachá, HUD — em vez da inicial.
 */
const FOTO = join(RAIZ, 'ideias', 'istockphoto-165079581-612x612.jpg')
const photo = existsSync(FOTO) ? `data:image/jpeg;base64,${readFileSync(FOTO).toString('base64')}` : null
const PERFIL = { id: 'p1', name: 'Matias Oliveira', system: 'Ordem Paranormal', photo, createdAt: 1 }
const NOTAS = {
  characterName: 'Matias Oliveira',
  recursos: [
    { id: 'pv', nome: 'PV', atual: 12, maximo: 45 },
    { id: 'pe', nome: 'PE', atual: 2, maximo: 12 },
    { id: 'san', nome: 'Sanidade', atual: 38, maximo: 40 }
  ],
  pages: [{ id: 'd1', title: '', text: '', createdAt: 1 }]
}
const PRESETS = ['Espada', 'Bola de fogo', 'Percepção', 'Cura'].map((name, i) => ({
  id: `pr${i}`,
  name,
  icon: '⚔️',
  expression: { groups: [{ count: 1, sides: 20 }], modifiers: [] },
  createdAt: 1,
  updatedAt: 1
}))

const RESPOSTAS = {
  'profiles:get': () => ({ profiles: [PERFIL], activeId: 'p1' }),
  'profiles:save': (estado) => estado,
  'notes:get': () => NOTAS,
  'notes:save': (notas) => notas,
  'presets:getAll': () => PRESETS,
  'window:setCompact': () => undefined,
  'window:setAppIcon': () => undefined,
  'app:getVersion': () => '0.0.0-medida',
  'update:getStatus': () => ({ state: 'idle' }),
  'update:check': () => undefined
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  for (const [canal, resposta] of Object.entries(RESPOSTAS)) ipcMain.handle(canal, (_e, ...args) => resposta(...args))

  const win = new BrowserWindow({
    show: false,
    width: 1300,
    height: 800,
    useContentSize: false,
    frame: false,
    webPreferences: {
      preload: join(RAIZ, 'out', 'preload', 'index.js'),
      sandbox: true,
      contextIsolation: true,
      offscreen: true,
      backgroundThrottling: false
    }
  })
  await win.loadFile(join(RAIZ, 'out', 'renderer', 'index.html'))
  // O splash tem teto próprio (`MAX_DURATION_MS`); cinco segundos cobrem com folga.
  await espera(5000)

  const medidas = await win.webContents.executeJavaScript(`(() => {
    const secoes = Array.from(document.querySelectorAll('.app-tab-roll > .app-section'))
    const caixa = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) } }
    const main = document.querySelector('.app-main')
    return {
      janela: { largura: window.innerWidth, altura: window.innerHeight },
      main: main ? { ...caixa(main), scrollHeight: main.scrollHeight, clientHeight: main.clientHeight } : null,
      secoes: secoes.map((s) => {
        const conteudo = s.firstElementChild
        /*
         * O FIM REAL do conteúdo: o maior "bottom" entre todos os descendentes no fluxo. A caixa do
         * filho direto mente: .dice-roller-3d tem height 100% e fecha no tamanho da seção enquanto a
         * linha de resultado, dentro dele, já está 30px abaixo. (Sem crase neste comentário: ele
         * vive dentro de um template literal.)
         */
        let fim = conteudo ? conteudo.getBoundingClientRect().bottom : s.getBoundingClientRect().bottom
        if (conteudo) for (const el of conteudo.querySelectorAll('*')) {
          const estilo = getComputedStyle(el)
          if (estilo.position === 'absolute' || estilo.position === 'fixed' || estilo.display === 'none') continue
          fim = Math.max(fim, el.getBoundingClientRect().bottom)
        }
        return { classe: (conteudo && conteudo.className) || '?', caixa: caixa(s), conteudo: conteudo ? { ...caixa(conteudo), bottom: Math.round(fim) } : null }
      }),
      resultado: (() => { const r = document.querySelector('.dice-roller-3d-result'); return r ? caixa(r) : null })(),
      /* Os filhos diretos da cena, pra ver QUEM cresce quando a seção cresce. */
      filhosDaCena: Array.from(document.querySelector('.dice-roller-3d')?.children ?? []).map((el) => ({ classe: el.className.split(' ')[0], ...caixa(el) })),
      canvas: (() => { const c = document.querySelector('.dice-canvas-container canvas'); return c ? { ...caixa(c), attr: c.height, style: c.getAttribute('style') } : null })()
    }
  })()`)

  const pasta = join(RAIZ, 'out', 'medir-aba')
  mkdirSync(pasta, { recursive: true })
  writeFileSync(join(pasta, 'rolagem.png'), (await win.webContents.capturePage()).toPNG())
  writeFileSync(join(pasta, 'medidas.json'), JSON.stringify(medidas, null, 2))

  let sobreposicoes = 0
  console.log(`janela ${medidas.janela.largura}×${medidas.janela.altura}; .app-main ${medidas.main?.clientHeight}px visível, ${medidas.main?.scrollHeight}px de conteúdo`)
  medidas.secoes.forEach((secao, i) => {
    const proxima = medidas.secoes[i + 1]
    const fimDoConteudo = secao.conteudo ? secao.conteudo.bottom : secao.caixa.bottom
    const invade = proxima ? fimDoConteudo > proxima.caixa.top : false
    if (invade) sobreposicoes++
    console.log(
      `${invade ? 'ERR' : 'OK '} seção ${i + 1} (${secao.classe.split(' ')[0]}): caixa ${secao.caixa.top}→${secao.caixa.bottom} (${secao.caixa.height}px), conteúdo até ${fimDoConteudo}${proxima ? `; próxima começa em ${proxima.caixa.top}` : ''}`
    )
  })
  if (medidas.resultado) console.log(`    linha de resultado: ${medidas.resultado.top}→${medidas.resultado.bottom}`)
  for (const filho of medidas.filhosDaCena) console.log(`    cena › ${filho.classe}: ${filho.top}→${filho.bottom} (${filho.height}px)`)
  if (medidas.canvas) console.log(`    canvas: ${medidas.canvas.height}px na tela, atributo height=${medidas.canvas.attr}, style=${medidas.canvas.style}`)
  console.log(sobreposicoes === 0 ? 'Nenhuma seção invade a seguinte.' : `${sobreposicoes} seção(ões) invadindo a seguinte.`)
  win.destroy()
  app.exit(sobreposicoes === 0 ? 0 : 1)
})
