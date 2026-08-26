/**
 * TESTAR NO APP — o renderer COMPILADO, numa janela oculta, com um processo principal FALSO em
 * memória, exercitado como uma pessoa faria: clicando, rolando, importando, arrastando.
 *
 * A suíte do vitest prova cada peça; isto prova o CAMINHO INTEIRO no bundle de produção, que é onde
 * as peças se encontram (o worker do pdf.js, a cena WebGL, o HUD por cima do canvas, a área de
 * transferência pelo IPC). Pedido do usuário: "vamos continuar testando os tipos de hud, os d20, os
 * tipos diferentes de dados, os uploads, os scrapings".
 *
 *     npx electron-vite build && npx electron scripts/testarNoApp.mjs [dados] [hud] [fichas]
 *
 * Sem argumento roda as três fases. Capturas em `out/testar-no-app/`. Sai com código 1 se alguma
 * checagem falhar — cada uma é impressa como OK/ERR com o que foi medido.
 *
 * - `dados`: cada tipo de dado (d4…d100) rolado no modo rápido, vários dados, modificador, vantagem
 *   e desvantagem, a marca de crítico/falha (rola até sair), a linha copiada pro chat, e UMA rolagem
 *   na cena 3D de verdade (física + leitura da face) com o popup e o clarão.
 * - `hud`: cheio, mini e escondido em cada canto, com nome longo, doze barras e vinte condições,
 *   na janela padrão e na mínima — o cartão tem que ficar DENTRO da cena; e o arrasto de verdade
 *   (`sendInputEvent`) de um canto ao oposto, gravado nas anotações.
 * - `fichas`: cada PDF de `Fichas RPG/` (fora os livros de regras) importado pela tela de
 *   conferência — leitor reconhecido, campos, presets, barras propostas, retrato — e confirmado;
 *   o que o `sheets:apply` recebeu é resumido, e a Ficha resultante é capturada.
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'

const RAIZ = resolve(import.meta.dirname, '..')
const SAIDA = join(RAIZ, 'out', 'testar-no-app')
mkdirSync(SAIDA, { recursive: true })
const BLANK = join(SAIDA, 'blank.html')
writeFileSync(BLANK, '<!DOCTYPE html><html><body></body></html>')
const FASES = process.argv.slice(2).length ? process.argv.slice(2) : ['dados', 'dados3d', 'sons', 'foto', 'presets', 'hud', 'fichas', 'fabricados']

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
let falhas = 0
function checar(ok, texto) {
  if (!ok) falhas++
  console.log(`${ok ? 'OK ' : 'ERR'} ${texto}`)
}

/* ------------------------------------------------------------------------------------------ */
/* O processo principal FALSO: o suficiente pro renderer acreditar que está no app.            */
/* ------------------------------------------------------------------------------------------ */
const FOTO = join(RAIZ, 'ideias', 'istockphoto-165079581-612x612.jpg')
const fotoDeTeste = existsSync(FOTO) ? `data:image/jpeg;base64,${readFileSync(FOTO).toString('base64')}` : null
const NOTAS_VAZIAS = () => ({ characterName: '', pages: [{ id: 'd1', title: '', text: '', createdAt: 1 }] })

const estado = {
  profiles: { profiles: [{ id: 'p1', name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: fotoDeTeste, createdAt: 1 }], activeId: 'p1' },
  notas: new Map([['p1', NOTAS_VAZIAS()]]),
  presets: new Map([['p1', []]]),
  copiado: [],
  pdfParaAbrir: null,
  ultimoApply: null
}
const notasDoAtivo = () => estado.notas.get(estado.profiles.activeId) ?? NOTAS_VAZIAS()
const presetsDoAtivo = () => estado.presets.get(estado.profiles.activeId) ?? []

