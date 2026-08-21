import { app, BrowserWindow, ipcMain } from 'electron'
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
 *   (ver `UpdateSection.tsx`). São ~100MB; puxar isso da conexão de alguém sem avisar não é educado.
 *   (O número subiu de 76MB com a atualização do Electron 33 pro 43 — se ele mudar de novo, o texto
 *   que a pessoa LÊ antes de confirmar está em `translations.ts`, não aqui.)
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
/**
 * De onde sai a janela pra onde o progresso é mandado. É uma FUNÇÃO, e não a janela guardada: o
 * download sobrevive a ela (ver `setStatus`), e perguntar na hora é o que faz o atualizador
 * continuar certo se a janela for recriada um dia.
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
 * Quanto tempo o aviso de "instalando" fica na tela antes de o app sair.
 *
 * Não é enfeite: é o único momento em que dá pra explicar o que vai acontecer. Depois disto a
 * janela não existe mais e o instalador roda em silêncio, sem janela própria — para quem está
 * olhando, a tela simplesmente fica sem o app por alguns segundos.
 */
const AVISO_ANTES_DE_SAIR_MS = 2200

/**
 * Fecha o app e entrega o lugar ao instalador — com aviso na tela e saída limpa.
 *
 * O usuário relatou "a tela do desktop das pessoas está travando" quando a atualização acontece, e
 * são DUAS causas somadas, tratadas em lugares diferentes:
 *
 * 1. O UAC. O instalador podia pedir administrador, e o Windows responde a isso acendendo a área de
 *    trabalho segura: tela escurecida, teclado e mouse ignorados. Isso se resolve no empacotamento
 *    (`allowElevation: false` em `electron-builder.yml`), não aqui.
 * 2. O VAZIO. Entre a janela fechar e a versão nova abrir não havia nada na tela nem explicação
 *    nenhuma. É o que esta função trata: avisa, espera o aviso ser visto, e só então sai.
 *
 * A saída também deixou de ser só `quitAndInstall`. As janelas são DESTRUÍDAS antes, e por um
 * motivo prático: enquanto o processo antigo vive, ele segura arquivos dentro da pasta de
 * instalação, e o instalador fica esperando por eles — o que estica ainda mais o tempo de tela
 * vazia. Destruindo antes, o processo morre sozinho e o instalador começa na hora.
 */
function instalarAgora(version: string): void {
  setStatus({ state: 'installing', version })

  /**
   * O aviso só serve se for VISTO. O app pode estar minimizado ou atrás do navegador quando a
   * atualização termina — e aí a pessoa vê a tela piscar sem nunca ter lido a explicação, que é
   * exatamente a experiência que ela relatou como travamento.
   *
   * Traz pra frente por dois segundos e devolve o "sempre no topo" antes de sair, pra não deixar
   * essa marca gravada na janela caso a instalação não vá adiante.
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
     * `isSilent = true`, `isForceRunAfter = true`: instala sem assistente e reabre o Reroll na
     * versão nova. Silencioso continua sendo o certo aqui — com o assistente, quem não é de
     * computador teria que clicar em "Avançar" pra terminar uma atualização que ele já confirmou
     * duas vezes.
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
     * Reinicia sozinho. Não é atalho: chegar aqui exige ter clicado em atualizar e confirmado duas
     * vezes, e a segunda confirmação diz com todas as letras que o app vai reiniciar. A espera curta
     * é só pra a tela alcançar a mudança de estado — sem ela o app some no meio da barra de
     * progresso, o que parece travamento, não conclusão.
     */
    setTimeout(() => instalarAgora(info.version), RESTART_DELAY_MS)
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
 * O CHANGELOG da release, virado em texto simples.
 *
 * O `electron-updater` entrega `releaseNotes` de três jeitos conforme o provedor: texto puro, HTML
 * (é o caso do GitHub, que devolve a descrição da release já convertida) ou uma lista de versões
 * quando há mais de uma release entre a instalada e a nova.
 *
 * As tags HTML são tiradas em vez de renderizadas, e isso é decisão de segurança, não de estilo: o
 * texto vem de FORA (a descrição de uma release na internet) e a alternativa seria injetá-lo na
 * interface com `dangerouslySetInnerHTML` — dar a uma string remota o direito de virar marcação
 * dentro do app, que é exatamente o que a CSP e as travas de navegação existem pra impedir.
 *
 * O corte em 2000 caracteres é pra a janela não virar um rolo de texto sem fim: quem quiser a
 * história completa abre a página da release.
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
