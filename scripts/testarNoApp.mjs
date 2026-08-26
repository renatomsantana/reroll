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
const FASES = process.argv.slice(2).length ? process.argv.slice(2) : ['dados', 'dados3d', 'sons', 'foto', 'retrato', 'presets', 'pacote', 'perfis', 'hud', 'fichas', 'fabricados']

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
  /** As páginas do PDF por personagem (data URLs), como `PaginasRepository` guardaria em disco. */
  paginas: new Map(),
  copiado: [],
  console: [],
  /** A próxima imagem que o "Escolher foto" devolve (fase RETRATO); `null` = a foto de teste de sempre. */
  fotoParaEscolher: null,
  pdfParaAbrir: null,
  ultimoApply: null
}
const notasDoAtivo = () => estado.notas.get(estado.profiles.activeId) ?? NOTAS_VAZIAS()
const presetsDoAtivo = () => estado.presets.get(estado.profiles.activeId) ?? []

const HANDLERS = {
  'profiles:get': () => estado.profiles,
  'profiles:save': (novo) => (estado.profiles = novo),
  'profiles:pickPhoto': () => estado.fotoParaEscolher ?? fotoDeTeste,
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
  'presets:update': (id, entrada) => {
    const atualizado = { ...presetsDoAtivo().find((p) => p.id === id), ...entrada, updatedAt: Date.now() }
    estado.presets.set(estado.profiles.activeId, presetsDoAtivo().map((p) => (p.id === id ? atualizado : p)))
    return atualizado
  },
  'presets:delete': (id) => estado.presets.set(estado.profiles.activeId, presetsDoAtivo().filter((p) => p.id !== id)),
  /** A estrela como o main faz: marcar põe no fim da fileira, desmarcar tira e reindexa. */
  'presets:setFavorito': (id, favorito) => {
    const lista = presetsDoAtivo()
    const quantos = lista.filter((p) => p.favorito !== undefined).length
    const proximos = lista.map((p) => {
      if (p.id !== id) return p
      const { favorito: _fora, ...sem } = p
      return favorito ? { ...sem, favorito: p.favorito ?? quantos } : sem
    })
    estado.presets.set(estado.profiles.activeId, proximos)
    return proximos
  },
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
    if ((payload.paginas ?? []).length > 0) estado.paginas.set(perfil.id, payload.paginas)
    return perfil
  },
  /** As páginas do PDF do personagem ativo (ver `PaginasRepository`), sem disco. */
  'sheets:paginas': () => estado.paginas.get(estado.profiles.activeId) ?? [],
  /**
   * O pacote de personagem, sem disco: exportar guarda o pedido (é a APARÊNCIA que interessa
   * conferir — ela vem do renderer), importar cria o personagem de um pacote canónico e devolve a
   * aparência dele, como o main faria.
   */
  'pacote:exportar': (dados) => {
    estado.ultimoExportar = dados
    return 'D:\\Fichas\\Matias Oliveira - Reroll.html'
  },
  'pacote:importar': () => {
    // O teto do main, quando a fase pede (o "Kieran" do pacote canónico não estaria na lista).
    if (estado.recusarImportacao) throw new Error('Limite de 3 personagens atingido: o arquivo é de "Outro", que não está na lista. Apague um personagem antes de importar.')
    // Mesmo nome = ATUALIZA o que existe (mantendo o id), como o main faz; senão cria.
    const existente = estado.profiles.profiles.find((p) => p.name.trim().toLowerCase() === 'kieran vance')
    const perfil = existente
      ? { ...existente, system: 'Pathfinder 2e', photo: fotoDeTeste }
      : { id: randomUUID(), name: 'Kieran Vance', system: 'Pathfinder 2e', photo: fotoDeTeste, createdAt: Date.now() }
    estado.profiles = {
      profiles: existente ? estado.profiles.profiles.map((p) => (p.id === perfil.id ? perfil : p)) : [...estado.profiles.profiles, perfil],
      activeId: perfil.id
    }
    estado.notas.set(perfil.id, {
      ...NOTAS_VAZIAS(),
      characterName: perfil.name,
      sections: [{ id: 's1', title: 'Atributos', fields: [{ id: 'c1', label: 'Força', value: '18' }] }],
      recursos: [{ id: 'r1', nome: 'PV', atual: 30, maximo: 42 }]
    })
    estado.presets.set(perfil.id, [
      { id: randomUUID(), name: 'Espada longa', expression: { groups: [{ sides: 8, count: 1 }], modifiers: [] }, favorito: 0, createdAt: 1, updatedAt: 1 }
    ])
    return { perfil, aparencia: { diceBodyColor: existente ? '#654321' : '#123456', trayShape: 'circle' }, substituiu: !!existente }
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
/** `extras`: outras chaves do `localStorage` (a aparência por personagem, `rolador-look::<id>`). */
async function abrirApp(preferencias = {}, tamanho = { largura: 1300, altura: 800 }, extras = {}) {
  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      show: false,
      width: tamanho.largura,
      height: tamanho.altura,
      frame: false,
      webPreferences: { preload: join(RAIZ, 'out', 'preload', 'index.js'), sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false }
    })
    // O console do renderer, pra diagnosticar um passo que falha (erros da cena, avisos do React).
    win.webContents.on('console-message', (evento, nivel, mensagem) => {
      const texto = typeof evento?.message === 'string' ? evento.message : mensagem
      const grau = typeof evento?.level === 'string' ? evento.level : nivel
      estado.console.push(`[${grau}] ${texto}`)
    })
  }
  win.setContentSize(tamanho.largura, tamanho.altura)
  await win.loadFile(BLANK)
  await win.webContents.executeJavaScript(
    `localStorage.clear(); localStorage.setItem('rolador-settings', JSON.stringify(${JSON.stringify({ soundEnabled: false, ...preferencias })})); for (const [k, v] of Object.entries(${JSON.stringify(extras)})) localStorage.setItem(k, v); 'ok'`
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
/* Fase PERFIS: três personagens, trocar entre eles sem vazar nada, presets, dados, pacote.    */
/* ------------------------------------------------------------------------------------------ */
/** Abre a lista do seletor de personagem (aba Ficha) e escolhe pelo nome. */
async function trocarPara(nome) {
  await aba('Ficha')
  await js(`document.querySelector('.profile-select-value')?.click()`)
  const abriu = await esperarAte(`!!document.querySelector('.profile-select-option')`, 3000)
  if (!abriu) return false
  await js(`Array.from(document.querySelectorAll('.profile-select-option')).find((o) => o.textContent.includes(${JSON.stringify(nome)}))?.click()`)
  return esperarAte(`document.querySelector('.profile-select-value')?.textContent.includes(${JSON.stringify(nome)}) && !document.querySelector('.profile-select-option')`, 4000)
}
const nomesDosPresets = () => js(`Array.from(document.querySelectorAll('.preset-card-name')).map((n) => n.textContent)`)
const preferencia = (chave) => js(`JSON.parse(localStorage.getItem('rolador-settings') || '{}')[${JSON.stringify(chave)}]`)
async function textoDoBloco(legenda) {
  return js(`(() => { const f = Array.from(document.querySelectorAll('fieldset')).find((x) => x.querySelector('legend')?.textContent.trim() === ${JSON.stringify(legenda)}); return f?.querySelector('textarea')?.value })()`)
}
async function digitarNoBloco(legenda, texto) {
  await js(`(() => { const f = Array.from(document.querySelectorAll('fieldset')).find((x) => x.querySelector('legend')?.textContent.trim() === ${JSON.stringify(legenda)}); const i = f.querySelector('textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(i, ${JSON.stringify(texto)}); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await espera(400)
}
const presetFalso = (nome, lados, favorito) => ({ id: randomUUID(), name: nome, expression: { groups: [{ sides: lados, count: 1 }], modifiers: [] }, ...(favorito === undefined ? {} : { favorito }), createdAt: 1, updatedAt: 1 })

async function fasePerfis() {
  console.log('\n=== PERFIS (três personagens: trocar, presets, ficha, aparência, dados, pacote) ===')
  estado.profiles = {
    profiles: [
      { id: 'p1', name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: fotoDeTeste, createdAt: 1 },
      { id: 'p2', name: 'Kieran Vance', system: 'Pathfinder 2e', photo: null, createdAt: 2 },
      { id: 'p3', name: 'Zé da Silva', system: 'Oblívio', photo: null, createdAt: 3 }
    ],
    activeId: 'p1'
  }
  estado.notas = new Map([
    ['p1', { ...NOTAS_VAZIAS(), characterName: 'Matias Oliveira', inventory: 'Faca de mato', recursos: [{ id: 'r1', nome: 'PV', atual: 10, maximo: 20 }] }],
    ['p2', { ...NOTAS_VAZIAS(), characterName: 'Kieran Vance', inventory: 'Espada longa' }],
    ['p3', { ...NOTAS_VAZIAS(), characterName: 'Zé da Silva', inventory: 'Um pé de cabra' }]
  ])
  estado.presets = new Map([
    ['p1', [presetFalso('Faca', 20, 0), presetFalso('Ritual', 6)]],
    ['p2', [presetFalso('Espada longa', 8)]],
    ['p3', []]
  ])
  await abrirApp({ displayMode: 'quick', diceBodyColor: '#111111' }, { largura: 1300, altura: 800 }, {
    'rolador-look::p2': JSON.stringify({ diceBodyColor: '#222222', trayShape: 'circle' }),
    'rolador-look::p3': JSON.stringify({ diceBodyColor: '#333333' })
  })

  // 1. O que abre é o p1, com os presets dele.
  let presets = await nomesDosPresets()
  checar(presets.join() === 'Faca,Ritual', `abre no Matias com os presets dele (${presets})`)

  // 2. Trocar pro Kieran: presets, ficha e aparência trocam junto; nada do Matias fica.
  checar(await trocarPara('Kieran'), 'trocar pro Kieran pelo seletor')
  await espera(600)
  checar(estado.profiles.activeId === 'p2', 'o processo principal ficou sabendo (activeId = p2)')
  checar((await textoDoBloco('Inventário')) === 'Espada longa', `a Ficha é a do Kieran (inventário: "${await textoDoBloco('Inventário')}")`)
  await aba('Rolagem')
  presets = await nomesDosPresets()
  checar(presets.join() === 'Espada longa', `os presets são os do Kieran (${presets})`)
  checar((await preferencia('diceBodyColor')) === '#222222', `a cor do dado é a do Kieran (${await preferencia('diceBodyColor')})`)
  checar((await preferencia('trayShape')) === 'circle', `a bandeja é a do Kieran (${await preferencia('trayShape')})`)
  const nomeNoCabecalho = await js(`document.querySelector('.profile-badge, [data-testid=profile-badge]')?.textContent`)
  checar(nomeNoCabecalho?.includes('Kieran'), `o crachá da rolagem mostra o Kieran ("${nomeNoCabecalho}")`)

  // 3. Digitar na ficha do Kieran, ir pro Zé, voltar: o texto ficou, e o Zé não ganhou nada.
  await aba('Ficha')
  await digitarNoBloco('Inventário', 'Espada longa e escudo')
  checar(await trocarPara('Zé'), 'trocar pro Zé')
  await espera(600)
  checar((await textoDoBloco('Inventário')) === 'Um pé de cabra', `a ficha do Zé é a dele ("${await textoDoBloco('Inventário')}")`)
  checar((await preferencia('diceBodyColor')) === '#333333', `a cor do dado é a do Zé (${await preferencia('diceBodyColor')})`)
  await aba('Rolagem')
  presets = await nomesDosPresets()
  checar(presets.length === 0, `o Zé não tem preset nenhum (${JSON.stringify(presets)})`)
  checar(estado.notas.get('p2').inventory === 'Espada longa e escudo', `o que foi digitado no Kieran gravou no Kieran ("${estado.notas.get('p2').inventory}")`)
  checar(estado.notas.get('p3').inventory === 'Um pé de cabra', 'e o Zé continua com o dele')

  // 4. Criar preset no Zé, com fórmula, e rolar por ele; favoritar; o Matias não ganha esse preset.
  checar(await criarPreset('Machado'), 'criar o preset "Machado" no Zé')
  const antesDoPreset = await js(`document.querySelector('.dice-roller-3d-result')?.textContent`)
  await js(`Array.from(document.querySelectorAll('.preset-card')).find((c) => c.querySelector('.preset-card-name')?.textContent === 'Machado')?.querySelector('.preset-card-main')?.click()`)
  const rolou = await esperarAte(`document.querySelector('.dice-roller-3d-result')?.textContent !== ${JSON.stringify(antesDoPreset)} && !document.querySelector('.dice-roller-3d-result').textContent.includes('Rolando')`, 4000)
  const resultadoDoPreset = await js(`document.querySelector('.dice-roller-3d-result')?.textContent`)
  checar(rolou && /\d/.test(resultadoDoPreset ?? ''), `clicar no preset rola ("${(resultadoDoPreset ?? '').trim().slice(0, 50)}")`)
  await js(`document.querySelector('.preset-card [aria-label^="Favoritar"]')?.click()`)
  await espera(200)
  const estrela = await js(`!!document.querySelector('.preset-card [aria-label^="Desfavoritar"], .preset-card [aria-label^="Tirar"]')`)
  checar(estrela, 'a estrela marcou o preset como favorito')
  checar((estado.presets.get('p3') ?? []).some((p) => p.name === 'Machado'), 'o preset gravou na pasta do Zé')
  checar(!(estado.presets.get('p1') ?? []).some((p) => p.name === 'Machado'), 'e não na do Matias')

  // 5. Editar o preset: trocar o nome. Apagar depois.
  await js(`document.querySelector('.preset-card [aria-label="Editar"]')?.click()`)
  await esperarAte(`!!document.querySelector('.modal-overlay input')`, 3000)
  await digitar('.modal-overlay input', 'Machado grande')
  await js(`Array.from(document.querySelectorAll('.modal-overlay button')).find((b) => b.textContent.trim() === 'Salvar')?.click()`)
  const renomeou = await esperarAte(`Array.from(document.querySelectorAll('.preset-card-name')).some((n) => n.textContent === 'Machado grande')`, 3000)
  checar(renomeou, 'editar o preset troca o nome na lista')
  checar(await apagarPreset('Machado grande'), 'apagar o preset pelo diálogo do app')

  // 6. Vários dados de uma vez no modo rápido: 2d20 + 3d6 + 1d100.
  await limparGrupos()
  await clicar('d20')
  await js(`Array.from(document.querySelectorAll('.dice-roller-3d-group-chip button')).find((b) => b.textContent.trim() === '+')?.click()`)
  await clicar('d6')
  for (let i = 0; i < 2; i++) await js(`Array.from(document.querySelectorAll('.dice-roller-3d-group-chip')).at(-1)?.querySelector('button[title*="+"], button')?.textContent; Array.from(document.querySelectorAll('.dice-roller-3d-group-chip')).at(-1)?.querySelectorAll('button').forEach((b) => { if (b.textContent.trim() === '+') b.click() })`)
  await clicar('d100')
  await espera(100)
  const r = await rolarRapido()
  const soma = r.valores.reduce((a, b) => a + b, 0)
  checar(r.valores.length === 6 && r.total === soma, `2d20 + 3d6 + 1d100: ${r.valores.length} dados [${r.valores}] total ${r.total}`)
  await foto('perfis-seis-dados')
  // O HISTÓRICO é do personagem e vai pro disco (spec §3.2): as rolagens do Zé estão na ficha do Zé, e só nela.
  await espera(300)
  const historicoDoZe = estado.notas.get('p3').historico ?? []
  checar(historicoDoZe.length >= 2 && historicoDoZe[0].tipo === 'rolagem' && historicoDoZe[0].rolagem.total === r.total, `o histórico gravou na ficha do Zé (${historicoDoZe.length} itens, o último com total ${historicoDoZe[0]?.rolagem?.total})`)
  checar((estado.notas.get('p1').historico ?? []).length === 0, 'e a do Matias continua sem histórico')

  // 7. Voltar pro Matias: tudo dele de volta, inclusive a barra de PV e a cor original.
  checar(await trocarPara('Matias'), 'voltar pro Matias')
  await espera(600)
  await aba('Rolagem')
  presets = await nomesDosPresets()
  checar(presets.join() === 'Faca,Ritual', `os presets do Matias voltaram (${presets})`)
  checar((await preferencia('diceBodyColor')) === '#111111', `a cor do dado voltou a ser a do Matias (${await preferencia('diceBodyColor')})`)

  // 8. Renomear o Matias na Ficha: o seletor e o crachá acompanham.
  await aba('Ficha')
  await js(`(() => { const i = document.querySelector('.sheet-profile-fields input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Matias Oliveira Jr.'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await espera(500)
  const seletor = await js(`document.querySelector('.profile-select-value')?.textContent`)
  checar(seletor?.includes('Jr.'), `renomear na Ficha muda o seletor ("${seletor}")`)
  checar(estado.profiles.profiles.find((p) => p.id === 'p1')?.name === 'Matias Oliveira Jr.', 'e gravou na lista de perfis')

  // 9. No teto: "Novo personagem" fica cinza; importar um nome NOVO é recusado com o aviso do limite.
  const novoDesabilitado = await js(`Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Novo personagem')?.disabled`)
  checar(novoDesabilitado === true, 'com 3 personagens, "Novo personagem" fica desabilitado')
  estado.recusarImportacao = true
  await clicar('Importar personagem Reroll')
  const recusou = await esperarAte(`!!document.querySelector('[role=alertdialog]') && document.querySelector('[role=alertdialog]').textContent.includes('Limite de 3')`, 4000)
  checar(recusou, 'importar um personagem novo no teto avisa o limite, no diálogo do app')
  await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find((b) => b.textContent.trim() === 'OK')?.click()`)
  estado.recusarImportacao = false
  await espera(200)
  checar(estado.profiles.profiles.length === 3, 'e a lista continua com 3')

  // 10. Exportar o Matias leva a aparência DELE (não a do Kieran).
  await clicar('Exportar personagem')
  await esperarAte(`!!document.querySelector('[role=alertdialog]')`, 4000)
  checar(estado.ultimoExportar?.aparencia?.diceBodyColor === '#111111', `exportar leva a aparência do Matias (${estado.ultimoExportar?.aparencia?.diceBodyColor})`)
  await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find((b) => b.textContent.trim() === 'OK')?.click()`)
  await espera(200)

  // 11. Apagar o Zé: o app fica em outro personagem, com os presets certos.
  checar(await trocarPara('Zé'), 'ir pro Zé pra apagar')
  await espera(400)
  await js(`document.querySelector('[aria-label="Apagar personagem"]')?.click()`)
  await esperarAte(`!!document.querySelector('[role=alertdialog]')`, 3000)
  await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find((b) => b.textContent.trim() === 'OK')?.click()`)
  await esperarAte(`!document.querySelector('[role=alertdialog]')`, 3000)
  await espera(600)
  const restantes = estado.profiles.profiles.map((p) => p.name)
  checar(restantes.length === 2 && !restantes.includes('Zé da Silva'), `apagar o Zé deixa ${JSON.stringify(restantes)}`)
  const ativoAgora = estado.profiles.profiles.find((p) => p.id === estado.profiles.activeId)?.name
  await aba('Rolagem')
  presets = await nomesDosPresets()
  const esperados = ativoAgora?.startsWith('Matias') ? 'Faca,Ritual' : 'Espada longa'
  checar(presets.join() === esperados, `o app ficou no ${ativoAgora}, com os presets dele (${presets})`)
  const novoHabilitado = await js(`(() => { return true })()`)
  await aba('Ficha')
  const novoAgora = await js(`Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Novo personagem')?.disabled`)
  checar(novoAgora === false && novoHabilitado, 'com 2 personagens, "Novo personagem" volta a funcionar')
  await foto('perfis-final')

  // 12. O DIÁRIO (Anotações) também é por personagem: escrever no Kieran não aparece no Matias.
  checar(await trocarPara('Kieran'), 'ir pro Kieran pra escrever no diário')
  await aba('Anotações')
  await js(`(() => { const i = document.querySelector('.notes-textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(i, 'Sessão 1: a taverna pegou fogo'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await espera(500)
  checar(await trocarPara('Matias'), 'voltar pro Matias')
  await aba('Anotações')
  const diarioDoMatias = await js(`document.querySelector('.notes-textarea')?.value`)
  checar(diarioDoMatias === '', `o diário do Matias não ganhou o texto do Kieran ("${diarioDoMatias}")`)
  checar(estado.notas.get('p2').pages[0].text === 'Sessão 1: a taverna pegou fogo', 'e o do Kieran gravou na pasta dele')

  // 13. Com a CENA 3D montada: trocar de personagem troca a bandeja (círculo do Kieran) e continua rolando.
  estado.profiles.activeId = 'p1'
  await abrirApp({ displayMode: '3d', diceBodyColor: '#111111' }, { largura: 1300, altura: 800 }, {
    'rolador-look::p2': JSON.stringify({ diceBodyColor: '#222222', trayShape: 'circle' })
  })
  const antesDaTroca = await rolarNaCena()
  checar(antesDaTroca.assentou, `na cena 3D, o d20 do Matias assenta ([${antesDaTroca.valores}] em ${antesDaTroca.ms}ms)`)
  checar(await trocarPara('Kieran'), 'trocar pro Kieran com a cena montada')
  await aba('Rolagem')
  await espera(1500)
  const cena = await js(`(() => ({ canvas: !!document.querySelector('.dice-roller-3d-canvas canvas'), bandeja: JSON.parse(localStorage.getItem('rolador-settings') || '{}').trayShape, erro: window.__erroDaCena ?? null }))()`)
  checar(cena.canvas && cena.bandeja === 'circle', `a cena remontou com a bandeja do Kieran (${cena.bandeja}, canvas ${cena.canvas})`)
  estado.console.length = 0
  const depoisDaTroca = await rolarNaCena()
  checar(depoisDaTroca.assentou && depoisDaTroca.valores.length === 1, `e o dado assenta na bandeja nova ([${depoisDaTroca.valores}] em ${depoisDaTroca.ms}ms)`)
  if (!depoisDaTroca.assentou) {
    console.log('  resultado na tela:', JSON.stringify(await js(`document.querySelector('.dice-roller-3d-result')?.textContent`)))
    console.log('  botão ROLAR:', JSON.stringify(await js(`(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === 'ROLAR' || x.textContent.trim() === 'Rolando...'); return b ? { texto: b.textContent.trim(), disabled: b.disabled } : null })()`)))
    console.log('  console do renderer:', estado.console.slice(-12).join('\n    '))
  }
  await foto('perfis-3d-bandeja-do-kieran')
}

/* ------------------------------------------------------------------------------------------ */
/* Fase PACOTE: exportar leva a aparência do personagem; importar cria o personagem e a traz.  */
/* ------------------------------------------------------------------------------------------ */
async function fasePacote() {
  console.log('\n=== PACOTE (exportar o personagem com a aparência; importar e trocar pra ele) ===')
  estado.profiles = { profiles: [{ id: 'p1', name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: fotoDeTeste, createdAt: 1 }], activeId: 'p1' }
  estado.notas = new Map([['p1', { ...NOTAS_VAZIAS(), characterName: 'Matias Oliveira', inventory: 'Faca de mato' }]])
  estado.presets = new Map([['p1', []]])
  estado.ultimoExportar = null
  await abrirApp({ displayMode: 'quick', diceBodyColor: '#ab12cd', trayShape: 'square' })
  await aba('Ficha')

  checar(await clicar('Exportar personagem'), 'o botão "Exportar personagem" existe na Ficha')
  const avisou = await esperarAte(`!!document.querySelector('[role=alertdialog]') && document.querySelector('[role=alertdialog]').textContent.includes('Reroll.html')`, 4000)
  checar(avisou, 'exportar avisa onde gravou, no diálogo do app')
  const pedido = estado.ultimoExportar
  checar(pedido?.aparencia?.diceBodyColor === '#ab12cd' && pedido?.aparencia?.trayShape === 'square', `o pedido levou a aparência do personagem (${JSON.stringify(pedido?.aparencia && { cor: pedido.aparencia.diceBodyColor, bandeja: pedido.aparencia.trayShape })})`)
  checar(pedido?.idioma === 'pt-BR', 'e o idioma da interface, pro HTML sair na língua certa')
  await foto('pacote-exportado')
  await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find((b) => b.textContent.trim() === 'OK')?.click()`)
  await espera(200)

  checar(await clicar('Importar personagem Reroll'), 'o botão "Importar personagem Reroll" existe')
  const chegou = await esperarAte(`!!document.querySelector('[role=alertdialog]') && document.querySelector('[role=alertdialog]').textContent.includes('Kieran Vance')`, 4000)
  checar(chegou, 'importar avisa que "Kieran Vance" chegou')
  await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find((b) => b.textContent.trim() === 'OK')?.click()`)
  await espera(600)
  const ativo = estado.profiles.profiles.find((p) => p.id === estado.profiles.activeId)
  checar(ativo?.name === 'Kieran Vance', 'o personagem importado fica ABERTO')
  const ficha = await js(`(() => ({ nome: document.querySelector('.sheet-profile-fields input')?.value, secao: !!Array.from(document.querySelectorAll('.sheet-section-title, legend, h3')).find((e) => e.textContent.includes('Atributos')), forca: Array.from(document.querySelectorAll('.sheet-section-field input')).map((i) => i.value).includes('18') }))()`)
  checar(ficha.secao && ficha.forca, `a Ficha mostra a seção importada com Força 18 (${JSON.stringify(ficha)})`)
  const look = await js(`(() => { const chave = Object.keys(localStorage).find((k) => k === 'rolador-look::' + ${JSON.stringify(ativo?.id)}); const gravado = chave ? JSON.parse(localStorage.getItem(chave)) : null; const atual = JSON.parse(localStorage.getItem('rolador-settings') || '{}'); return { gravado: gravado && gravado.diceBodyColor, atual: atual.diceBodyColor, bandeja: atual.trayShape } })()`)
  checar(look.gravado === '#123456', `a aparência do pacote foi gravada pro personagem novo (${look.gravado})`)
  checar(look.atual === '#123456' && look.bandeja === 'circle', `e já está valendo na cena: dado ${look.atual}, bandeja ${look.bandeja}`)
  await aba('Rolagem')
  await espera(300)
  const preset = await js(`Array.from(document.querySelectorAll('.preset-card-name')).map((n) => n.textContent)`)
  checar(preset.includes('Espada longa'), `os presets do pacote estão na Rolagem (${JSON.stringify(preset)})`)
  await foto('pacote-importado')

  // Importar DE NOVO o mesmo nome, com ele aberto: atualiza, não duplica — e a aparência nova vale na hora.
  await aba('Ficha')
  const quantosAntes = estado.profiles.profiles.length
  await clicar('Importar personagem Reroll')
  const atualizou = await esperarAte(`!!document.querySelector('[role=alertdialog]') && document.querySelector('[role=alertdialog]').textContent.includes('já existia e foi atualizado')`, 4000)
  checar(atualizou, 'importar o mesmo nome de novo avisa que ATUALIZOU')
  await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find((b) => b.textContent.trim() === 'OK')?.click()`)
  await espera(600)
  checar(estado.profiles.profiles.length === quantosAntes, `a lista não cresceu (${estado.profiles.profiles.length} personagens)`)
  const corDepois = await js(`JSON.parse(localStorage.getItem('rolador-settings') || '{}').diceBodyColor`)
  checar(corDepois === '#654321', `a aparência do arquivo passou a valer no personagem aberto (${corDepois})`)
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
/* Fase RETRATO: a foto nos QUATRO lugares (Ficha, crachá da Rolagem, HUD, seletor), com       */
/* imagens de formato difícil: alta, larga, minúscula, enorme, com transparência.              */
/* ------------------------------------------------------------------------------------------ */
/** Desenha uma "foto" no renderer: fundo colorido e um rosto (círculo claro) perto do topo. */
async function imagemDeTeste(largura, altura, formato = 'image/png', transparente = false) {
  return js(`(() => {
    const c = document.createElement('canvas'); c.width = ${largura}; c.height = ${altura}
    const g = c.getContext('2d')
    if (!${transparente}) { g.fillStyle = '#2a4d69'; g.fillRect(0, 0, c.width, c.height) }
    g.fillStyle = '#f2d2b6'; g.beginPath(); g.arc(c.width / 2, c.height * 0.22, Math.min(c.width, c.height) * 0.18, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#b03030'; g.fillRect(0, c.height * 0.6, c.width, c.height * 0.4)
    return c.toDataURL(${JSON.stringify(formato)}, 0.9)
  })()`)
}
/** Mede a foto num lugar: caixa quadrada? imagem inteira dentro da caixa? `cover`, sem distorção? */
async function medirFoto(seletor) {
  return js(`(() => {
    const el = document.querySelector(${JSON.stringify(seletor)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    const pai = el.parentElement.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const img = el.tagName === 'IMG' ? el : el.querySelector('img')
    return {
      tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height),
      quadrada: Math.abs(r.width - r.height) <= 1,
      dentroDoPai: r.left >= pai.left - 1 && r.right <= pai.right + 1 && r.top >= pai.top - 1 && r.bottom <= pai.bottom + 1,
      cover: (img ? getComputedStyle(img).objectFit : cs.objectFit) === 'cover',
      natural: img ? [img.naturalWidth, img.naturalHeight] : null,
      carregou: img ? img.complete && img.naturalWidth > 0 : false
    }
  })()`)
}
const LUGARES = [
  ['Ficha', '.sheet-profile-photo'],
  ['crachá da Rolagem', '.profile-badge-photo'],
  ['HUD', '.hud-retrato'],
  ['seletor de personagem', '.profile-select-photo']
]
async function conferirOsQuatroLugares(rotulo) {
  await aba('Ficha')
  const medidas = { Ficha: await medirFoto('.sheet-profile-photo') }
  await js(`document.querySelector('.profile-select-value')?.click()`)
  await esperarAte(`!!document.querySelector('.profile-select-option')`, 3000)
  medidas['seletor de personagem'] = await medirFoto('.profile-select-option .profile-select-photo')
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await aba('Rolagem')
  await espera(300)
  medidas['crachá da Rolagem'] = await medirFoto('.profile-badge-photo')
  medidas.HUD = await medirFoto('.hud-retrato')
  for (const [lugar] of LUGARES) {
    const m = medidas[lugar]
    const ok = !!m && m.quadrada && m.dentroDoPai && m.cover && m.carregou
    checar(ok, `${rotulo}: ${lugar} ${m ? `${m.w}×${m.h}${m.quadrada ? '' : ' NÃO quadrada'}${m.dentroDoPai ? '' : ' VAZA do pai'}${m.cover ? '' : ' sem cover'}${m.carregou ? '' : ' não carregou'} (natural ${m.natural})` : 'não encontrado'}`)
  }
}
async function faseRetrato() {
  console.log('\n=== RETRATO (a foto nos quatro lugares, com imagens difíceis) ===')
  const casos = [
    ['alta (300×900)', 300, 900, 'image/png'],
    ['larga (1200×300)', 1200, 300, 'image/jpeg'],
    ['minúscula (16×16)', 16, 16, 'image/png'],
    ['enorme (3000×3000)', 3000, 3000, 'image/jpeg'],
    ['PNG transparente (400×500)', 400, 500, 'image/png', true]
  ]
  estado.profiles = { profiles: [{ id: 'p1', name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: null, createdAt: 1 }], activeId: 'p1' }
  estado.notas = new Map([['p1', { ...NOTAS_VAZIAS(), characterName: 'Matias Oliveira', recursos: [{ id: 'r1', nome: 'PV', atual: 10, maximo: 20 }] }]])
  estado.presets = new Map([['p1', []]])
  await abrirApp({ displayMode: '3d' })
  for (const [rotulo, largura, altura, formato, transparente] of casos) {
    estado.fotoParaEscolher = await imagemDeTeste(largura, altura, formato, transparente)
    await aba('Ficha')
    await clicar('.sheet-profile-photo')
    const abriu = await esperarAte(`!!document.querySelector('.recorte-foto') && getComputedStyle(document.querySelector('.recorte-foto-quadro img')).visibility === 'visible'`, 8000)
    checar(abriu, `${rotulo}: o recorte abre com a imagem`)
    if (!abriu) continue
    await espera(200)
    if (rotulo.startsWith('alta')) await foto('retrato-recorte-alta')
    await clicar('Usar esta')
    await esperarAte(`!document.querySelector('.recorte-foto')`, 5000)
    await espera(400)
    const gravada = estado.profiles.profiles[0].photo
    const medida = gravada ? await js(`new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r(null); i.src = ${JSON.stringify(gravada)} })`) : null
    checar(!!medida && medida[0] === 384 && medida[1] === 384, `${rotulo}: gravou um quadrado de 384 (${medida})`)
    await conferirOsQuatroLugares(rotulo)
    if (rotulo.startsWith('alta') || rotulo.startsWith('larga')) await foto(`retrato-${rotulo.split(' ')[0]}`)
  }

  // A foto SEM recorte: o retrato que vem do PDF entra como está (pode ser 3×4, pode ser larga).
  // Os quatro lugares têm que mostrar um quadrado sem esticar.
  for (const [rotulo, largura, altura] of [['retrato 3×4 sem recorte', 300, 400], ['banner largo sem recorte', 900, 200]]) {
    estado.profiles = { profiles: [{ ...estado.profiles.profiles[0], photo: await imagemDeTeste(largura, altura, 'image/jpeg') }], activeId: 'p1' }
    await abrirApp({ displayMode: '3d' })
    await conferirOsQuatroLugares(rotulo)
  }
  await foto('retrato-sem-recorte')
  estado.fotoParaEscolher = null
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

  // SEM barras: o HUD só explica o lápis (pedido dele), e o lápis está lá pra clicar.
  estado.notas.set('p1', { ...NOTAS_VAZIAS(), characterName: perfilLongo.name, hud: { canto: 'se', visivel: true, mini: false } })
  await abrirApp({}, { largura: 1300, altura: 800 })
  const semBarras = await js(`(() => ({ dica: document.querySelector('.hud-sem-barras')?.textContent, lapis: document.querySelector('.hud-botao[title*="Lápis"]')?.getAttribute('title') }))()`)
  checar(!!semBarras.dica && /lápis/i.test(semBarras.dica) && !/—/.test(semBarras.dica), `HUD sem barras explica o lápis, sem travessão: "${semBarras.dica}"`)
  checar(!!semBarras.lapis, `o lápis se explica no title: "${semBarras.lapis}"`)
  await foto('hud-sem-barras')

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
      const pagina = document.querySelector('.sheet-import-pagina-folha img')
      const paginaOk = !!pagina && pagina.complete && pagina.naturalWidth >= 900 && pagina.getBoundingClientRect().width > 200
      const contador = (document.querySelector('.sheet-import-pagina-nav span') || {}).textContent || ''
      return { leitor: leitor.trim(), titulos, barras, retrato, avisos, nome, paginaOk, contador }
    })()`)
    const slug = nome.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '')
    await foto(`ficha-${slug}-conferencia`)
    // A página do PDF ao lado dos campos (spec §9): desenhada, legível, com o contador certo.
    checar(conf.paginaOk && /Página 1 de \d+/.test(conf.contador), `      ${nome}: a página do PDF aparece ao lado dos campos (${conf.contador || 'sem página'})`)
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
    // A FICHA ORIGINAL na aba: as páginas ficaram com o personagem e abrem num clique.
    const paginasGravadas = (estado.paginas.get(estado.profiles.activeId) ?? []).length
    const abriuOriginal = paginasGravadas > 0 && (await clicar(`Mostrar as ${paginasGravadas} páginas`))
    const original = abriuOriginal
      ? await esperarAte(`(() => { const imgs = Array.from(document.querySelectorAll('.sheet-original-paginas img')); return imgs.length === ${paginasGravadas} && imgs.every((i) => i.complete && i.naturalWidth >= 900) })()`, 5000)
      : false
    checar(original, `      ${nome}: a Ficha guarda ${paginasGravadas} página(s) do PDF e mostra ao clicar`)
    if (original) {
      // A captura logo depois do clique vem de um quadro antigo (ver a memória do harness): espera pintar.
      await espera(600)
      await foto(`ficha-${slug}-original`)
    }
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
  if (FASES.includes('retrato')) await faseRetrato()
  if (FASES.includes('presets')) await fasePresets()
  if (FASES.includes('pacote')) await fasePacote()
  if (FASES.includes('perfis')) await fasePerfis()
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