const HANDLERS = {
  'profiles:get': () => estado.profiles,
  'profiles:save': (novo) => (estado.profiles = novo),
  'profiles:pickPhoto': () => fotoDeTeste,
  'notes:get': () => notasDoAtivo(),
  'notes:save': (notas) => {
    estado.notas.set(estado.profiles.activeId, notas)
    return notas
  },
  'presets:getAll': () => presetsDoAtivo(),
  'presets:create': (entrada) => {
    const preset = { id: randomUUID(), ...entrada, createdAt: Date.now(), updatedAt: Date.now() }
    estado.presets.set(estado.profiles.activeId, [...presetsDoAtivo(), preset])
    return preset
  },
  'presets:delete': (id) => estado.presets.set(estado.profiles.activeId, presetsDoAtivo().filter((p) => p.id !== id)),
  'presets:setFavorito': () => presetsDoAtivo(),
  'presets:moverFavorito': () => presetsDoAtivo(),
  'clipboard:writeText': (texto) => {
    estado.copiado.push(texto)
    return true
  },
  'sheets:pickPdf': () => {
    if (!estado.pdfParaAbrir) return { ok: false, motivo: 'cancelado' }
    return { ok: true, fileName: estado.pdfParaAbrir.nome, bytes: estado.pdfParaAbrir.bytes }
  },
  /** O `sheets:apply` de verdade mora no main; aqui é o mesmo desenho, sem o disco. */
  'sheets:apply': (payload) => {
    estado.ultimoApply = payload
    const existente = payload.targetProfileId ? estado.profiles.profiles.find((p) => p.id === payload.targetProfileId) : undefined
    const perfil = existente
      ? { ...existente, name: payload.characterName.trim(), system: payload.system.trim(), photo: payload.photo ?? existente.photo }
      : { id: randomUUID(), name: payload.characterName.trim(), system: payload.system.trim(), photo: payload.photo ?? null, createdAt: Date.now() }
    estado.profiles = {
      profiles: existente ? estado.profiles.profiles.map((p) => (p.id === perfil.id ? perfil : p)) : [...estado.profiles.profiles, perfil],
      activeId: perfil.id
    }
    const atuais = estado.notas.get(perfil.id) ?? NOTAS_VAZIAS()
    const blocos = payload.notes.blocks ?? {}
    estado.notas.set(perfil.id, {
      ...atuais,
      characterName: perfil.name,
      attributes: blocos.attributes ?? '',
      abilities: blocos.abilities ?? '',
      inventory: blocos.inventory ?? '',
      appearance: blocos.appearance ?? '',
      backstory: blocos.backstory ?? '',
      sections: payload.notes.sections.map((s) => ({ id: randomUUID(), title: s.title, fields: s.fields.map((c) => ({ id: randomUUID(), label: c.label, value: c.value, roll: c.roll })) })),
      recursos: (payload.recursos ?? []).map((r) => ({ id: randomUUID(), nome: r.nome, atual: r.atual, maximo: r.maximo }))
    })
    estado.presets.set(perfil.id, payload.presets.map((p) => ({ id: randomUUID(), ...p, createdAt: Date.now(), updatedAt: Date.now() })))
    return perfil
  },
  'window:setCompact': () => undefined,
  'window:setAppIcon': () => undefined,
  'window:minimize': () => undefined,
  'window:maximize': () => undefined,
  'window:close': () => undefined,
  'scene:pickBackgroundImage': () => null,
  'app:getVersion': () => '0.0.0-teste',
  'update:getStatus': () => ({ state: 'idle' }),
  'update:check': () => undefined,
  'update:download': () => undefined,
  'update:installNow': () => undefined
}

/* ------------------------------------------------------------------------------------------ */
/* A janela e os gestos.                                                                       */
/* ------------------------------------------------------------------------------------------ */
let win
async function abrirApp(preferencias = {}, tamanho = { largura: 1300, altura: 800 }) {
  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      show: false,
      width: tamanho.largura,
      height: tamanho.altura,
      frame: false,
      webPreferences: { preload: join(RAIZ, 'out', 'preload', 'index.js'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false }
    })
  }
  win.setContentSize(tamanho.largura, tamanho.altura)
  await win.loadFile(BLANK)
  await win.webContents.executeJavaScript(
    `localStorage.clear(); localStorage.setItem('rolador-settings', JSON.stringify(${JSON.stringify({ soundEnabled: false, ...preferencias })})); 'ok'`
  )
  await win.loadFile(join(RAIZ, 'out', 'renderer', 'index.html'))
  await esperarAte(`!!document.querySelector('.app-tab-roll')`, 8000)
  await espera(400)
}
const js = (codigo) => win.webContents.executeJavaScript(codigo)
async function esperarAte(condicao, tempo = 10000, passo = 150) {
  const fim = Date.now() + tempo
  while (Date.now() < fim) {
    if (await js(`(() => { try { return !!(${condicao}) } catch { return false } })()`)) return true
    await espera(passo)
  }
  return false
}
async function foto(nome) {
  writeFileSync(join(SAIDA, `${nome}.png`), (await win.webContents.capturePage()).toPNG())
}
/** Clica por seletor CSS ou, se o texto não for seletor válido, pelo rótulo do botão. */
const clicar = (seletorOuTexto) =>
  js(`(() => {
    let el = null
    try { el = document.querySelector(${JSON.stringify(seletorOuTexto)}) } catch { el = null }
    el ??= Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === ${JSON.stringify(seletorOuTexto)} || b.getAttribute('aria-label') === ${JSON.stringify(seletorOuTexto)})
    if (!el) return false
    el.click(); return true
  })()`)
const aba = async (nome) => {
  await js(`Array.from(document.querySelectorAll('.toolbar button, [role=tab]')).find((b) => b.textContent.includes(${JSON.stringify(nome)}))?.click()`)
  await espera(300)
}

/* ------------------------------------------------------------------------------------------ */
/* Fase DADOS.                                                                                 */
/* ------------------------------------------------------------------------------------------ */
async function lerResultado() {
  return js(`(() => {
    const r = document.querySelector('.dice-roller-3d-result')
    const valores = Array.from(r.querySelectorAll('.dice-roll-value')).map((v) => Number(v.textContent))
    const total = Number((r.querySelector('strong') || {}).textContent)
    return { texto: r.textContent, valores, total, critico: !!r.querySelector('[aria-label="Crítico!"]'), falha: !!r.querySelector('[aria-label="Falha crítica!"]') }
  })()`)
}
async function limparGrupos() {
  for (let i = 0; i < 8; i++) {
    const tinha = await js(`(() => { const b = document.querySelector('.dice-roller-3d-group-chip button[title*="Tira este tipo"]'); if (!b) return false; b.click(); return true })()`)
    if (!tinha) break
    await espera(60)
  }
}
async function rolarRapido() {
  const antes = await js(`document.querySelector('.dice-roller-3d-result').textContent`)
  await clicar('ROLAR')
  await esperarAte(`document.querySelector('.dice-roller-3d-result').textContent !== ${JSON.stringify(antes)} && !document.querySelector('.dice-roller-3d-result').textContent.includes('Rolando')`, 4000, 50)
  return lerResultado()
}

