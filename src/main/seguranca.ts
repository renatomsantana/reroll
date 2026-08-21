import { session, shell } from 'electron'

/**
 * As travas de sessão do app — as que valem pra TUDO que rodar dentro dele, e não só pra uma janela.
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

export function ehPermitido(url: string): boolean {
  try {
    const alvo = new URL(url)
    if (ESQUEMAS_LOCAIS.includes(alvo.protocol)) return true
    // Em `npm run dev` a interface é servida por um endereço local — sem isto, não há como programar.
    if (process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL)) {
      return true
    }
    // Só HTTPS. Em HTTP, qualquer um no caminho pode trocar o que o app baixa.
    if (alvo.protocol !== 'https:') return false
    if (HOSTS_PERMITIDOS.includes(alvo.hostname)) return true
    // `endsWith` com o PONTO na frente: sem ele, `githubusercontent.com.site-do-atacante.net` passaria.
    return alvo.hostname === DOMINIO_DE_ANEXO || alvo.hostname.endsWith(`.${DOMINIO_DE_ANEXO}`)
  } catch {
    return false
  }
}

/** Instala as travas. Chamar UMA vez, depois do `app.whenReady()` e antes de abrir janela. */
export function aplicarTravasDeSeguranca(): void {
  const sessao = session.defaultSession

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
    // eslint-disable-next-line no-console
    console.warn('[segurança] pedido de rede bloqueado:', detalhes.url)
    responder({ cancel: true })
  })

  /**
   * Nenhuma extensão do Chrome, nem plugin. O app não usa, e cada um seria código de terceiro
   * rodando dentro dele com as permissões dele.
   */
  sessao.setPreloads([])
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
