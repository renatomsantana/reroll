const ID_DE_MEDICAO = 'G-GEP6DCNPDV'

type JanelaComAnalytics = Window & {
  dataLayer?: unknown[][]
  gtag?: (...argumentos: unknown[]) => void
}

const hostDoReroll = location.hostname === 'reroll.com.br' || location.hostname === 'www.reroll.com.br'

if (hostDoReroll) {
  const janela = window as JanelaComAnalytics
  janela.dataLayer = janela.dataLayer ?? []
  janela.gtag = (...argumentos: unknown[]): void => {
    janela.dataLayer?.push(argumentos)
  }

  // O Reroll não usa publicidade nem grava cookies do Analytics. O modo de consentimento envia
  // apenas medições sem identificador persistente, suficientes para tráfego e tempo real.
  janela.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  })
  janela.gtag('js', new Date())
  janela.gtag('config', ID_DE_MEDICAO)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ID_DE_MEDICAO}`
  document.head.append(script)
}
