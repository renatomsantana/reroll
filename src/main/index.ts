import { join } from 'path'
import { app, BrowserWindow, dialog } from 'electron'
import { registerPresetsHandlers } from './ipc/registerPresetsHandlers'
import { registerNotesHandlers } from './ipc/registerNotesHandlers'
import { registerWindowHandlers } from './ipc/registerWindowHandlers'
import { resolveAppIconPath } from './appIconPaths'
import { registerSceneBackgroundHandlers } from './ipc/registerSceneBackgroundHandlers'
import { registerClipboardHandlers } from './ipc/registerClipboardHandlers'
import { registerSheetHandlers } from './ipc/registerSheetHandlers'
import { registerPacoteHandlers } from './ipc/registerPacoteHandlers'
import { fazerBackupSeMudouDeVersao } from './storage/backupsDeDados'
import { PaginasRepository } from './storage/PaginasRepository'
import { registerProfilesHandlers } from './ipc/registerProfilesHandlers'
import { registerUpdateHandlers } from './updater'
import { aplicarTravasDeSeguranca, preferenciasDeDepuracao } from './seguranca'
import { PresetsRepository } from './storage/PresetsRepository'
import { NotesRepository } from './storage/NotesRepository'
import { SettingsRepository } from './storage/SettingsRepository'
import { ProfilesRepository } from './storage/ProfilesRepository'
import { SPLASH_SIZE } from '@shared/windowSizes'
import { IMPORTACAO_DE_FICHA_LIGADA } from '@shared/recursos'

/**
 * Identidade do app pro Windows. Tem que ser LITERALMENTE o mesmo texto do `appId` em
 * `electron-builder.yml`, que é o que o instalador carimba em cada atalho: sem esta declaração o
 * Windows inventava um ID a partir do caminho do executável, e o inventado não batia com o dos
 * atalhos — era esse desencontro que quebrava fixar na barra de tarefas.
 */
const APP_USER_MODEL_ID = 'com.renato.reroll'

/**
 * A janela de agora, pra quem precisa dela DEPOIS de ela existir. Os handlers de IPC são registrados
 * UMA vez, na abertura, e perguntam por ela na hora da chamada: nascendo grudados na janela do
 * registro, um segundo `createWindow` registraria os mesmos canais de novo, e `ipcMain.handle` derruba
 * o processo nisso ("Attempted to register a second handler for...").
 */
let janelaPrincipal: BrowserWindow | null = null

function obterJanelaPrincipal(): BrowserWindow | null {
  if (janelaPrincipal && !janelaPrincipal.isDestroyed()) return janelaPrincipal
  return null
}

function createWindow(initialIconPath: string): void {
  const window = new BrowserWindow({
    width: SPLASH_SIZE.width,
    height: SPLASH_SIZE.height,
    minWidth: SPLASH_SIZE.minWidth,
    minHeight: SPLASH_SIZE.minHeight,
    resizable: false,
    center: true,
    show: false,
    frame: false,
    backgroundColor: '#c0c0c0',
    icon: initialIconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      /**
       * As quatro travas escritas À MÃO, mesmo sendo o padrão do Electron desde a versão 20: o padrão
       * protege quem não sabe que elas existem, escrevê-las protege de alguém desligar uma pra
       * resolver rápido um problema, sem topar com o motivo.
       *
       * - `sandbox`: o renderizador roda numa caixa do sistema, e só fala com disco e rede por IPC;
       * - `contextIsolation`: o preload vive num mundo separado, então a página não reescreve a ponte;
       * - `nodeIntegration`: a página não tem `require`. É o que separa "app" de "shell";
       * - `webSecurity`: mantém a origem valendo. Desligar é o atalho clássico pra carregar arquivo
       *   local numa página, e abre tudo de uma vez.
       */
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      /**
       * O INSPETOR só existe em desenvolvimento. Ver `tirarMenuDeProducao` em `seguranca.ts`: esta
       * é a metade que fecha o caminho por código (`webContents.openDevTools()`), e o menu retirado
       * lá é a que fecha o caminho pelo atalho `Ctrl+Shift+I`.
       */
      ...preferenciasDeDepuracao()
    }
  })

  janelaPrincipal = window

  window.on('ready-to-show', () => window.show())

  /**
   * As travas de navegação não estão mais aqui: elas viviam neste bloco, e o problema não era o que
   * faziam, era o alcance — valiam pra ESTA janela. Foram pra `seguranca.ts`, penduradas em
   * `app.on('web-contents-created')`, onde alcançam também a janela que ainda não foi escrita.
   */

  /**
   * O carregamento é uma PROMESSA, e a falha dela é o pior desfecho: uma janela cinza, aberta, sem
   * nada dentro e sem erro. Acontece com o bundle do renderer fora do lugar, ou com o servidor de
   * desenvolvimento no chão. Não há interface pra dar o recado — ela é o que não carregou.
   */
  const carregando = process.env.ELECTRON_RENDERER_URL
    ? window.loadURL(process.env.ELECTRON_RENDERER_URL)
    : window.loadFile(join(__dirname, '../renderer/index.html'))

  void carregando.catch((causa: unknown) => {
    console.error('A interface do Reroll não pôde ser carregada:', causa)
  })
}

/**
 * Antes de qualquer janela existir: o Windows lê o AppUserModelID do processo na hora em que a
 * primeira janela aparece na barra de tarefas, e trocá-lo depois não reagrupa o que já apareceu.
 */
app.setAppUserModelId(APP_USER_MODEL_ID)

