import { app, ipcMain, Menu, session, shell, type IpcMainInvokeEvent, type Session, type WebContents } from 'electron'

/**
 * As travas de segurança do app — as que valem pra TUDO que rodar dentro dele, e não só pra uma
 * janela.
 *
 * Existe porque o app é distribuído pra gente que não é de computador ("vou mandar para muitos
 * amigos e pessoas que não manjam muito de pc"). Pra esse público, a garantia que importa não é uma
 * lista de boas práticas — é poder dizer, e provar, DUAS coisas simples:
 *
 * 1. o Reroll não pede acesso a nada da máquina: câmera, microfone, localização, notificação, nada;
 * 2. o Reroll não fala com a internet, exceto pra perguntar ao GitHub se existe versão nova.
 *
 * As duas são impostas aqui, na sessão, e não confiadas ao código da interface. Quem tentar sair
 * disso — uma dependência curiosa, um `<img>` apontando pra fora, código hostil que um dia consiga
 * rodar na página — bate nesta parede antes de chegar na rede.
 *
 * TUDO AQUI É POR EVENTO DO `app`, e não por janela, e essa é a diferença que o arquivo garante
 * daqui pra frente: as travas de navegação viviam dentro do `createWindow`, então valiam pra AQUELA
 * janela. Uma segunda janela criada um dia — uma ficha destacada, uma bandeja pro segundo monitor —
 * nasceria sem nenhuma delas, e ninguém repararia, porque o app continuaria abrindo normalmente.
 * Com `web-contents-created` e `session-created`, a trava alcança o que ainda não foi escrito.
 */

/**
 * Os únicos destinos que o app pode alcançar, e todos são do caminho da ATUALIZAÇÃO.
 *
 * `electron-updater` fala com a API do GitHub pra listar a release e baixa o instalador dos
 * servidores de anexo. Nenhum outro host tem motivo pra existir aqui: o app não tem telemetria, não
 * tem anúncio, não carrega fonte nem imagem de fora (ver a CSP em `index.html`).
 */
const HOSTS_PERMITIDOS = ['github.com', 'api.github.com']

/**
 * Os anexos da release não saem de um host fixo: o GitHub redireciona pra
 * `objects.`, `release-assets.` e outros subdomínios de `githubusercontent.com`, e a lista muda
 * sem aviso. Listar os que existem hoje seria um update quebrando calado no dia em que eles
 * trocarem — por isso este é o único ponto com curinga, e ele é de UM domínio só.
 */
const DOMINIO_DE_ANEXO = 'githubusercontent.com'

/**
 * Esquemas que NÃO são rede: é a própria interface carregando de dentro do pacote. Bloquear estes
 * seria bloquear o app.
 */
const ESQUEMAS_LOCAIS = ['file:', 'data:', 'blob:', 'devtools:', 'chrome-extension:']

/**
 * O endereço do servidor de desenvolvimento, comparado por ORIGEM e não por prefixo de texto.
 *
 * O `startsWith` que estava aqui tinha exatamente o defeito que o comentário do `DOMINIO_DE_ANEXO`
 * descreve pro lado do GitHub: com `ELECTRON_RENDERER_URL=http://localhost:5173`, o endereço
 * `http://localhost:5173.dominio-de-alguem.net/` COMEÇA com ele e passava. Só vale em `npm run dev`
 * (fora dali a variável não existe), mas é a mesma armadilha que já foi consertada uma vez a dois
 * metros daqui — e é justamente no dev que a janela roda com o preload e as pontes de IPC abertas.
 */
function ehEnderecoDeDesenvolvimento(url: string): boolean {
  const servidor = process.env.ELECTRON_RENDERER_URL
  if (!servidor) return false
  try {
    return new URL(url).origin === new URL(servidor).origin
  } catch {
    return false
  }
}

export function ehPermitido(url: string): boolean {
  try {
    const alvo = new URL(url)
    if (ESQUEMAS_LOCAIS.includes(alvo.protocol)) return true
    // Em `npm run dev` a interface é servida por um endereço local — sem isto, não há como programar.
    if (ehEnderecoDeDesenvolvimento(url)) return true
    // Só HTTPS. Em HTTP, qualquer um no caminho pode trocar o que o app baixa.
    if (alvo.protocol !== 'https:') return false
    if (HOSTS_PERMITIDOS.includes(alvo.hostname)) return true
    // `endsWith` com o PONTO na frente: sem ele, `githubusercontent.com.site-do-atacante.net` passaria.
    return alvo.hostname === DOMINIO_DE_ANEXO || alvo.hostname.endsWith(`.${DOMINIO_DE_ANEXO}`)
  } catch {
    return false
  }
}