async function faseDados() {
  console.log('\n=== DADOS (modo rápido) ===')
  await abrirApp({ displayMode: 'quick' })
  for (const lados of [4, 6, 8, 10, 12, 20, 100]) {
    await limparGrupos()
    await clicar(`d${lados}`)
    await espera(80)
    const r = await rolarRapido()
    checar(r.valores.length === 1 && r.valores[0] >= 1 && r.valores[0] <= lados && r.total === r.valores[0], `d${lados}: [${r.valores}] total ${r.total}`)
  }
  // Três d6 e modificador +5.
  await limparGrupos()
  await clicar('d6')
  await js(`Array.from(document.querySelectorAll('.dice-roller-3d-group-chip button')).find((b) => b.textContent.trim() === '+')?.click()`)
  await js(`Array.from(document.querySelectorAll('.dice-roller-3d-group-chip button')).find((b) => b.textContent.trim() === '+')?.click()`)
  await js(`(() => { const i = document.querySelector('.dice-roller-3d-modifier-campo input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '5'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await espera(100)
  let r = await rolarRapido()
  checar(r.valores.length === 3 && r.valores.every((v) => v >= 1 && v <= 6) && r.total === r.valores.reduce((a, b) => a + b, 0) + 5, `3d6+5: [${r.valores}] total ${r.total}`)
  await foto('dados-3d6-mais-5')
  // Vantagem e desvantagem num d20.
  await js(`(() => { const i = document.querySelector('.dice-roller-3d-modifier-campo input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '0'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await limparGrupos()
  await clicar('d20')
  await clicar('Vantagem')
  r = await rolarRapido()
  checar(r.valores.length === 1 && r.texto.toLowerCase().includes('vantagem'), `vantagem: [${r.valores}] "${r.texto.trim().slice(0, 60)}"`)
  await clicar('Desvantagem')
  r = await rolarRapido()
  checar(r.valores.length === 1 && r.texto.toLowerCase().includes('desvantagem'), `desvantagem: [${r.valores}]`)
  await clicar('Normal')
  // Crítico e falha: rola até sair (um d20 por rolagem, ~20 tentativas em média cada).
  let critico = null
  let falha = null
  for (let i = 0; i < 300 && (!critico || !falha); i++) {
    r = await rolarRapido()
    if (r.valores[0] === 20) critico = r
    if (r.valores[0] === 1) falha = r
  }
  checar(!!critico && critico.critico && !critico.falha, `20 natural marcado ⭐ (${critico ? 'saiu' : 'não saiu em 300'})`)
  checar(!!falha && falha.falha && !falha.critico, `1 natural marcado 💀 (${falha ? 'saiu' : 'não saiu em 300'})`)
  if (critico) await foto('dados-critico-chip')
  // Copiar pro chat: a linha vai pela área de transferência falsa.
  estado.copiado.length = 0
  await clicar('Copiar pro chat')
  await espera(200)
  const linha = estado.copiado[0] ?? ''
  checar(/^🎲 .+ → \[\d+\]( [+-]\d+)? = \*\*\d+\*\*/.test(linha), `copiar pro chat: "${linha}"`)
  // Histórico: as rolagens estão lá, com ⭐ e 💀.
  await clicar('.toolbar-settings-btn')
  await espera(200)
  await clicar('Abrir')
  await espera(300)
  const historico = await js(`(() => ({ linhas: document.querySelectorAll('.history-entry').length, criticos: document.querySelectorAll('.history-entry [aria-label="Crítico!"]').length, falhas: document.querySelectorAll('.history-entry [aria-label="Falha crítica!"]').length }))()`)
  checar(historico.linhas >= 10 && historico.criticos >= 1 && historico.falhas >= 1, `histórico: ${historico.linhas} linhas, ${historico.criticos} ⭐, ${historico.falhas} 💀`)
  await foto('dados-historico')

  console.log('\n=== DADOS (cena 3D de verdade) ===')
  await abrirApp({ displayMode: '3d' })
  const t0 = Date.now()
  await clicar('ROLAR')
  const assentou = await esperarAte(`/Total/.test(document.querySelector('.dice-roller-3d-result').textContent)`, 15000, 200)
  const r3d = assentou ? await lerResultado() : null
  checar(!!r3d && r3d.valores.length === 1 && r3d.valores[0] >= 1 && r3d.valores[0] <= 20, `d20 na bandeja 3D: ${r3d ? `[${r3d.valores}] em ${Date.now() - t0}ms` : 'não assentou em 15s'}`)
  const popup = await js(`!!document.querySelector('.dice-result-popup')`)
  checar(popup, 'popup do total apareceu sobre a cena')
  await foto('dados-3d-assentado')
}

/* ------------------------------------------------------------------------------------------ */
/* Fase DADOS 3D: cada tipo de dado cai na bandeja de verdade e a face é lida da física.       */
/* ------------------------------------------------------------------------------------------ */
async function rolarNaCena() {
  const antes = await js(`document.querySelector('.dice-roller-3d-result').textContent`)
  const t0 = Date.now()
  await clicar('ROLAR')
  const assentou = await esperarAte(`(() => { const t = document.querySelector('.dice-roller-3d-result').textContent; return t !== ${JSON.stringify(antes)} && /Total/.test(t) })()`, 20000, 200)
  return { ...(assentou ? await lerResultado() : { valores: [], total: NaN }), ms: Date.now() - t0, assentou }
}
async function faseDados3d() {
  console.log('\n=== DADOS na cena 3D (física + leitura da face), um de cada ===')
  await abrirApp({ displayMode: '3d' })
  for (const lados of [4, 6, 8, 10, 12, 20, 100]) {
    await limparGrupos()
    await clicar(`d${lados}`)
    await espera(80)
    const r = await rolarNaCena()
    checar(r.assentou && r.valores.length === 1 && r.valores[0] >= 1 && r.valores[0] <= lados, `d${lados} na bandeja: ${r.assentou ? `[${r.valores}] em ${r.ms}ms` : 'não assentou em 20s'}`)
    if (lados === 100) await foto('dados3d-d100')
  }
  // Três d6 de uma vez: três dados assentam, três valores.
  await limparGrupos()
  await clicar('d6')
  await js(`Array.from(document.querySelectorAll('.dice-roller-3d-group-chip button')).find((b) => b.textContent.trim() === '+')?.click()`)
  await js(`Array.from(document.querySelectorAll('.dice-roller-3d-group-chip button')).find((b) => b.textContent.trim() === '+')?.click()`)
  const r = await rolarNaCena()
  checar(r.assentou && r.valores.length === 3 && r.valores.every((v) => v >= 1 && v <= 6), `3d6 na bandeja: ${r.assentou ? `[${r.valores}] em ${r.ms}ms` : 'não assentou'}`)
  await foto('dados3d-3d6')
}

/* ------------------------------------------------------------------------------------------ */
/* Fase SONS: `play()` do <audio> e os osciladores do Web Audio, instrumentados na página.     */
/* ------------------------------------------------------------------------------------------ */
const INSTRUMENTAR_SONS = `(() => {
  window.__sons = { play: 0, osciladores: 0 }
  HTMLMediaElement.prototype.play = function () { window.__sons.play++; return Promise.resolve() }
  const Real = window.AudioContext
  window.AudioContext = class extends Real {
    createOscillator() { window.__sons.osciladores++; return super.createOscillator() }
  }
  return 'ok'
})()`
async function faseSons() {
  console.log('\n=== SONS ===')
  await abrirApp({ displayMode: 'quick', soundEnabled: true })
  await js(INSTRUMENTAR_SONS)
  await limparGrupos()
  await clicar('d20')
  await rolarRapido()
  let sons = await js('window.__sons')
  checar(sons.play === 1, `som de rolagem tocou uma vez ao rolar (play=${sons.play})`)
  let critico = false
  let falha = false
  for (let i = 0; i < 300 && !(critico && falha); i++) {
    const r = await rolarRapido()
    if (r.critico) critico = true
    if (r.falha) falha = true
  }
  sons = await js('window.__sons')
  // A fanfarra são QUATRO notas (quatro osciladores); o "womp" é um. Com os dois, pelo menos cinco.
  checar(critico && falha && sons.osciladores >= 5, `fanfarra do crítico e "womp" da falha tocaram (osciladores=${sons.osciladores}, crítico ${critico}, falha ${falha})`)

  await abrirApp({ displayMode: 'quick', soundEnabled: false })
  await js(INSTRUMENTAR_SONS)
  await limparGrupos()
  await clicar('d20')
  for (let i = 0; i < 40; i++) await rolarRapido()
  sons = await js('window.__sons')
  checar(sons.play === 0 && sons.osciladores === 0, `com o som desligado, nada toca em 40 rolagens (play=${sons.play}, osciladores=${sons.osciladores})`)

  await abrirApp({ displayMode: 'quick', soundEnabled: true, critSoundEnabled: false })
  await js(INSTRUMENTAR_SONS)
  await limparGrupos()
  await clicar('d20')
  for (let i = 0; i < 120; i++) await rolarRapido()
  sons = await js('window.__sons')
  checar(sons.play >= 120 && sons.osciladores === 0, `só o som de crítico desligado: rolagem toca (${sons.play}), crítico não (${sons.osciladores})`)
}

/* ------------------------------------------------------------------------------------------ */
/* Fase PRESETS: criar, apagar (pelo diálogo do app) e criar de novo; apagar com ficha aberta.  */
/* ------------------------------------------------------------------------------------------ */
async function digitar(seletor, texto) {
  await js(`(() => { const i = document.querySelector(${JSON.stringify(seletor)}); const set = Object.getOwnPropertyDescriptor(i instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(texto)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })) })()`)
}
async function criarPreset(nome) {
  await clicar('+ Novo preset')
  const abriu = await esperarAte(`!!document.querySelector('.preset-editor input, .modal-overlay input')`, 4000)
  if (!abriu) return false
  await digitar('.modal-overlay input', nome)
  await espera(100)
  await js(`Array.from(document.querySelectorAll('.modal-overlay button')).find((b) => b.textContent.trim() === 'Salvar')?.click()`)
  return esperarAte(`!document.querySelector('.modal-overlay') && Array.from(document.querySelectorAll('.preset-card-name')).some((n) => n.textContent === ${JSON.stringify(nome)})`, 4000)
}
async function apagarPreset(nome) {
  await js(`(() => { const card = Array.from(document.querySelectorAll('.preset-card')).find((c) => c.querySelector('.preset-card-name')?.textContent === ${JSON.stringify(nome)}); card?.querySelector('.preset-card-action-delete')?.click() })()`)
  const dialogo = await esperarAte(`!!document.querySelector('[role=alertdialog]')`, 3000)
  if (!dialogo) return false
  await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find((b) => b.textContent.trim() === 'OK')?.click()`)
  return esperarAte(`!document.querySelector('[role=alertdialog]') && !Array.from(document.querySelectorAll('.preset-card-name')).some((n) => n.textContent === ${JSON.stringify(nome)})`, 4000)
}
async function fasePresets() {
  console.log('\n=== PRESETS (criar, apagar pelo diálogo do app, criar de novo; apagar com a ficha aberta) ===')
  estado.profiles = { profiles: [{ id: 'p1', name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: null, createdAt: 1 }], activeId: 'p1' }
  estado.notas.set('p1', NOTAS_VAZIAS())
  estado.presets.set('p1', [])
  await abrirApp({ displayMode: 'quick' })
  checar(await criarPreset('Espada'), 'criar o preset "Espada" pelo editor')
  checar(await apagarPreset('Espada'), 'apagar "Espada": o "tem certeza?" é o diálogo do app, e o preset some')
  // O bug relatado: depois de apagar, criar outro — e o nome tem que DIGITAR.
  checar(await criarPreset('Bola de fogo'), 'criar OUTRO preset depois de apagar — o nome digita e salva')
  await foto('presets-depois-de-apagar')

  // Com a ficha importada: apagar um preset e continuar editando a ficha.
  const pasta = join(RAIZ, 'Fichas RPG')
  const ordem = existsSync(pasta) ? readdirSync(pasta).find((n) => /Matais/.test(n)) : null
  if (!ordem) {
    console.log('sem a ficha do Matias — pulando a metade da ficha')
    return
  }
  estado.profiles = { profiles: [{ id: 'p1', name: '', system: '', photo: null, createdAt: 1 }], activeId: 'p1' }
  estado.notas = new Map([['p1', NOTAS_VAZIAS()]])
  estado.presets = new Map([['p1', []]])
  estado.pdfParaAbrir = { nome: ordem, bytes: new Uint8Array(readFileSync(join(pasta, ordem))) }
  await abrirApp({ displayMode: 'quick' })
  await aba('Ficha')
  await clicar('Importar ficha (PDF)')
  await esperarAte(`!!document.querySelector('.sheet-import')`, 40000, 250)
  await clicar('Criar personagem')
  await esperarAte(`!document.querySelector('.sheet-import')`, 15000)
  await espera(500)
  await aba('Rolagem')
  const primeiro = await js(`document.querySelector('.preset-card-name')?.textContent`)
  checar(!!primeiro && (await apagarPreset(primeiro)), `apagar o preset importado "${primeiro}" pelo diálogo do app`)
  await aba('Ficha')
  await espera(300)
  // Digitar num campo da ficha DEPOIS de apagar — o segundo bug relatado.
  const gravacoesAntes = estado.notas.get(estado.profiles.activeId)
  await js(`(() => { const i = Array.from(document.querySelectorAll('.sheet-section-field input')).find((c) => c.value === '' || true); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '77'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await espera(300)
  const notasDepois = estado.notas.get(estado.profiles.activeId)
  const gravou = notasDepois !== gravacoesAntes && JSON.stringify(notasDepois).includes('"77"')
  checar(gravou, 'depois de apagar um preset, digitar num campo da ficha GRAVA (a ficha não travou)')
  await foto('presets-ficha-depois-de-apagar')
}

/* ------------------------------------------------------------------------------------------ */
/* Fase FOTO: escolher a foto abre o recorte; "Usar esta" grava um quadrado.                   */
/* ------------------------------------------------------------------------------------------ */
async function faseFoto() {
  console.log('\n=== FOTO (recorte com zoom no rosto) ===')
  estado.profiles = { profiles: [{ id: 'p1', name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: null, createdAt: 1 }], activeId: 'p1' }
  estado.notas.set('p1', NOTAS_VAZIAS())
  await abrirApp({})
  await aba('Ficha')
  await clicar('.sheet-profile-photo')
  const abriu = await esperarAte(`!!document.querySelector('.recorte-foto') && getComputedStyle(document.querySelector('.recorte-foto-quadro img')).visibility === 'visible'`, 8000)
  checar(abriu, 'clicar na foto abre o recorte com a imagem carregada')
  await espera(300)
  await foto('foto-recorte')
  // Roda do mouse dá zoom; arrastar desloca. Só conferimos que o transform mudou.
  const antes = await js(`document.querySelector('.recorte-foto-quadro img').style.transform`)
  const quadro = await js(`(() => { const r = document.querySelector('.recorte-foto-quadro').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()`)
  win.webContents.sendInputEvent({ type: 'mouseWheel', x: quadro.x, y: quadro.y, deltaX: 0, deltaY: -120 })
  await espera(200)
  win.webContents.sendInputEvent({ type: 'mouseMove', x: quadro.x, y: quadro.y })
  win.webContents.sendInputEvent({ type: 'mouseDown', x: quadro.x, y: quadro.y, button: 'left', clickCount: 1 })
  await espera(60)
  win.webContents.sendInputEvent({ type: 'mouseMove', x: quadro.x - 30, y: quadro.y - 20, button: 'left' })
  await espera(60)
  win.webContents.sendInputEvent({ type: 'mouseUp', x: quadro.x - 30, y: quadro.y - 20, button: 'left', clickCount: 1 })
  await espera(200)
  const depois = await js(`document.querySelector('.recorte-foto-quadro img').style.transform`)
  checar(antes !== depois, `zoom e arrasto mexem no enquadramento (${antes.slice(0, 40)}… → ${depois.slice(0, 40)}…)`)
  await foto('foto-recorte-ajustado')
  await clicar('Usar esta')
  await esperarAte(`!document.querySelector('.recorte-foto')`, 5000)
  await espera(400)
  const gravada = estado.profiles.profiles[0].photo
  const medida = gravada ? await js(`new Promise((r) => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => r(null); i.src = ${JSON.stringify(gravada)} })`) : null
  checar(!!gravada && gravada.startsWith('data:image/jpeg') && medida && medida.w === 384 && medida.h === 384, `a foto gravada é um quadrado JPEG de 384px (${medida ? `${medida.w}×${medida.h}` : 'nenhuma'})`)
  const recortar = await js(`!!Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Recortar…')`)
  checar(recortar, 'com foto, a Ficha oferece "Recortar…"')
  await foto('foto-ficha-depois')
}

/* ------------------------------------------------------------------------------------------ */
/* Fase HUD.                                                                                   */
/* ------------------------------------------------------------------------------------------ */
function notasCarregadas() {
  return {
    ...NOTAS_VAZIAS(),
    characterName: 'Bartholomeu Anastácio da Silveira Montenegro',
    recursos: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, nome: ['PV', 'PE', 'Sanidade', 'Sorte', 'Espaços 1º', 'Espaços 2º', 'Espaços 3º', 'Inspiração', 'Munição', 'Fôlego', 'Mana', 'Foco'][i], atual: (i * 7) % 20, maximo: 20 })),
    condicoes: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, nome: ['Machucado', 'Enlouquecendo', 'Caído', 'Envenenado', 'Cego', 'Surdo', 'Amedrontado', 'Agarrado', 'Paralisado', 'Petrificado', 'Atordoado', 'Inconsciente', 'Exausto', 'Invisível', 'Enfeitiçado', 'Incapacitado', 'Contido', 'Lento', 'Apressado', 'Abençoado'][i], ativa: i % 3 === 0 }))
  }
}
async function medirHud() {
  return js(`(() => {
    const hud = document.querySelector('.hud, .hud-mostrar')
    const cena = document.querySelector('.dice-roller-3d-canvas')
    if (!hud || !cena) return null
    const h = hud.getBoundingClientRect(), c = cena.getBoundingClientRect()
    return { dentro: h.left >= c.left - 1 && h.top >= c.top - 1 && h.right <= c.right + 1 && h.bottom <= c.bottom + 1, largura: Math.round(h.width), altura: Math.round(h.height), cena: Math.round(c.height), classe: hud.className }
  })()`)
}
async function faseHud() {
  console.log('\n=== HUD ===')
  const perfilLongo = { ...estado.profiles.profiles[0], name: 'Bartholomeu Anastácio da Silveira Montenegro' }
  estado.profiles = { profiles: [perfilLongo], activeId: 'p1' }
  for (const tamanho of [{ largura: 1300, altura: 800 }, { largura: 900, altura: 600 }]) {
    for (const canto of ['nw', 'ne', 'sw', 'se']) {
      for (const [mini, visivel] of [[false, true], [true, true], [false, false]]) {
        estado.notas.set('p1', { ...notasCarregadas(), hud: { canto, visivel, mini } })
        await abrirApp({}, tamanho)
        const m = await medirHud()
        const rotulo = `${tamanho.largura}×${tamanho.altura} ${canto} ${visivel ? (mini ? 'mini' : 'cheio') : 'escondido'}`
        checar(!!m && m.dentro, `HUD ${rotulo}: ${m ? `${m.largura}×${m.altura} dentro da cena de ${m.cena}px` : 'não encontrado'}`)
        if (canto === 'se' || !visivel) await foto(`hud-${tamanho.largura}-${canto}-${visivel ? (mini ? 'mini' : 'cheio') : 'escondido'}`)
      }
    }
  }
  await faseHudArrasto()
}

