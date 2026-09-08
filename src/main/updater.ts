import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IpcChannels } from '@shared/ipcChannels'
import type { UpdateStatus } from '@shared/types/update'

/**
 * Atualização pelo GitHub Releases, com um desenho conservador a pedido dele: "quero que o app
 * funcione offline, e que SE a pessoa quiser ela pode ir nas configs e apertar".
 *
 * - o app PERGUNTA se existe versão nova (uma requisição curta por abertura) e não baixa nada por
 *   conta própria; sem internet a pergunta falha e vira uma linha de estado;
 * - o download só começa depois de a pessoa pedir e confirmar DUAS vezes nas Preferências, porque são
 *   ~100MB;
 * - terminado o download, o app reinicia sozinho, que é o que ela pediu ao confirmar.
 *
 * O endereço não está aqui: o `electron-builder` grava o bloco `publish` do `electron-builder.yml`
 * num `app-update.yml` dentro do pacote, e é dele que o `electron-updater` lê.
 */

/** Espera antes da primeira checagem: a abertura já tem splash, cena 3D e leitura de preferências disputando; a rede pode esperar. */
const FIRST_CHECK_DELAY_MS = 6000

/**
 * De quanto em quanto tempo o app pergunta de novo, com ele ABERTO: antes só perguntava na abertura,
 * então quem deixa o Reroll aberto a sessão inteira só descobriria a versão nova no dia seguinte.
 *
 * Uma hora. O que se gasta não é banda (a requisição é um arquivo de 350 bytes), é a paciência de
 * quem joga: encontrar a atualização faz o app PERGUNTAR, e a pergunta só acontece uma vez por versão.
 */
const PERIODIC_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Respiro entre "baixou" e "reinicia", pra a interface mostrar que terminou antes de a janela sumir. */
const RESTART_DELAY_MS = 1500

let currentStatus: UpdateStatus = { state: 'idle' }
/**
 * De onde sai a janela pra onde o progresso é mandado. É uma FUNÇÃO e não a janela guardada: o
 * download sobrevive a ela (ver `setStatus`), e perguntar na hora mantém isto certo se a janela for
 * recriada um dia.
 */
let obterJanela: () => BrowserWindow | null = () => null
/** Versão encontrada, guardada à parte: o evento de progresso do download não repete qual versão está baixando. */
let pendingVersion = ''

function setStatus(status: UpdateStatus): void {
  currentStatus = status
  // A janela pode não existir: o download continua depois de ela fechar, e mandar pra uma janela
  // morta derruba o processo main com "Object has been destroyed".
  obterJanela()?.webContents.send(IpcChannels.updateStatus, status)
}

/**
 * Quanto tempo o aviso de "instalando" fica na tela antes de o app sair. É o único momento em que dá
 * pra explicar o que vai acontecer: depois disto a janela não existe mais e o instalador roda em
 * silêncio, sem janela própria.
 */
const AVISO_ANTES_DE_SAIR_MS = 2200

/**
 * Fecha o app e entrega o lugar ao instalador, com aviso na tela e saída limpa.
 *
 * Ele relatou "a tela do desktop das pessoas está travando" na atualização, e eram duas causas
 * somadas: o UAC acendendo a área de trabalho segura (resolvido no empacotamento, com
 * `allowElevation: false`) e o VAZIO entre a janela fechar e a versão nova abrir, que é o que esta
 * função trata.
 *
 * As janelas são DESTRUÍDAS antes do `quitAndInstall` por um motivo prático: enquanto o processo
 * antigo vive, ele segura arquivos da pasta de instalação e o instalador fica esperando por eles.
 */
function instalarAgora(version: string): void {
  setStatus({ state: 'installing', version })

  /**
   * O aviso só serve se for VISTO: o app pode estar minimizado ou atrás do navegador quando a
   * atualização termina, e aí a pessoa vê a tela piscar sem ter lido a explicação — que é exatamente
   * o que ela relatou como travamento. Devolve o "sempre no topo" antes de sair.
   */
  const janela = obterJanela()
  if (janela) {
    if (janela.isMinimized()) janela.restore()
    janela.setAlwaysOnTop(true)
    janela.show()
    janela.focus()
  }

  setTimeout(() => {
    if (janela && !janela.isDestroyed()) janela.setAlwaysOnTop(false)
    for (const aberta of BrowserWindow.getAllWindows()) aberta.destroy()
    /**
     * `isSilent`, `isForceRunAfter`: instala sem assistente e reabre o Reroll na versão nova. Com o
     * assistente, quem não é de computador teria que clicar em "Avançar" pra terminar uma
     * atualização que já confirmou duas vezes.
     */
    autoUpdater.quitAndInstall(true, true)
  }, AVISO_ANTES_DE_SAIR_MS)
}