/**
 * Um endereço pode virar A PÁGINA do app? Só o que carrega a própria interface.
 *
 * É uma pergunta diferente de `ehPermitido`, e separá-las importa: aquela responde "pode sair um
 * pedido de rede pra cá" e inclui o GitHub, porque o atualizador precisa dele. Se a navegação usasse
 * a mesma lista, uma página do github.com poderia TOMAR O LUGAR da interface — rodando com o preload
 * do Reroll, ou seja, com as mesmas pontes de IPC. Baixar um arquivo de um lugar e entregar a
 * interface a ele são coisas de tamanhos bem diferentes.
 */
export function podeNavegarPara(url: string): boolean {
  /**
   * O SERVIDOR DE DESENVOLVIMENTO é a única resposta "sim", e `file:` NÃO está aqui de propósito.
   *
   * A interface empacotada não precisa dele: ela entra por `window.loadFile()`, que é chamada do
   * processo principal e não passa por `will-navigate`. O que passaria por aqui com `file:` liberado
   * seria uma navegação partindo DA PÁGINA — e um `file:///C:/...` colado numa anotação viraria uma
   * página qualquer do disco tomando o lugar da interface, com o preload do Reroll junto. Ou seja,
   * liberar `file:` não serve pra nada e abre justamente o caminho que este arquivo existe pra
   * fechar.
   */
  return ehEnderecoDeDesenvolvimento(url)
}

/** As travas de uma sessão: permissão nenhuma, rede só pro caminho da atualização, zero extensões. */
function travarSessao(sessao: Session): void {
  /**
   * PERMISSÕES: tudo negado, sem exceção.
   *
   * O Reroll rola dado — ele não tem por que pedir câmera, microfone, localização, área de
   * transferência ou notificação. Negar por lista branca vazia é mais forte que negar caso a caso:
   * permissão nova que o Chromium inventar amanhã já nasce negada aqui.
   */
  sessao.setPermissionRequestHandler((_conteudo, _permissao, permitir) => permitir(false))
  sessao.setPermissionCheckHandler(() => false)

  /**
   * REDE: só o caminho da atualização.
   *
   * `onBeforeRequest` é o ponto mais cedo em que dá pra dizer não — antes de a conexão sair da
   * máquina. Vale pra tudo que a sessão fizer: `fetch` da página, `<img src>`, o próprio
   * `electron-updater`.
   */
  sessao.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (detalhes, responder) => {
    if (ehPermitido(detalhes.url)) return responder({ cancel: false })
     
    console.warn('[segurança] pedido de rede bloqueado:', detalhes.url)
    responder({ cancel: true })
  })

  /**
   * Nenhum script de sessão pendurado na página. O app não usa, e cada um seria código de terceiro
   * rodando dentro dele com as permissões dele.
   *
   * Isto era `setPreloads([])`, que o Electron 43 marcou como obsoleto — API obsoleta some, e some
   * sem avisar quem depende dela. O laço é o substituto direto, e ele NÃO alcança o preload do app:
   * aquele vem de `webPreferences.preload` da janela, que é outro registro (é por isso que a
   * documentação diz que o script de sessão roda ANTES dele). Além disso, a trava roda antes de
   * qualquer janela existir, então nesse momento a lista está vazia de qualquer forma — o laço vale
   * pelo dia em que uma dependência resolver registrar um.
   */
  for (const script of sessao.getPreloadScripts()) sessao.unregisterPreloadScript(script.id)
}

/**
 * As travas de NAVEGAÇÃO, aplicadas a todo `webContents` que o app criar — a janela de hoje e a que
 * alguém escrever depois.
 *
 * Por que isso importa num app que só carrega arquivo local: se um dia entrar na tela qualquer
 * texto que vire link — nota colada pelo usuário, ficha importada, mensagem de erro de terceiro —,
 * um clique poderia trocar a interface do Reroll por uma página remota RODANDO COM O PRELOAD DELE,
 * ou seja, com acesso às mesmas pontes de IPC. Bloquear navegação corta essa classe inteira de uma
 * vez, e custa cinco linhas.
 */
