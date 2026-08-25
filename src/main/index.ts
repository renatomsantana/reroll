import { join } from 'path'
import { app, BrowserWindow, dialog } from 'electron'
import { registerPresetsHandlers } from './ipc/registerPresetsHandlers'
import { registerNotesHandlers } from './ipc/registerNotesHandlers'
import { registerWindowHandlers } from './ipc/registerWindowHandlers'
import { resolveAppIconPath } from './appIconPaths'
import { registerSceneBackgroundHandlers } from './ipc/registerSceneBackgroundHandlers'
import { registerClipboardHandlers } from './ipc/registerClipboardHandlers'
import { registerSheetHandlers } from './ipc/registerSheetHandlers'
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

/**
 * A janela de agora, pra quem precisa dela DEPOIS de ela existir.
 *
 * Os handlers de IPC (controles da janela, progresso do update) são registrados UMA vez, na abertura
 * do app, e perguntam por ela na hora em que são chamados — em vez de nascerem grudados na janela
 * que existia no momento do registro. Sem isso, `createWindow` chamado uma segunda vez (o caminho do
 * `activate`, e qualquer janela nova que se escreva um dia) registrava os mesmos canais de novo, e
 * `ipcMain.handle` derruba o processo nisso: "Attempted to register a second handler for...".
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
       * As quatro travas escritas À MÃO, mesmo sendo o padrão do Electron desde a versão 20.
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
   * As travas de navegação NÃO estão mais aqui.
   *
   * Elas viviam neste bloco (`will-navigate`, `will-attach-webview`, `setWindowOpenHandler`), e o
   * problema não era o que faziam, era o alcance: valiam pra ESTA janela. Foram pra
   * `seguranca.ts`, penduradas em `app.on('web-contents-created')`, onde alcançam também a janela
   * que ainda não foi escrita. Ver o cabeçalho de lá.
   */

  /**
   * O carregamento é uma PROMESSA, e a falha dela é o pior desfecho possível: uma janela cinza,
   * aberta, sem nada dentro e sem erro nenhum. Acontece se o bundle do renderer não estiver onde se
   * espera (empacotamento torto) ou se o servidor de desenvolvimento não estiver de pé.
   *
   * Não há interface pra mostrar o recado — ela é justamente o que não carregou —, então o console é
   * o único lugar. Mas ele é infinitamente melhor que o silêncio de antes.
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

  /**
   * O ARRANQUE INTEIRO, com o `catch` que faltava.
   *
   * Tudo que abre o app está aqui dentro e tudo é assíncrono: ler os perfis do disco, migrar o
   * formato antigo, ler as preferências. Sem o `catch`, uma falha em qualquer um desses passos —
   * `profiles.json` ilegível, `%APPDATA%` sem permissão, disco cheio — virava uma rejeição sem dono:
   * o processo continuava vivo, nenhuma janela era criada, e da parte de quem clicou no ícone o app
   * simplesmente não abriu.
   *
   * O diálogo nativo é o único recado possível aqui: a interface é justamente o que não chegou a
   * existir. Depois dele o app SAI, em vez de ficar num processo vivo sem janela nenhuma.
   */
  const arranque = async (): Promise<void> => {
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
    registerClipboardHandlers()
    /**
     * Os canais da importação de ficha só existem quando o recurso está ligado (ver
     * `IMPORTACAO_DE_FICHA_LIGADA`). Não é redundância com o botão escondido na tela: com o canal
     * fora do ar, o app instalado não tem POR ONDE abrir um PDF, nem por um caminho que alguém
     * escreva sem querer amanhã. O que está desligado deve estar desligado dos dois lados.
     */
    if (IMPORTACAO_DE_FICHA_LIGADA) {
      registerSheetHandlers(profilesRepository, notesRepository, presetsRepository)
    }

    const settingsRepository = new SettingsRepository()
    // Lido ANTES de criar a janela, pra ela já nascer com o ícone escolhido na sessão anterior
    // (sem esse `await`, a janela nasceria sempre com o ícone padrão e só trocaria de verdade
    // depois que o renderer montasse e chamasse `setAppIcon` de novo — um "flash" visível).
    const mainSettings = await settingsRepository.get()
    const initialIconPath = resolveAppIconPath(mainSettings.appIconId)

    /**
     * Os handlers da janela e do update ficam AQUI, e não dentro do `createWindow`, mesmo precisando
     * dela: `ipcMain.handle` recusa registrar o mesmo canal duas vezes, e recusa derrubando o
     * processo. Registrando uma vez só e perguntando pela janela na hora da chamada, abrir uma
     * segunda janela deixa de ser um jeito de o app não abrir.
     */
    registerWindowHandlers(obterJanelaPrincipal, settingsRepository)
    registerUpdateHandlers(obterJanelaPrincipal)

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