/**
 * Uma instância só: sem isto, clicar no ícone fixado com o app aberto abre um SEGUNDO Reroll, com as
 * preferências das duas janelas brigando pelo mesmo arquivo.
 *
 * Só no app EMPACOTADO: o bloqueio é por pasta de dados, e `npm run dev` usa a mesma do app
 * instalado, então o dev morria no arranque (saída 0, sem janela e sem erro) e ainda roubava o foco.
 */
if (app.isPackaged && !app.requestSingleInstanceLock()) {
  // Sai sem registrar mais nada: o `else` não é estilo, é necessário — `app.quit()` só encerra
  // depois que a fila de eventos gira, e sem ele o resto do arquivo ainda rodaria e essa segunda
  // instância chegaria a abrir uma janela antes de morrer.
  app.quit()
} else {
  app.on('second-instance', () => {
    const [existing] = BrowserWindow.getAllWindows()
    if (!existing) return
    if (existing.isMinimized()) existing.restore()
    existing.focus()
  })

  /**
   * O ARRANQUE INTEIRO, com o `catch` que faltava: tudo que abre o app está aqui dentro e é
   * assíncrono. Sem o `catch`, uma falha em qualquer passo (`profiles.json` ilegível, `%APPDATA%` sem
   * permissão, disco cheio) virava rejeição sem dono — processo vivo, nenhuma janela, e da parte de
   * quem clicou no ícone o app simplesmente não abriu.
   */
  const arranque = async (): Promise<void> => {
    /**
     * ANTES de qualquer janela: as travas valem pra sessão inteira, e uma janela criada antes delas
     * nasceria com a rede aberta. Ver `seguranca.ts` pra o que exatamente é negado.
     */
    aplicarTravasDeSeguranca()

    /**
     * ANTES de ler qualquer dado: a primeira abertura de uma versão nova copia a pasta inteira pra
     * `backups/`. Falha de backup é aviso, não parada — o app abrir sem backup é ruim, o app não
     * abrir é pior.
     */
    try {
      const backup = await fazerBackupSeMudouDeVersao(app.getPath('userData'), app.getVersion())
      if (backup) console.info(`Backup dos dados antes da versão ${app.getVersion()}: ${backup}`)
    } catch (causa) {
      console.error('Não deu pra fazer o backup dos dados antes desta versão:', causa)
    }

    /**
     * Os perfis vêm PRIMEIRO e com `await`: são eles que dizem de qual pasta saem anotações e presets,
     * e sem o `init` concluído a primeira leitura cairia na pasta do perfil padrão mesmo com outro
     * aberto. É o `init` também que migra o `notes.json` solto de quem já usava o app.
     */
    const profilesRepository = new ProfilesRepository()
    await profilesRepository.init()
    registerProfilesHandlers(profilesRepository)

    const presetsRepository = new PresetsRepository(profilesRepository)
    registerPresetsHandlers(presetsRepository)

    const notesRepository = new NotesRepository(profilesRepository)
    registerNotesHandlers(notesRepository)

    registerSceneBackgroundHandlers()
    registerClipboardHandlers()
    /**
     * Os canais da importação de ficha só existem com o recurso ligado (ver
     * `IMPORTACAO_DE_FICHA_LIGADA`), e isso não é redundância com o botão escondido: com o canal fora
     * do ar, o app instalado não tem POR ONDE abrir um PDF.
     */
    const paginasRepository = new PaginasRepository(profilesRepository)
    if (IMPORTACAO_DE_FICHA_LIGADA) {
      registerSheetHandlers(profilesRepository, notesRepository, presetsRepository, paginasRepository)
    }
    // O personagem inteiro num arquivo (spec §3.2) — ver `registerPacoteHandlers.ts`.
    registerPacoteHandlers(profilesRepository, notesRepository, presetsRepository, paginasRepository)

    const settingsRepository = new SettingsRepository()
    // Lido ANTES de criar a janela, pra ela já nascer com o ícone escolhido na sessão anterior
    // (sem esse `await`, a janela nasceria sempre com o ícone padrão e só trocaria de verdade
    // depois que o renderer montasse e chamasse `setAppIcon` de novo — um "flash" visível).
    const mainSettings = await settingsRepository.get()
    const initialIconPath = resolveAppIconPath(mainSettings.appIconId)

    /**
     * Os handlers da janela e do update ficam AQUI, e não dentro do `createWindow`, mesmo precisando
     * dela: `ipcMain.handle` recusa registrar o mesmo canal duas vezes, e recusa derrubando o
     * processo. Ver `obterJanelaPrincipal`.
     */
    registerWindowHandlers(obterJanelaPrincipal, settingsRepository)
    registerUpdateHandlers(obterJanelaPrincipal)

    /**
     * Aqui rodava um `applyIconToShortcuts` a cada abertura, e ele foi REMOVIDO: aquilo chamava
     * `powershell.exe -EncodedCommand <base64>` toda vez, e executável sem assinatura digital
     * disparando PowerShell em base64 é comportamento de malware pra qualquer antivírus — na máquina
     * de um tester o app entrou em looping de abrir e fechar.
     *
     * O app agora não executa NENHUM processo externo. Se o ícone da barra voltar a incomodar, o
     * caminho é assinar o executável, ou abrir mão do AppUserModelID.
     */
    createWindow(initialIconPath)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(initialIconPath)
      }
    })
  }

  void app.whenReady().then(() =>
    arranque().catch((causa: unknown) => {
      console.error('O Reroll não conseguiu abrir:', causa)
      dialog.showErrorBox(
        'Reroll',
        [
          'O Reroll não conseguiu abrir.',
          'Isso costuma ser um problema de acesso à pasta de dados do app (%APPDATA%\\Reroll).',
          `Detalhe técnico: ${(causa as Error)?.message ?? String(causa)}`
        ].join('\n\n')
      )
      app.quit()
    })
  )
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
