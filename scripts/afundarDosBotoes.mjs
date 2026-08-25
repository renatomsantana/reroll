/**
 * RETESTE DO AFUNDAR DOS BOTÕES — medido, não olhado.
 *
 * Pedido do usuário: "os botões dos dados estão se afundando errado, os dos presets também,
 * retesta os botões". O que "afundar certo" quer dizer no Windows 98 é UM contrato: no clique a
 * borda inverte (outset → inset) e o conteúdo anda 1px pra baixo e pra direita. Este script abre
 * uma janela OCULTA do Electron (nunca captura da tela — o PC está sempre em uso), monta cada
 * família de botão do app com o CSS DE PRODUÇÃO (o bundle de `out/renderer`), segura o mouse
 * apertado de verdade (`sendInputEvent`) e compara os pixels de antes e durante o clique:
 *
 * - o DESLOCAMENTO é achado por correlação — qual (dx, dy) faz o miolo do botão apertado casar
 *   com o miolo solto; o certo é (1, 1);
 * - quem é MARCADO (`.btn-selected`) tem que estar deslocado parado, e o clique nele não pode
 *   deslocar de novo: (0, 0).
 *
 * Rodar (depois de `npx electron-vite build`):
 *
 *     npx electron scripts/afundarDosBotoes.mjs
 *
 * Sai com código 1 se algum botão afundar errado — dá pra pendurar em CI ou rodar à mão a cada
 * mexida de CSS.
 */
