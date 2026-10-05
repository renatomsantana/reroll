const ID_DE_MEDICAO = 'G-GEP6DCNPDV'
export {}
const CHAVE_CONSENTIMENTO = 'reroll.analytics.consent.v1'

type JanelaComAnalytics = Window & {
  dataLayer?: IArguments[]
  gtag?: (...argumentos: unknown[]) => void
  'ga-disable-G-GEP6DCNPDV'?: boolean
}

const hostDoReroll = location.hostname === 'reroll.com.br' || location.hostname === 'www.reroll.com.br'

if (hostDoReroll) {
  const janela = window as JanelaComAnalytics
  let analyticsCarregado = false
  let consentimento: string | null = null
  try {
    consentimento = localStorage.getItem(CHAVE_CONSENTIMENTO)
  } catch {
    // Navegadores que bloqueiam armazenamento ainda permitem escolher para esta visita.
  }

  const aplicarConsentimento = (aceito: boolean): void => {
    janela['ga-disable-G-GEP6DCNPDV'] = !aceito
    if (!aceito) {
      janela.gtag?.('consent', 'update', { analytics_storage: 'denied' })
      // Apaga somente os cookies de estatísticas, preservando os dados do tabuleiro.
      for (const cookie of document.cookie.split(';')) {
        const nome = cookie.split('=')[0].trim()
        if (nome === '_ga' || nome.startsWith('_ga_')) {
          for (const dominio of ['', '; domain=reroll.com.br', '; domain=www.reroll.com.br']) {
            document.cookie = `${nome}=; Max-Age=0; path=/${dominio}; SameSite=Lax; Secure`
          }
        }
      }
      return
    }
    if (analyticsCarregado) {
      janela.gtag?.('consent', 'update', { analytics_storage: 'granted' })
      janela.gtag?.('event', 'page_view')
      return
    }
    analyticsCarregado = true
    janela.dataLayer = janela.dataLayer ?? []
    janela.gtag = function (..._argumentos: unknown[]): void {
      // O Google exige o objeto Arguments; um array de parâmetros não executa os comandos.
      // eslint-disable-next-line prefer-rest-params
      janela.dataLayer?.push(arguments)
    }
    janela.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    })
    janela.gtag('js', new Date())
    janela.gtag('config', ID_DE_MEDICAO, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ID_DE_MEDICAO}`
    document.head.append(script)
  }

  const aviso = document.createElement('section')
  aviso.className = 'analytics-consent'
  aviso.setAttribute('aria-label', 'Cookies de estatísticas')
  const texto = document.createElement('p')
  texto.textContent = 'Podemos usar cookies do Google Analytics para entender as visitas, suas origens e a localização aproximada (estado e cidade)? Sem publicidade. Seu tabuleiro continua salvo neste navegador.'
  const acoes = document.createElement('div')
  acoes.className = 'analytics-consent-actions'
  const preferencias = document.createElement('button')
  preferencias.type = 'button'
  preferencias.className = 'analytics-privacy-button'
  preferencias.textContent = 'Privacidade'
  preferencias.setAttribute('aria-expanded', 'false')
  preferencias.addEventListener('click', () => {
    aviso.hidden = !aviso.hidden
    preferencias.setAttribute('aria-expanded', String(!aviso.hidden))
  })
  for (const [rotulo, aceito] of [['Recusar', false], ['Aceitar estatísticas', true]] as const) {
    const botao = document.createElement('button')
    botao.type = 'button'
    botao.textContent = rotulo
    botao.addEventListener('click', () => {
      try {
        localStorage.setItem(CHAVE_CONSENTIMENTO, aceito ? 'granted' : 'denied')
      } catch {
        // A decisão permanece válida para esta visita mesmo sem armazenamento.
      }
      aplicarConsentimento(aceito)
      aviso.hidden = true
      preferencias.setAttribute('aria-expanded', 'false')
      preferencias.focus()
    })
    acoes.append(botao)
  }
  aviso.append(texto, acoes)
  aviso.hidden = consentimento === 'granted' || consentimento === 'denied'
  preferencias.setAttribute('aria-expanded', String(!aviso.hidden))
  document.body.append(aviso, preferencias)
  aplicarConsentimento(consentimento === 'granted')
}
