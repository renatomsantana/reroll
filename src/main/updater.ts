import { app, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IpcChannels } from '@shared/ipcChannels'
import type { UpdateStatus } from '@shared/types/update'

/**
 * Atualização pelo GitHub Releases, e o desenho aqui é DELIBERADAMENTE conservador, a pedido do
 * usuário: "quero que o app funcione offline, e que SE a pessoa quiser ela pode ir nas configs e
 * apertar".
 *
 * Ou seja:
 * - O app PERGUNTA se existe versão nova (uma requisição curta, uma vez por abertura) mas NÃO baixa
 *   nada por conta própria. Sem internet, a pergunta falha e vira uma linha de estado — o resto do
 *   app não depende dela em momento nenhum, então continua inteiro offline.
 * - O download só começa depois de a pessoa pedir e confirmar DUAS vezes, na tela de Preferências
 *   (ver `UpdateSection.tsx`). São 76MB; puxar isso da conexão de alguém sem avisar não é educado.
 * - Terminado o download, aí sim o app reinicia sozinho pra aplicar — é o que a pessoa pediu quando
 *   confirmou, e o texto da confirmação diz exatamente isso antes de começar.
 *
 * O endereço não está aqui: o `electron-builder` grava o bloco `publish` do `electron-builder.yml`
 * num `app-update.yml` dentro do pacote, e é dele que o `electron-updater` lê. Trocar de
 * hospedagem é mexer só naquele arquivo.
 */

/** Espera antes da primeira checagem: a abertura já tem splash, cena 3D e leitura de preferências disputando; a rede pode esperar. */
const FIRST_CHECK_DELAY_MS = 6000

/**
 * De quanto em quanto tempo o app pergunta de novo, com ele ABERTO — pedido do usuário ("quero que
 * o app fique checando se tem novidades"). Antes só perguntava na abertura, então quem deixa o
 * Reroll aberto a sessão inteira só descobriria a versão nova no dia seguinte.
 *
 * Uma hora: a requisição é um arquivo de 350 bytes, mas o que se está gastando aqui não é banda, é
 * a paciência de quem joga — encontrar a atualização faz o app PERGUNTAR (ver `UpdatePrompt.tsx`),
 * e ninguém quer ser interrompido de dez em dez minutos. Como a pergunta só acontece uma vez por
 * versão, o intervalo curto não traria nada.
 */
const PERIODIC_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Respiro entre "baixou" e "reinicia", pra a interface mostrar que terminou antes de a janela sumir. */
const RESTART_DELAY_MS = 1500

let currentStatus: UpdateStatus = { state: 'idle' }
let mainWindow: BrowserWindow | null = null
/** Versão encontrada, guardada à parte: o evento de progresso do download não repete qual versão está baixando. */
let pendingVersion = ''

function setStatus(status: UpdateStatus): void {
  currentStatus = status
  // `isDestroyed` porque o download continua depois da janela fechar — mandar pra uma janela morta
  // derruba o processo main com "Object has been destroyed".
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannels.updateStatus, status)
  }
}

export function registerUpdateHandlers(window: BrowserWindow): void {
  mainWindow = window

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
    // `isSilent = true`, `isForceRunAfter = true`: instala sem assistente e reabre o Reroll na
    // versão nova. O botão só existe quando a atualização JÁ está baixada, então não há espera aqui.
    autoUpdater.quitAndInstall(true, true)
  })

  /**
   * Em `npm run dev` não existe pacote pra substituir e o `electron-updater` reclama disso a cada
   * checagem. Sai antes de assinar qualquer evento: o estado fica `idle` e a interface mostra só a
   * versão, sem botão de procurar.
   */
  if (!app.isPackaged) return

  // NÃO baixa sozinho: encontrar a versão nova é uma coisa, gastar a internet de alguém é outra.
  // Quem começa o download é `IpcChannels.updateDownload`, e só depois de duas confirmações.
  autoUpdater.autoDownload = false

  /**
   * OBRIGATÓRIO aqui, e a razão foi medida, não suposta: as versões deste app têm sufixo `-alpha`,
   * e eu havia suposto que isso ligava o `allowPrerelease` sozinho. Rodando o próprio
   * `electron-updater` contra a release de verdade, ele veio `false` — e com ele desligado o
   * provedor do GitHub consulta `/releases/latest`, que IGNORA release marcada como pré-lançamento.
   * Resultado: "Unable to find latest version on GitHub, please ensure a production release
   * exists", ou seja, atualização nenhuma chega em quem instalou.
   *
   * Ligado, ele passa a ler o feed de releases (que lista as duas coisas), então funciona tanto com
   * release normal quanto com pré-lançamento. O preço é que, se um dia sair uma `1.0.0` estável
   * junto de uma `1.1.0-beta`, o app puxa a beta — o que é o comportamento certo pra um app que
   * ainda se distribui em alfa entre amigos.
   */
  autoUpdater.allowPrerelease = true

  autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => setStatus({ state: 'upToDate' }))
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version
    setStatus({ state: 'available', version: info.version })
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
     * Reinicia sozinho. Não é atalho: chegar aqui exige ter clicado em atualizar e confirmado duas
     * vezes, e a segunda confirmação diz com todas as letras que o app vai reiniciar. A espera curta
     * é só pra a tela alcançar a mudança de estado — sem ela o app some no meio da barra de
     * progresso, o que parece travamento, não conclusão.
     */
    setTimeout(() => autoUpdater.quitAndInstall(true, true), RESTART_DELAY_MS)
  })
  autoUpdater.on('error', (error) => setStatus({ state: 'error', message: error.message }))

  setTimeout(() => void checkForUpdates(), FIRST_CHECK_DELAY_MS)
  /**
   * `setInterval` sem `unref`: no processo main o Electron mantém o laço de eventos vivo pela
   * janela, não pelos temporizadores, então isto não segura o app aberto na hora de fechar.
   *
   * Não checa enquanto já está baixando ou com uma versão pronta — nesses estados a resposta já é
   * conhecida e refazer a pergunta só sobrescreveria o progresso na tela.
   */
  setInterval(() => {
    if (currentStatus.state === 'downloading' || currentStatus.state === 'ready') return
    void checkForUpdates()
  }, PERIODIC_CHECK_INTERVAL_MS)
}

/**
 * Uma falha aqui é ROTINA, não exceção: computador sem internet, GitHub fora do ar, release ainda
 * não publicada. Vira uma linha de estado na tela de Preferências e nada mais — nunca um diálogo
 * de erro por cima do app de quem só queria rolar dados.
 */
async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setStatus({ state: 'error', message: (error as Error).message })
  }
}