import { app, BrowserWindow, nativeImage } from 'electron'
import { readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const RAIZ = resolve(import.meta.dirname, '..')
const ASSETS = join(RAIZ, 'out', 'renderer', 'assets')

function cssDeProducao() {
  const candidatos = readdirSync(ASSETS).filter((n) => n.startsWith('index-') && n.endsWith('.css'))
  if (candidatos.length === 0) throw new Error('Rode `npx electron-vite build` antes: não há CSS em out/renderer/assets.')
  return join(ASSETS, candidatos[0])
}

/**
 * Cada caso é a ESTRUTURA REAL de um botão do app — as mesmas classes, os mesmos pais — porque é
 * o pai que muitas vezes cancela o afundar (foi exatamente o defeito: o padding do contêiner
 * vencia o do `:active` por ordem de import).
 */
const CASOS = [
  {
    id: 'dado-normal',
    nome: 'Tipo de dado (d20), solto',
    html: `<div class="dice-roller-3d-types" style="width:340px"><button class="btn btn-secondary" id="alvo">d20</button></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'dado-marcado',
    nome: 'Tipo de dado MARCADO — clicar não afunda de novo',
    html: `<div class="dice-roller-3d-types" style="width:340px"><button class="btn btn-secondary btn-selected" id="alvo">d20</button></div>`,
    esperado: { dx: 0, dy: 0 }
  },
  {
    id: 'modo-normal',
    nome: 'Modo (Vantagem), solto',
    html: `<div class="dice-roller-3d-mode"><button class="btn btn-secondary" id="alvo">Vantagem</button></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'modo-marcado',
    nome: 'Modo MARCADO — clicar não afunda de novo',
    html: `<div class="dice-roller-3d-mode"><button class="btn btn-secondary btn-selected" id="alvo">Normal</button></div>`,
    esperado: { dx: 0, dy: 0 }
  },
  {
    id: 'chip-menos',
    nome: 'O "−" do chip de grupo',
    html: `<div class="dice-roller-3d-group-chip"><span>3×d20</span><button class="btn btn-ghost" id="alvo">-</button><button class="btn btn-ghost">+</button></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'modificador-menos',
    nome: 'O "−" do modificador',
    html: `<div class="dice-roller-3d-modifier-campo"><button class="btn btn-ghost dice-roller-3d-modifier-btn" id="alvo">−</button><input value="0" style="width:46px"><button class="btn btn-ghost dice-roller-3d-modifier-btn">+</button></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'rolar',
    nome: 'O ROLAR (primário)',
    html: `<button class="btn btn-primary" id="alvo">ROLAR</button>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'preset-rolar',
    nome: 'Cartão de preset — a área de rolar',
    html: `<div class="preset-card" style="width:240px"><button class="preset-card-main" id="alvo"><span class="preset-card-icon">R</span><span class="preset-card-text"><span class="preset-card-name">Bola de fogo</span><span class="preset-card-expression">8d6</span></span></button><div class="preset-card-actions"><button class="preset-card-action">e</button><button class="preset-card-action preset-card-action-delete">x</button></div></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'preset-editar',
    nome: 'Cartão de preset — o lápis',
    html: `<div class="preset-card" style="width:240px"><button class="preset-card-main"><span class="preset-card-text"><span class="preset-card-name">Bola de fogo</span><span class="preset-card-expression">8d6</span></span></button><div class="preset-card-actions"><button class="preset-card-action" id="alvo">e</button><button class="preset-card-action preset-card-action-delete">x</button></div></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'ficha-dado',
    nome: 'O dado da Ficha (rolar campo)',
    html: `<span class="sheet-field-value" style="height:24px"><input value="+7" style="width:60px"><button class="sheet-roll" id="alvo" style="height:24px"><b style="font-size:12px;line-height:1">R</b></button></span>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'compacto-preset',
    nome: 'Preset do modo compacto (a referência que já era certa)',
    html: `<button class="compact-preset" id="alvo" style="width:150px"><span class="compact-preset-icon">R</span><span class="compact-preset-name">Bola de fogo</span></button>`,
    esperado: { dx: 1, dy: 1 }
  },
  /* As barras de recurso (spec §3.4) — a família de botão mais clicada de uma sessão. */
  {
    id: 'barra-menos',
    nome: 'O "−" da barra de recurso',
    html: `<div class="barra-recurso barra-normal" style="width:260px"><span class="barra-nome">PV</span><div class="barra-trilho"><div class="barra-preenchido" style="width:60%"></div></div><button class="barra-passo" id="alvo"><b>−</b></button><button class="barra-valor">30<span class="barra-valor-max">/45</span></button><button class="barra-passo"><b>+</b></button></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'barra-menos-compacta',
    nome: 'O "−" da barra de recurso, modo compacto',
    html: `<div class="barra-recurso barra-normal barra-compacta" style="width:240px"><span class="barra-nome">PV</span><div class="barra-trilho"><div class="barra-preenchido" style="width:60%"></div></div><button class="barra-passo" id="alvo"><b>−</b></button><button class="barra-valor">30<span class="barra-valor-max">/45</span></button><button class="barra-passo"><b>+</b></button></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'barra-valor',
    nome: 'O NÚMERO da barra — afundado sempre, clicar não afunda de novo',
    html: `<div class="barra-recurso barra-normal" style="width:260px"><span class="barra-nome">PV</span><div class="barra-trilho"><div class="barra-preenchido" style="width:60%"></div></div><button class="barra-passo"><b>−</b></button><button class="barra-valor" id="alvo"><b>30</b><span class="barra-valor-max">/45</span></button><button class="barra-passo"><b>+</b></button></div>`,
    esperado: { dx: 0, dy: 0 }
  },
  /* A estrela do cartão (spec §3.9): mesma família do lápis/✕, na coluna do outro lado. */
  {
    id: 'preset-estrela',
    nome: 'Cartão de preset — a estrela',
    html: `<div class="preset-card" style="width:260px"><div class="preset-card-favorito-coluna"><button class="preset-card-action preset-card-estrela" id="alvo"><b style="font-size:12px;line-height:1">S</b></button></div><button class="preset-card-main"><span class="preset-card-text"><span class="preset-card-name">Bola de fogo</span><span class="preset-card-expression">8d6</span></span></button><div class="preset-card-actions"><button class="preset-card-action">e</button><button class="preset-card-action preset-card-action-delete">x</button></div></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  /* O copiar pro chat (spec §3.5): plano até o mouse chegar, como o lápis. */
  {
    id: 'copiar',
    nome: 'O copiar pro chat, na linha de resultado',
    html: `<div class="dice-roller-3d-result" style="width:300px"><span>Total: <strong>17</strong><button class="botao-copiar" id="alvo"><b style="font-size:11px;line-height:1">C</b></button></span></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'copiar-pequeno',
    nome: 'O copiar pro chat, miúdo (histórico e compacto)',
    html: `<div class="history-entry" style="width:300px"><span class="history-entry-total">= 17</span><button class="botao-copiar botao-copiar-pequeno" id="alvo"><b style="font-size:10px;line-height:1">C</b></button></div>`,
    esperado: { dx: 1, dy: 1 }
  },
  {
    id: 'barras-lapis',
    nome: 'O lápis da legenda "Recursos"',
    html: `<fieldset class="barras-de-recurso" style="width:300px"><legend>Recursos <button class="barras-editar" id="alvo"><b style="font-size:11px;line-height:1">e</b></button></legend><p class="barras-vazio">—</p></fieldset>`,
    esperado: { dx: 1, dy: 1 }
  }
]

function paginaDeTeste(cssUrl, casosHtml) {
  return `<!DOCTYPE html><html data-theme="day"><head><meta charset="utf-8">
<link rel="stylesheet" href="${cssUrl}">
<style>body{margin:0;padding:20px;background:#c0c0c0;display:flex;flex-direction:column;gap:24px;align-items:flex-start}</style>
</head><body>${casosHtml}</body></html>`
}

/**
 * BGRA do capturePage → soma de diferenças absolutas entre dois recortes, um deslocado.
 * A margem de 6px deixa DE FORA a borda de 2px do botão e o serrilhado dela: o que se mede é o
 * MIOLO (o rótulo), que é o que tem que andar 1px — a borda muda de relevo por conta própria.
 */
function somaDeDiferencas(a, b, largura, altura, margem, dx, dy) {
  let soma = 0
  let quantos = 0
  for (let y = margem; y < altura - margem; y++) {
    for (let x = margem; x < largura - margem; x++) {
      const xa = x - dx
      const ya = y - dy
      if (xa < 0 || ya < 0 || xa >= largura || ya >= altura) continue
      const ia = (ya * largura + xa) * 4
      const ib = (y * largura + x) * 4
      for (let c = 0; c < 3; c++) soma += Math.abs(a[ia + c] - b[ib + c])
      quantos++
    }
  }
  return soma / Math.max(1, quantos)
}

/**
 * O (dx, dy) em [-3..3]² que melhor explica o quadro apertado como o quadro do hover deslocado.
 * Empate (ou quase-empate de 2%) fica com o deslocamento MENOR: o serrilhado de subpixel do texto
 * cria mínimos quase iguais em vizinhos, e sem o desempate a medida pulava pra (2, 1) num botão
 * que andou (1, 1).
 */
function deslocamentoMedido(solto, apertado, largura, altura) {
  // Botão pequeno (o lápis tem 20×15) fica sem miolo com margem 6 — a margem se adapta.
  const margem = Math.min(largura, altura) < 24 ? 4 : 6
  let melhor = { dx: 0, dy: 0, erro: Infinity }
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const erro = somaDeDiferencas(solto, apertado, largura, altura, margem, dx, dy)
      const magnitude = Math.abs(dx) + Math.abs(dy)
      const magMelhor = Math.abs(melhor.dx) + Math.abs(melhor.dy)
      if (erro < melhor.erro * 0.98 || (erro <= melhor.erro * 1.02 && magnitude < magMelhor)) {
        if (erro < melhor.erro || magnitude < magMelhor) melhor = { dx, dy, erro: Math.min(erro, melhor.erro) }
      }
    }
  }
  return melhor
}