function travarConteudo(conteudo: WebContents): void {
  /**
   * `setWindowOpenHandler` (abaixo) cobre janela nova; este cobre a navegação da PRÓPRIA janela, que
   * é outro caminho: basta um `location.href`, um `<a>` ou um `<form>` pra a aba principal virar
   * outra coisa.
   */
  conteudo.on('will-navigate', (evento, url) => {
    if (podeNavegarPara(url)) return
    evento.preventDefault()
    // Link http(s) clicado dentro do app abre no navegador do sistema, como já acontece com janela nova.
    abrirNoNavegador(url)
  })

  /**
   * Navegação DENTRO de um quadro não passa por `will-navigate` — ela tem evento próprio. O app não
   * usa `<iframe>` nenhum hoje, e é justamente por isso que a resposta certa é fechar a porta agora,
   * em vez de contar com o fato de que ninguém vai adicionar um.
   */
  conteudo.on('will-frame-navigate', (evento) => {
    if (podeNavegarPara(evento.url)) return
    evento.preventDefault()
    abrirNoNavegador(evento.url)
  })

  /**
   * Anexar um webview seria outra janela, com outras permissões, dentro da nossa.
   *
   * O `preventDefault` já basta; o resto é o cinto do suspensório. Se um dia alguém precisar mesmo
   * de um webview e tirar a proibição, o que ele NÃO vai ganhar de brinde é o preload do Reroll (com
   * as pontes de IPC) nem o `require` do Node — as duas coisas que transformariam uma página de
   * terceiro num pedaço do app.
   */
  conteudo.on('will-attach-webview', (evento, preferencias) => {
    delete preferencias.preload
    preferencias.nodeIntegration = false
    evento.preventDefault()
  })

  conteudo.setWindowOpenHandler((detalhes) => {
    // Só abre esquemas de navegador de verdade no browser padrão do sistema — nunca
    // repassa `file:`/`javascript:`/outros esquemas pro `shell.openExternal` sem checar.
    abrirNoNavegador(detalhes.url)
    return { action: 'deny' }
  })
}

/**
 * A PÁGINA DO APP: o único remetente que os canais de IPC aceitam.
 *
 * Todo `ipcMain.handle` do Reroll confiava em quem chamasse: qualquer `webContents` do processo
 * (uma janela nova, um quadro, uma página que um dia conseguisse tomar o lugar da interface)
 * falaria com os canais que gravam ficha, leem arquivo e trocam de personagem. As travas de
 * navegação acima tornam isso improvável; esta torna inútil: o pedido só é atendido se vier do
 * QUADRO PRINCIPAL de uma janela carregando a interface empacotada (`.../out/renderer/index.html`)
 * ou o servidor de desenvolvimento. É o item "validate the sender of all IPC messages" da lista
 * de segurança do Electron, aplicado num lugar só.
 */
export function ehPaginaDoApp(url: string): boolean {
  if (ehEnderecoDeDesenvolvimento(url)) return true
  try {
    const alvo = new URL(url)
    return alvo.protocol === 'file:' && alvo.pathname.endsWith('/out/renderer/index.html')
  } catch {
    return false
  }
}

/** O evento de IPC veio do quadro principal da página do app? Quadro já destruído (`null`) não. */
export function remetenteConfiavel(evento: Pick<IpcMainInvokeEvent, 'senderFrame' | 'sender'>): boolean {
  const quadro = evento.senderFrame
  if (!quadro) return false
  // Só o quadro PRINCIPAL: o app não tem <iframe>, e um que aparecesse não ganharia os canais.
  if (quadro !== evento.sender.mainFrame) return false
  return ehPaginaDoApp(quadro.url)
}

/**
 * Embrulha `ipcMain.handle` UMA vez, antes de qualquer canal ser registrado: todo handler passa a
 * conferir o remetente sem que cada arquivo de `ipc/` precise lembrar de fazê-lo, e o canal que
 * alguém escrever no ano que vem já nasce conferido. Pedido recusado vira erro pra quem chamou (a
 * promessa do renderer rejeita) e uma linha no console do main, e nada é executado.
 */
