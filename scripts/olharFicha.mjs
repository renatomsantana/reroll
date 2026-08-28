/**
 * OLHAR A ABA FICHA com um personagem de verdade, em janela OCULTA (nunca captura de tela).
 *
 * Usa o build web (`out/web/`), que roda o app inteiro com os handlers reais: o script semeia um
 * personagem de Ordem Paranormal por `window.api.sheets.apply` — o MESMO canal da importação de
 * PDF —, abre a aba Ficha e fotografa do topo ao fim da rolagem. É o retrato honesto do que uma
 * pessoa vê depois de importar a ficha dela.
 *
 *     npm run build:web && npx electron scripts/olharFicha.mjs
 *
 * Grava `out/olhar-ficha/ficha-topo.png`, `ficha-meio.png` e `ficha-fim.png`.
 */
import { app, BrowserWindow } from 'electron'
import { createServer } from 'http'
import { promises as fs, mkdirSync, writeFileSync } from 'fs'
import { extname, join, normalize, resolve } from 'path'

const RAIZ = resolve(import.meta.dirname, '..')
const PASTA_DO_SITE = join(RAIZ, 'out', 'web')
const SAIDA = join(RAIZ, 'out', 'olhar-ficha')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm'
}

const servidor = createServer((pedido, resposta) => {
  const caminho = normalize(join(PASTA_DO_SITE, pedido.url === '/' ? 'index.html' : pedido.url.split('?')[0]))
  fs.readFile(caminho)
    .then((conteudo) => {
      const tipo = MIME[extname(caminho)] ?? 'application/octet-stream'
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

/** O personagem semeado: o retrato típico de uma ficha de Ordem Paranormal importada. */
const FICHA = {
  characterName: 'Matias Oliveira',
  system: 'Ordem Paranormal',
  notes: {
    blocks: {
      abilities: 'Ocultista de campo. Ritual: Enfeitiçar (1º círculo). Perito em pesquisa de campo.',
      inventory: 'Faca de mato\nLanterna tática\nKit de médico\nDiário de anotações\nAmuleto de proteção',
      backstory:
        'Agente de saúde de Cascavel, entrou na Ordem depois do caso do Hospital Santa Clara. Procura o irmão desaparecido.'
    },
    sections: [
      {
        title: 'Identificação',
        fields: [
          { label: 'Jogador', value: 'Renato' },
          { label: 'Origem', value: 'Agente de Saúde' },
          { label: 'Classe', value: 'Especialista' },
          { label: 'Trilha', value: 'Médico de Campo' },
          { label: 'NEX', value: '35%' },
          { label: 'Patente', value: 'Operador' }
        ]
      },
      {
        title: 'Atributos',
        fields: [
          { label: 'Agilidade', value: '2', roll: 'pool-d20' },
          { label: 'Força', value: '1', roll: 'pool-d20' },
          { label: 'Intelecto', value: '3', roll: 'pool-d20' },
          { label: 'Presença', value: '2', roll: 'pool-d20' },
          { label: 'Vigor', value: '1', roll: 'pool-d20' }
        ]
      },
      {
        title: 'Perícias',
        fields: [
          { label: 'Atualidades', value: '+5', roll: 'd20' },
          { label: 'Ciências', value: '+10', roll: 'd20' },
          { label: 'Investigação', value: '+10', roll: 'd20' },
          { label: 'Luta', value: '+2', roll: 'd20' },
          { label: 'Medicina', value: '+12', roll: 'd20' },
          { label: 'Ocultismo', value: '+7', roll: 'd20' },
          { label: 'Percepção', value: '+5', roll: 'd20' },
          { label: 'Profissão', value: '+7', roll: 'd20' },
          { label: 'Reflexos', value: '+4', roll: 'd20' },
          { label: 'Sobrevivência', value: '+5', roll: 'd20' },
          { label: 'Tática', value: '+3', roll: 'd20' },
          { label: 'Vontade', value: '+5', roll: 'd20' }
        ]
      },
      {
        title: 'Recursos',
        fields: [
          { label: 'Pontos de Vida', value: '45' },
          { label: 'Pontos de Esforço', value: '9' },
          { label: 'Sanidade', value: '38' },
          { label: 'Defesa', value: '17' },
          { label: 'Deslocamento', value: '9m' }
        ]
      }
    ]
  },
  presets: [],
  recursos: [
    { nome: 'PV', atual: 32, maximo: 45 },
    { nome: 'PE', atual: 6, maximo: 9 },
    { nome: 'SAN', atual: 31, maximo: 38 }
  ]
}

async function fotografarFicha() {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  await win.loadURL(`http://127.0.0.1:${servidor.address().port}/`).catch(() => {})
  // Splash + cena; depois a semeadura e a troca de aba.
  await new Promise((r) => setTimeout(r, 9000))

  await win.webContents.executeJavaScript(
    `window.api.sheets.apply(${JSON.stringify(FICHA)}).then(() => 'ok')`,
    true
  )
  /**
   * RECARREGA depois de semear: o `apply` grava e ativa o personagem novo por baixo do React, que
   * já tinha carregado o antigo — recarregar é o que faz o app abrir já no Matias, como abriria
   * na vida real. A aba é o botão com "Ficha" no rótulo.
   */
  win.webContents.reload()
  await new Promise((r) => setTimeout(r, 9000))
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Ficha')).click()`,
    true
  )
  await new Promise((r) => setTimeout(r, 1200))

  const fotos = [
    ['ficha-topo', 0],
    ['ficha-meio', 800],
    ['ficha-fim', 99999]
  ]
  for (const [nome, rolagem] of fotos) {
    await win.webContents.executeJavaScript(
      `document.querySelector('.sheet-tab-body')?.scrollTo(0, ${rolagem})`,
      true
    )
    await new Promise((r) => setTimeout(r, 400))
    writeFileSync(join(SAIDA, `${nome}.png`), (await win.webContents.capturePage()).toPNG())
  }

  /**
   * A ficha ROLA DADO: clica no dadinho da Medicina (+12) e fotografa onde o app foi parar — é o
   * caminho ficha → bandeja inteiro, que é o motivo de a ficha existir dentro de um rolador.
   */
  await win.webContents.executeJavaScript(
    `document.querySelector('.sheet-tab-body')?.scrollTo(0, 0)`,
    true
  )
  await win.webContents.executeJavaScript(
    `[...document.querySelectorAll('.sheet-roll')].at(${5 + 4}).click()`,
    true
  )
  await new Promise((r) => setTimeout(r, 4500))
  writeFileSync(join(SAIDA, 'ficha-rolagem.png'), (await win.webContents.capturePage()).toPNG())
  win.destroy()
}

app.on('window-all-closed', () => {})

app
  .whenReady()
  .then(async () => {
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r))
    mkdirSync(SAIDA, { recursive: true })
    await fotografarFicha()
    servidor.close()
    console.log('gravado ficha-topo.png, ficha-meio.png e ficha-fim.png')
    app.exit(0)
  })
  .catch((causa) => {
    console.error('Não deu pra olhar a ficha:', causa)
    app.exit(1)
  })