async function capturarRecorte(win, rect) {
  const imagem = await win.webContents.capturePage(rect)
  const { width, height } = imagem.getSize()
  return { bytes: imagem.toBitmap(), png: imagem.toPNG(), largura: width, altura: height }
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

/** Botão de miolo liso tem erro mínimo ~0; o piso evita dividir por quase-zero na razão. */
function melhorErroComPiso(erro) {
  return Math.max(erro, 2)
}

/** Ampliação 4× por vizinho mais próximo — cada pixel vira um quadrado 4×4, sem borrar. */
function ampliar4x(quadro) {
  const F = 4
  const saida = Buffer.alloc(quadro.largura * F * quadro.altura * F * 4)
  for (let y = 0; y < quadro.altura * F; y++) {
    for (let x = 0; x < quadro.largura * F; x++) {
      const io = (Math.floor(y / F) * quadro.largura + Math.floor(x / F)) * 4
      const id = (y * quadro.largura * F + x) * 4
      for (let c = 0; c < 4; c++) saida[id + c] = quadro.bytes[io + c]
    }
  }
  return nativeImage.createFromBitmap(saida, { width: quadro.largura * F, height: quadro.altura * F })
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 480,
    height: 900,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })

  const casosHtml = CASOS.map(
    (c) => `<section data-caso="${c.id}">${c.html.replace('id="alvo"', `id="alvo-${c.id}"`)}</section>`
  ).join('\n')
  const html = paginaDeTeste(pathToFileURL(cssDeProducao()).href, casosHtml)
  const pasta = join(RAIZ, 'out', 'reteste-botoes')
  mkdirSync(pasta, { recursive: true })
  const arquivo = join(pasta, 'pagina.html')
  writeFileSync(arquivo, html)
  await win.loadFile(arquivo)
  await espera(300)
  // AQUECIMENTO: o primeiro evento de entrada depois do load era engolido — o primeiro caso da
  // primeira rodada saiu com "mudança 0.0", clique nenhum. Um movimento perdido paga o pedágio.
  win.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 5 })
  await espera(120)

  let falhas = 0
  for (const caso of CASOS) {
    const rect = await win.webContents.executeJavaScript(
      `(() => { const el = document.getElementById('alvo-${caso.id}'); const r = el.getBoundingClientRect();
        return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height),
                 cx: Math.floor(r.x + r.width / 2), cy: Math.floor(r.y + r.height / 2) } })()`
    )

    /**
     * A base de comparação é o HOVER, não o repouso: botão ghost ganha o degrau quando o mouse
     * chega (e é assim no 98 de verdade), então repouso→clique mistura duas mudanças. O gesto que
     * o usuário sente como "afundar" é hover→clique — o mouse já está em cima quando aperta.
     */
    /** A posição do CONTEÚDO direto do motor de layout — o número exato, sem passar por pixel. */
    const sondaDeLayout = `(() => { const alvo = document.getElementById('alvo-${caso.id}'); const el = document.querySelector('#alvo-${caso.id} span, #alvo-${caso.id} b, #alvo-${caso.id} img') ?? alvo; const r = el.getBoundingClientRect(); const ra = alvo.getBoundingClientRect(); return { x: r.x - ra.x, y: r.y - ra.y, bx: ra.x, by: ra.y, padding: getComputedStyle(alvo).padding, sonda: el.className || el.tagName } })()`

    win.webContents.sendInputEvent({ type: 'mouseMove', x: rect.cx, y: rect.cy })
    await espera(100)
    const solto = await capturarRecorte(win, rect)
    const conteudoAntes = await win.webContents.executeJavaScript(sondaDeLayout)
    win.webContents.sendInputEvent({ type: 'mouseDown', x: rect.cx, y: rect.cy, button: 'left', clickCount: 1 })
    await espera(120)
    const apertado = await capturarRecorte(win, rect)
    const conteudoDurante = await win.webContents.executeJavaScript(sondaDeLayout)
    const layoutDx = conteudoDurante.x - conteudoAntes.x
    const layoutDy = conteudoDurante.y - conteudoAntes.y
    win.webContents.sendInputEvent({ type: 'mouseUp', x: rect.cx, y: rect.cy, button: 'left', clickCount: 1 })
    // Tira o mouse de cima antes do próximo caso, pra nenhum hover vazar de um botão pro outro.
    win.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 5 })
    await espera(80)

    const medido = deslocamentoMedido(solto.bytes, apertado.bytes, solto.largura, solto.altura)
    const parado = somaDeDiferencas(solto.bytes, apertado.bytes, solto.largura, solto.altura, 6, 0, 0)
    /**
     * O veredito não é só o argmin: texto com antialias de subpixel (ClearType) faz vizinhos de
     * 1px empatarem quase — e o "melhor" pulava pra (2,1) num botão que andou (1,1). A pergunta
     * certa é "o deslocamento ESPERADO explica o quadro quase tão bem quanto o melhor palpite?"
     * — dentro de 15%, é o mesmo gesto com ruído de rasterização. Quem espera (1,1) ainda precisa
     * de mudança de verdade (`parado`), senão um botão morto passaria pela razão de erros.
     */
    const margem = Math.min(solto.largura, solto.altura) < 24 ? 4 : 6
    const erroEsperado = somaDeDiferencas(
      solto.bytes, apertado.bytes, solto.largura, solto.altura, margem, caso.esperado.dx, caso.esperado.dy
    )
    const exato = medido.dx === caso.esperado.dx && medido.dy === caso.esperado.dy
    const quaseIgual = erroEsperado <= melhorErroComPiso(medido.erro) * 1.15
    const mexeu = caso.esperado.dx === 0 || parado > 10
    const ok = exato || (quaseIgual && mexeu)
    if (!ok) {
      falhas++
      // Os dois quadros vão pro disco pra conferência de olho — medir não dispensa olhar o errado.
      writeFileSync(join(pasta, `${caso.id}-antes.png`), solto.png)
      writeFileSync(join(pasta, `${caso.id}-durante.png`), apertado.png)
      // E ampliados 4× (vizinho mais próximo), porque no tamanho real ninguém conta pixel no olho.
      writeFileSync(join(pasta, `${caso.id}-antes-4x.png`), ampliar4x(solto).toPNG())
      writeFileSync(join(pasta, `${caso.id}-durante-4x.png`), ampliar4x(apertado).toPNG())
    }
    console.log(
      `${ok ? 'OK ' : 'ERRO'}  ${caso.nome}\n      deslocou (${medido.dx}, ${medido.dy}) — esperado (${caso.esperado.dx}, ${caso.esperado.dy}); ` +
        `mudança: ${parado.toFixed(1)}; erro esperado ${erroEsperado.toFixed(1)} vs melhor ${medido.erro.toFixed(1)}; ` +
        `layout andou (${layoutDx.toFixed(2)}, ${layoutDy.toFixed(2)})` +
        (ok
          ? ''
          : `\n      botão andou (${(conteudoDurante.bx - conteudoAntes.bx).toFixed(2)}, ${(conteudoDurante.by - conteudoAntes.by).toFixed(2)}); ` +
            `sonda "${conteudoAntes.sonda}" relativa ao botão: (${conteudoAntes.x.toFixed(2)}, ${conteudoAntes.y.toFixed(2)}) → (${conteudoDurante.x.toFixed(2)}, ${conteudoDurante.y.toFixed(2)}); ` +
            `padding ${conteudoAntes.padding} → ${conteudoDurante.padding}`)
    )
    if (caso.esperado.dx === 0 && parado > 8 && medido.dx === 0 && medido.dy === 0) {
      // Marcado que "pisca" sem deslocar: mudança alta com deslocamento zero merece um aviso.
      console.log('      (aviso: houve mudança visual além do deslocamento — conferir no olho)')
    }
  }

  console.log(falhas === 0 ? '\nTodos os botões afundam como o 98 manda.' : `\n${falhas} botão(ões) afundando errado.`)
  app.exit(falhas === 0 ? 0 : 1)
})
