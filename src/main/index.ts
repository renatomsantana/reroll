import { join } from 'path'
import { app, BrowserWindow, shell } from 'electron'
import { registerPresetsHandlers } from './ipc/registerPresetsHandlers'
import { registerNotesHandlers } from './ipc/registerNotesHandlers'
import { registerWindowHandlers } from './ipc/registerWindowHandlers'
import { resolveAppIconPath } from './appIconPaths'
import { registerSceneBackgroundHandlers } from './ipc/registerSceneBackgroundHandlers'
import { registerUpdateHandlers } from './updater'
import { PresetsRepository } from './storage/PresetsRepository'
import { NotesRepository } from './storage/NotesRepository'
import { SettingsRepository } from './storage/SettingsRepository'
import { SPLASH_SIZE } from './windowSizes'

/**
 * Identidade do app pro Windows. Tem que ser LITERALMENTE o mesmo texto do `appId` em
 * `electron-builder.yml` — é ele que o instalador carimba em cada atalho criado
 * (`WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"`, ver o template do NSIS).
 *
 * Sem esta declaração o app não tinha AppUserModelID nenhum, então o Windows inventava um a partir
 * do caminho do executável — e esse ID inventado não batia com o dos atalhos. É esse desencontro
 * que quebrava fixar na barra de tarefas: o item fixado e a janela aberta viravam DUAS coisas
 * diferentes pro Windows, então o ícone fixado abria uma segunda entrada em vez de virar a janela
 * em execução, e o "Fixar" some/não gruda quando pedido a partir da janela aberta.
 */
const APP_USER_MODEL_ID = 'com.renato.reroll'

function createWindow(settingsRepository: SettingsRepository, initialIconPath: string): void {
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
      preload: join(__dirname, '../preload/index.js')
    }
  })

  registerWindowHandlers(window, settingsRepository)
  // Depende da janela: é por ela que o progresso do download chega na interface.
  registerUpdateHandlers(window)

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler((details) => {
    // Só abre esquemas de navegador de verdade no browser padrão do sistema — nunca
    // repassa `file:`/`javascript:`/outros esquemas pro `shell.openExternal` sem checar.
    if (details.url.startsWith('https://') || details.url.startsWith('http://')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Antes de qualquer janela existir: o Windows lê o AppUserModelID do processo na hora em que a
 * primeira janela aparece na barra de tarefas, e trocá-lo depois não reagrupa o que já apareceu.
 */
app.setAppUserModelId(APP_USER_MODEL_ID)

/**
 * Uma instância só. Sem isto, clicar no ícone fixado com o app já aberto abre um SEGUNDO Reroll —
 * duas janelas, dois botões na barra, e as preferências das duas brigando pelo mesmo arquivo. Com
 * o bloqueio, o segundo processo morre na hora e manda a janela que já existe pra frente, que é o
 * que se espera de um ícone fixado.
 *
 * Só no app EMPACOTADO. O bloqueio é por pasta de dados, e `npm run dev` usa a mesma que o app
 * instalado — então com ele valendo sempre, rodar o dev com o app instalado aberto fazia o dev
 * morrer no arranque (saída 0, sem janela e sem erro nenhum, parecendo que a compilação falhou) e
 * ainda roubava o foco pra janela do app instalado. Testar uma mudança enquanto se usa o app é
 * exatamente o que se faz o dia inteiro aqui.
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

  app.whenReady().then(async () => {
    const presetsRepository = new PresetsRepository()
    registerPresetsHandlers(presetsRepository)

    const notesRepository = new NotesRepository()
    registerNotesHandlers(notesRepository)

    registerSceneBackgroundHandlers()

    const settingsRepository = new SettingsRepository()
    // Lido ANTES de criar a janela, pra ela já nascer com o ícone escolhido na sessão anterior
    // (sem esse `await`, a janela nasceria sempre com o ícone padrão e só trocaria de verdade
    // depois que o renderer montasse e chamasse `setAppIcon` de novo — um "flash" visível).
    const mainSettings = await settingsRepository.get()
    const initialIconPath = resolveAppIconPath(mainSettings.appIconId)

    /**
     * Aqui rodava um `applyIconToShortcuts` a cada abertura, pra reescrever o ícone dos atalhos e
     * fazer a escolha do usuário valer na barra de tarefas. Ele foi REMOVIDO, e o motivo importa
     * mais que o efeito: aquilo chamava `powershell.exe -EncodedCommand <base64>` toda vez que o
     * app abria. Executável sem assinatura digital disparando PowerShell com comando em base64 é
     * comportamento de malware pra qualquer antivírus — na máquina de um tester o app entrou em
     * looping de abrir e fechar, e outro só conseguiu usar desligando a proteção.
     *
     * O app agora não executa NENHUM processo externo. Se um dia o ícone da barra de tarefas voltar
     * a incomodar, o caminho não é PowerShell: é assinar o executável, ou abrir mão do
     * AppUserModelID (que é quem faz o Windows preferir o ícone do atalho ao da janela).
     */
    createWindow(settingsRepository, initialIconPath)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(settingsRepository, initialIconPath)
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