async function faseHudArrasto() {
  // O ARRASTO de verdade: do canto SE ao NW, com o mouse.
  estado.notas.set('p1', { ...notasCarregadas(), hud: { canto: 'se', visivel: true, mini: false } })
  await abrirApp({}, { largura: 1300, altura: 800 })
  const r = await js(`(() => { const h = document.querySelector('.hud-cabecalho').getBoundingClientRect(); const c = document.querySelector('.dice-roller-3d-canvas').getBoundingClientRect(); return { x: Math.round(h.left + 60), y: Math.round(h.top + 10), cx: Math.round(c.left + 80), cy: Math.round(c.top + 60) } })()`)
  // Diagnóstico: que eventos de ponteiro chegam ao cabeçalho durante o gesto sintético.
  await js(`window.__eventos = []; for (const tipo of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mouseup']) document.addEventListener(tipo, (e) => window.__eventos.push(tipo + ':' + (e.target.className || e.target.tagName).toString().split(' ')[0] + ':' + e.button + ':' + e.pointerId), true); 'ok'`)
  win.webContents.sendInputEvent({ type: 'mouseMove', x: r.x, y: r.y })
  await espera(80)
  win.webContents.sendInputEvent({ type: 'mouseDown', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await espera(80)
  for (let i = 1; i <= 10; i++) {
    win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(r.x + ((r.cx - r.x) * i) / 10), y: Math.round(r.y + ((r.cy - r.y) * i) / 10), button: 'left' })
    await espera(30)
  }
  await foto('hud-arrastando')
  win.webContents.sendInputEvent({ type: 'mouseUp', x: r.cx, y: r.cy, button: 'left', clickCount: 1 })
  await espera(400)
  const canto = estado.notas.get('p1').hud?.canto
  const eventos = await js(`window.__eventos.slice(0, 6).join(' ') + (window.__eventos.length > 6 ? ' … ' + window.__eventos.slice(-3).join(' ') : '')`)
  checar(canto === 'nw', `arrastar do SE pro NW gravou canto "${canto}" (eventos: ${eventos})`)
  await foto('hud-depois-do-arrasto')
  // Condição liga com clique e grava; o "−" do PV grava.
  await clicar('Machucado — desligada; clique pra ligar').catch(() => {})
  await js(`Array.from(document.querySelectorAll('.hud-condicao')).find((b) => b.textContent.includes('Caído'))?.click()`)
  await espera(200)
  const caido = estado.notas.get('p1').condicoes.find((c) => c.nome === 'Caído')
  checar(caido?.ativa === true, `clicar na condição "Caído" ligou e gravou (${caido?.ativa})`)
  // O PE (índice 1) começa em 7; o PV começa em 0 e não teria de onde tirar.
  await clicar('Tirar de PE')
  await espera(200)
  checar(estado.notas.get('p1').recursos[1].atual === notasCarregadas().recursos[1].atual - 1, `"−" do PE no HUD gravou ${estado.notas.get('p1').recursos[1].atual} (era ${notasCarregadas().recursos[1].atual})`)
  // Digitar "-3" no número do PE (6 → 3), e Shift+clique no "+" (3 → 8).
  await js(`document.querySelector('button[aria-label^="PE:"]').click()`)
  await espera(120)
  await js(`(() => { const i = document.querySelector('input[aria-label^="PE:"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '-3'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })()`)
  await espera(200)
  checar(estado.notas.get('p1').recursos[1].atual === 3, `digitar "-3" no PE gravou ${estado.notas.get('p1').recursos[1].atual} (esperado 3)`)
  const mais = await js(`(() => { const b = document.querySelector('button[aria-label="Somar em PE"]').getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } })()`)
  win.webContents.sendInputEvent({ type: 'mouseMove', x: mais.x, y: mais.y })
  await espera(60)
  win.webContents.sendInputEvent({ type: 'mouseDown', x: mais.x, y: mais.y, button: 'left', clickCount: 1, modifiers: ['shift'] })
  await espera(60)
  win.webContents.sendInputEvent({ type: 'mouseUp', x: mais.x, y: mais.y, button: 'left', clickCount: 1, modifiers: ['shift'] })
  await espera(250)
  checar(estado.notas.get('p1').recursos[1].atual === 8, `Shift+clique no "+" do PE gravou ${estado.notas.get('p1').recursos[1].atual} (esperado 8)`)
  await foto('hud-hp-mp-depois')
}