export function registerUpdateHandlers(janela: () => BrowserWindow | null): void {
  obterJanela = janela

  ipcMain.handle(IpcChannels.appGetVersion, () => app.getVersion())
  ipcMain.handle(IpcChannels.updateGetStatus, () => currentStatus)
  ipcMain.handle(IpcChannels.updateCheck, () => checkForUpdates())
  ipcMain.handle(IpcChannels.updateDownload, async () => {
    // Só faz sentido a partir de uma versão já encontrada; chamar fora disso não faz nada em vez de
    // disparar um download do nada.
    if (currentStatus.state !== 'available') return
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      setStatus({ state: 'error', message: (error as Error).message })
    }
  })
  ipcMain.handle(IpcChannels.updateInstallNow, () => {
    if (currentStatus.state !== 'ready') return
    instalarAgora(currentStatus.version)
  })

  /**
   * Em `npm run dev` não existe pacote pra substituir e o `electron-updater` reclama a cada checagem.
   * Sai antes de assinar qualquer evento: o estado fica `idle` e a tela mostra só a versão.
   */
  if (!app.isPackaged) return

  /**
   * A build PORTÁTIL (spec §8.4) não se atualiza: o `electron-updater` baixa um instalador NSIS e o
   * roda, e quem escolheu o .exe solto escolheu não ter instalador. O estado fica `portable` e a
   * interface diz onde baixar a nova.
   */
  if (ehBuildPortatil()) {
    setStatus({ state: 'portable' })
    return
  }

  // NÃO baixa sozinho: encontrar a versão nova é uma coisa, gastar a internet de alguém é outra.
  // Quem começa o download é `IpcChannels.updateDownload`, e só depois de duas confirmações.
  autoUpdater.autoDownload = false

  /**
   * OBRIGATÓRIO, e a razão foi medida: as versões deste app têm sufixo `-alpha`, e isso NÃO liga o
   * `allowPrerelease` sozinho — rodando o `electron-updater` contra a release de verdade ele veio
   * `false`. Desligado, o provedor do GitHub consulta `/releases/latest`, que ignora pré-lançamento
   * ("Unable to find latest version on GitHub"), ou seja, atualização nenhuma chega a quem instalou.
   * O preço é que, com uma `1.0.0` estável junto de uma `1.1.0-beta`, o app puxa a beta.
   */
  autoUpdater.allowPrerelease = true

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => setStatus({ state: 'upToDate' }))
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version
    setStatus({ state: 'available', version: info.version, notes: textoDasNotas(info.releaseNotes) })
  })
  autoUpdater.on('download-progress', (progress) =>
    setStatus({
      state: 'downloading',
      version: pendingVersion,
      percent: Math.round(progress.percent)
    })
  )
  autoUpdater.on('update-downloaded', (info) => {
    setStatus({ state: 'ready', version: info.version })
    /**
     * Reinicia sozinho, e não é atalho: chegar aqui exige ter confirmado duas vezes, e a segunda diz
     * com todas as letras que o app vai reiniciar. A espera curta é pra a tela alcançar a mudança de
     * estado — sem ela o app some no meio da barra de progresso, o que parece travamento.
     */
    setTimeout(() => instalarAgora(info.version), RESTART_DELAY_MS)
  })
  autoUpdater.on('error', (error) => setStatus({ state: 'error', message: error.message }))

  setTimeout(() => void checkForUpdates(), FIRST_CHECK_DELAY_MS)
  /**
   * `setInterval` sem `unref`: no main o Electron mantém o laço vivo pela janela e não pelos
   * temporizadores, então isto não segura o app aberto na hora de fechar. Não checa enquanto já está
   * baixando ou com uma versão pronta — refazer a pergunta só sobrescreveria o progresso na tela.
   */
  setInterval(() => {
    if (currentStatus.state === 'downloading' || currentStatus.state === 'ready') return
    void checkForUpdates()
  }, PERIODIC_CHECK_INTERVAL_MS)
}

/**
 * O CHANGELOG da release, virado em texto simples. O `electron-updater` entrega `releaseNotes` de
 * três jeitos conforme o provedor: texto puro, HTML (o caso do GitHub) ou uma lista de versões quando
 * há mais de uma release entre a instalada e a nova.
 *
 * As tags são TIRADAS em vez de renderizadas, e é decisão de segurança: o texto vem de fora (a
 * descrição de uma release na internet), e a alternativa daria a uma string remota o direito de virar
 * marcação dentro do app. O corte em 2000 caracteres é pra a janela não virar um rolo sem fim.
 */
export function textoDasNotas(bruto: unknown): string | undefined {
  const cru = Array.isArray(bruto)
    ? bruto
        .map((entrada) => (entrada as { note?: unknown } | null)?.note)
        .filter((nota): nota is string => typeof nota === 'string')
        .join('\n\n')
    : typeof bruto === 'string'
      ? bruto
      : ''

  const limpo = cru
    // `<br>` e `</p>` viram quebra de linha ANTES de as tags sumirem, senão o texto vira um bloco só.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return limpo ? limpo.slice(0, 2000) : undefined
}

/** É o .exe solto (spec §8.4)? O lançador portátil do electron-builder deixa esta variável no ambiente. */
export function ehBuildPortatil(): boolean {
  return typeof process.env.PORTABLE_EXECUTABLE_DIR === 'string' && process.env.PORTABLE_EXECUTABLE_DIR !== ''
}

/**
 * Uma falha aqui é ROTINA, não exceção: computador sem internet, GitHub fora do ar, release ainda não
 * publicada. Vira uma linha de estado nas Preferências e nada mais — nunca um diálogo de erro por
 * cima do app de quem só queria rolar dados.
 */
async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged || ehBuildPortatil()) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setStatus({ state: 'error', message: (error as Error).message })
  }
}
