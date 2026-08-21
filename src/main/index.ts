import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { registerPresetsHandlers } from './ipc/registerPresetsHandlers'
import { registerNotesHandlers } from './ipc/registerNotesHandlers'
import { registerWindowHandlers } from './ipc/registerWindowHandlers'
import { resolveAppIconPath } from './appIconPaths'
import { registerSceneBackgroundHandlers } from './ipc/registerSceneBackgroundHandlers'
import { registerProfilesHandlers } from './ipc/registerProfilesHandlers'
import { registerUpdateHandlers } from './updater'
import { abrirNoNavegador, aplicarTravasDeSeguranca } from './seguranca'
import { PresetsRepository } from './storage/PresetsRepository'
import { NotesRepository } from './storage/NotesRepository'
import { SettingsRepository } from './storage/SettingsRepository'
import { ProfilesRepository } from './storage/ProfilesRepository'
import { SPLASH_SIZE } from '@shared/windowSizes'

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
      preload: join(__dirname, '../preload/index.js'),
      /**
       * As quatro travas escritas À MÃO, mesmo sendo o padrão do Electron 33.
       *
       * O padrão protege quem não sabe que elas existem; escrevê-las protege de OUTRA coisa — de
       * alguém (eu, daqui a seis meses) desligar uma delas pra "resolver rápido" um problema, sem
       * topar com o motivo. Aqui a linha está na cara, com o porquê ao lado.
       *
       * - `sandbox`: o renderizador roda numa caixa do sistema operacional. Se um dia rodar código
       *   hostil ali, ele não fala com o disco nem com a rede direto — só pelas pontes de IPC.
       * - `contextIsolation`: o preload vive num mundo separado do JavaScript da página, então a
       *   página não consegue reescrever a ponte pra fazê-la chamar outra coisa.
       * - `nodeIntegration`: a página NÃO tem `require`. É o que separa "app" de "shell".
       * - `webSecurity`: mantém a origem valendo. Desligar isso é o atalho clássico pra carregar
       *   arquivo local numa página, e abre tudo de uma vez.
       */
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  registerWindowHandlers(window, settingsRepository)
  // Depende da janela: é por ela que o progresso do download chega na interface.
  registerUpdateHandlers(window)

  window.on('ready-to-show', () => window.show())

  /**
   * A janela NUNCA sai do app. `setWindowOpenHandler` (logo abaixo) cobre janela nova; este cobre a
   * navegação da própria janela, que é outro caminho: basta um `location.href`, um `<a>` ou um
   * `<form>` pra a aba principal virar outra coisa.
   *
   * Por que isso importa num app que só carrega arquivo local: se um dia entrar na tela qualquer
   * texto que vire link — nota colada pelo usuário, ficha importada, mensagem de erro de terceiro —,
   * um clique poderia trocar a interface do Reroll por uma página remota RODANDO COM O PRELOAD DELE,
   * ou seja, com acesso às mesmas pontes de IPC. Bloquear navegação é o que corta essa classe
   * inteira de uma vez, e custa cinco linhas.
   *
   * O endereço de desenvolvimento é a única exceção, porque em `npm run dev` a janela é servida por
   * ele e o recarregamento do Vite navega de verdade.
   */
  window.webContents.on('will-navigate', (evento, url) => {
    const permitido = process.env.ELECTRON_RENDERER_URL
    if (permitido && url.startsWith(permitido)) return
    evento.preventDefault()
    // Link http(s) clicado dentro do app abre no navegador do sistema, como já acontece com janela nova.
    abrirNoNavegador(url)
  })

  /**
   * Anexar um webview seria outra janela com outras permissões dentro da nossa. O app não usa
   * nenhum, então a resposta certa é proibir na raiz em vez de confiar que ninguém vai adicionar um.
   */
  window.webContents.on('will-attach-webview', (evento) => evento.preventDefault())

  window.webContents.setWindowOpenHandler((details) => {
    // Só abre esquemas de navegador de verdade no browser padrão do sistema — nunca
    // repassa `file:`/`javascript:`/outros esquemas pro `shell.openExternal` sem checar.
    abrirNoNavegador(details.url)
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
    /**
     * ANTES de qualquer janela: as travas valem pra sessão inteira, e uma janela criada antes delas
     * nasceria com a rede aberta. Ver `seguranca.ts` pra o que exatamente é negado.
     */
    aplicarTravasDeSeguranca()

    /**
     * Os perfis vêm PRIMEIRO e com `await`: são eles que dizem de qual pasta saem anotações e
     * presets (ver `ProfilesRepository.activeDirectory`). Sem o `init` concluído, a primeira leitura
     * de anotações cairia na pasta do perfil padrão mesmo que o usuário tenha outro aberto — e o
     * `init` é também quem migra o `notes.json`/`presets.json` soltos de quem já usava o app.
     */
    const profilesRepository = new ProfilesRepository()
    await profilesRepository.init()
    registerProfilesHandlers(profilesRepository)

    const presetsRepository = new PresetsRepository(profilesRepository)
    registerPresetsHandlers(presetsRepository)

    const notesRepository = new NotesRepository(profilesRepository)
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