/* ------------------------------------------------------------------------------------------ */
/* Fase FICHAS.                                                                                */
/* ------------------------------------------------------------------------------------------ */
async function faseFichas(pasta = join(RAIZ, 'Fichas RPG'), filtro = /^(?!.*(core|remaster ficha|player core|gm core)).*\.pdf$/i, esperaRetrato = {}) {
  console.log(`\n=== FICHAS (importação pela tela de conferência): ${pasta} ===`)
  if (!existsSync(pasta)) {
    console.log(`sem a pasta ${pasta} — pulando`)
    return
  }
  const pdfs = readdirSync(pasta).filter((n) => filtro.test(n))
  for (const nome of pdfs) {
    estado.profiles = { profiles: [{ id: 'p1', name: '', system: '', photo: null, createdAt: 1 }], activeId: 'p1' }
    estado.notas = new Map([['p1', NOTAS_VAZIAS()]])
    estado.presets = new Map([['p1', []]])
    estado.pdfParaAbrir = { nome, bytes: new Uint8Array(readFileSync(join(pasta, nome))) }
    estado.ultimoApply = null
    await abrirApp({})
    await aba('Ficha')
    await clicar('Importar ficha (PDF)')
    const abriu = await esperarAte(`!!document.querySelector('.sheet-import')`, 40000, 250)
    if (!abriu) {
      checar(false, `${nome}: a conferência não abriu em 40s`)
      await foto(`ficha-${nome.replace(/[^a-z0-9]+/gi, '-')}-falhou`)
      continue
    }
    const conf = await js(`(() => {
      const leitor = (document.querySelector('.sheet-import-reader') || {}).textContent || ''
      const titulos = Array.from(document.querySelectorAll('.sheet-import-section h3')).map((h) => h.textContent.replace(/\\s+/g, ' ').trim())
      const barras = Array.from(document.querySelectorAll('.sheet-import-resources-list li')).map((li) => li.textContent.replace(/\\s+/g, ' ').trim())
      const retrato = !!document.querySelector('img.sheet-import-portrait-img')
      const avisos = document.querySelectorAll('.sheet-import-warnings li').length
      const nome = (document.querySelector('.sheet-import-identity input') || {}).value || ''
      return { leitor: leitor.trim(), titulos, barras, retrato, avisos, nome }
    })()`)
    const slug = nome.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '')
    await foto(`ficha-${slug}-conferencia`)
    // Modelo em branco não traz nome, e sem nome o "Criar" fica desabilitado de propósito: a pessoa
    // digita um. Aqui, o harness digita — e assim o caminho do modelo em branco também é testado.
    if (!conf.nome.trim()) {
      await js(`(() => { const i = document.querySelector('.sheet-import-identity input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Teste em branco'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
      await espera(100)
    }
    await clicar('Criar personagem')
    const fechou = await esperarAte(`!document.querySelector('.sheet-import')`, 15000, 200)
    const apply = estado.ultimoApply
    const resumo = apply
      ? `${apply.notes.sections.length} seções, ${apply.presets.length} presets, barras [${(apply.recursos ?? []).map((r) => `${r.nome} ${r.atual}/${r.maximo}`).join(', ')}], retrato ${apply.photo ? `${Math.round(apply.photo.length / 1024)} KB` : 'não'}`
      : 'sem apply'
    checar(fechou && !!apply && apply.characterName.trim() !== '', `${nome}\n      ${conf.leitor || 'sem leitor'} · nome "${conf.nome}" · ${conf.titulos.join(' · ')} · barras propostas ${conf.barras.length} · ${conf.avisos} avisos\n      gravou: ${resumo}`)
    /**
     * O RETRATO esperado deste arquivo: `null` = nenhum; `'retrato'` = a foto (proporção 3:4 no
     * arquivo fabricado — o logo é quadrado). Decodificado na página, porque é lá que há canvas.
     */
    if (nome in esperaRetrato) {
      const esperado = esperaRetrato[nome]
      const medida = apply?.photo
        ? await js(`new Promise((r) => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => r(null); i.src = ${JSON.stringify(apply.photo)} })`)
        : null
      const ok = esperado === null ? !apply?.photo : !!medida && medida.h > medida.w
      checar(ok, `      retrato de ${nome}: ${medida ? `${medida.w}×${medida.h}` : 'nenhum'} (esperado ${esperado === null ? 'nenhum' : 'a foto 3:4, não o logo quadrado'})`)
    }
    await espera(600)
    await foto(`ficha-${slug}-ficha`)
    await aba('Rolagem')
    await espera(300)
    await foto(`ficha-${slug}-rolagem`)
  }
}

app.whenReady().then(async () => {
  for (const [canal, fn] of Object.entries(HANDLERS)) ipcMain.handle(canal, (_e, ...args) => fn(...args))
  if (FASES.includes('dados')) await faseDados()
  if (FASES.includes('dados3d')) await faseDados3d()
  if (FASES.includes('sons')) await faseSons()
  if (FASES.includes('foto')) await faseFoto()
  if (FASES.includes('presets')) await fasePresets()
  if (FASES.includes('hud')) await faseHud()
  if (FASES.includes('arrasto')) await faseHudArrasto()
  if (FASES.includes('fichas')) await faseFichas()
  // A décima leva fabricada (`ESCREVER_PDFS=1 npx vitest run corpusDePdfs` escreve em Fichas RPG/testes/).
  if (FASES.includes('fabricados')) await faseFichas(join(RAIZ, 'Fichas RPG', 'testes'), /^7[0-3]-.*\.pdf$/i, { '73-foto-no-campo.pdf': 'retrato', '70-hp-mp-em-ingles.pdf': null })
  console.log(falhas === 0 ? '\nTudo passou no app compilado.' : `\n${falhas} checagem(ns) falharam.`)
  if (win && !win.isDestroyed()) win.destroy()
  app.exit(falhas === 0 ? 0 : 1)
}).catch((erro) => {
  console.error('O harness não terminou:', erro)
  app.exit(2)
})