export function travarCanaisDeIpc(): void {
  const registrar = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (canal, ouvinte) =>
    registrar(canal, (evento, ...args) => {
      if (!remetenteConfiavel(evento)) {
        console.warn('[segurança] pedido de IPC recusado, remetente fora da página do app:', canal, evento.senderFrame?.url)
        throw new Error('Pedido recusado: não veio da interface do Reroll.')
      }
      return ouvinte(evento, ...args)
    })
}

/**
 * O app roda EMPACOTADO? É o que separa a máquina de quem programa da de quem joga.
 *
 * Só isto, e não `NODE_ENV`: o `electron-vite` não carimba `NODE_ENV` no bundle do processo
 * principal, então uma checagem por ele daria "desenvolvimento" dentro do app instalado — que é o
 * lado errado de errar numa função que decide o que fica LIGADO em produção.
 */
function ehDesenvolvimento(): boolean {
  return !app.isPackaged
}

/**
 * TIRA O MENU PADRÃO do Electron na versão instalada — e com ele o DevTools.
 *
 * Isto conserta um buraco que passou despercebido desde o começo. A janela é `frame: false`, então
 * nunca houve barra de menu VISÍVEL e era fácil supor que não havia menu nenhum. Mas quando ninguém
 * chama `setApplicationMenu`, o Electron instala o menu padrão dele — invisível numa janela sem
 * moldura, e com os ATALHOS todos funcionando. Medido dentro do Electron 43, numa janela oculta com
 * a mesma configuração desta aqui:
 *
 *     View   > Toggle Developer Tools   Ctrl+Shift+I
 *     View   > Reload                   Ctrl+R
 *     View   > Force Reload             Ctrl+Shift+R
 *     Window > Close                    Ctrl+W
 *
 * Três problemas, e o primeiro é o que a spec proíbe:
 *
 * 1. DEVTOOLS em produção. Um app não assinado que abre o inspetor do Chromium com um atalho é
 *    exatamente o tipo de coisa que não se explica pra quem instalou confiando.
 * 2. `Ctrl+R` RECARREGA a página no meio da partida. Remonta a cena 3D e apaga o histórico de
 *    rolagens — que vive só na memória —, e nada na tela explica o que aconteceu.
 * 3. `Ctrl+W` fecha a janela sem passar pelo botão de fechar do app.
 *
 * Em DESENVOLVIMENTO o menu fica, porque é ali que o inspetor e o recarregar são a ferramenta.
 *
 * `devTools: false` no `webPreferences` da janela é a outra metade, e as duas são necessárias: sem
 * menu ninguém abre o inspetor pelo atalho, e sem `devTools` ninguém abre por
 * `webContents.openDevTools()` — que é uma linha que qualquer código futuro pode chamar sem querer.
 */
export function tirarMenuDeProducao(): void {
  if (ehDesenvolvimento()) return
  Menu.setApplicationMenu(null)
}

/** As `webPreferences` que dependem de estar ou não empacotado. Ver `tirarMenuDeProducao`. */
export function preferenciasDeDepuracao(): { devTools: boolean } {
  return { devTools: ehDesenvolvimento() }
}

/** Instala as travas. Chamar UMA vez, depois do `app.whenReady()` e antes de abrir janela. */
export function aplicarTravasDeSeguranca(): void {
  tirarMenuDeProducao()
  // ANTES de qualquer `register*Handlers`: é o embrulho de `ipcMain.handle` que confere o remetente.
  travarCanaisDeIpc()

  /**
   * A sessão padrão JÁ EXISTE quando o app fica pronto, então ela não dispara `session-created` — por
   * isso as duas linhas. O evento é pra qualquer sessão futura (uma `partition` própria numa janela
   * nova, por exemplo), que sem ele nasceria com a rede aberta e as permissões no padrão do Chromium.
   */
  travarSessao(session.defaultSession)
  app.on('session-created', travarSessao)

  app.on('web-contents-created', (_evento, conteudo) => travarConteudo(conteudo))
}

/**
 * Abre um endereço no navegador do sistema, e SÓ se for http(s).
 *
 * Fica aqui junto do resto porque é a mesma pergunta: o que pode sair do app. `shell.openExternal`
 * aceita qualquer esquema — `file:` abriria um arquivo, e em Windows há esquemas que executam coisa.
 * Filtrar antes de chamar é o que impede um link colado numa anotação de virar execução.
 */
export function abrirNoNavegador(url: string): void {
  if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
}
