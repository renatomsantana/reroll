// Executado no <head>, antes de carregar o CSS e iniciar o React.
// O modo Noite é o padrão; quem escolheu Dia ou Sistema mantém sua preferência sem flash.
;(() => {
  let source = 'night'
  try {
    const saved = JSON.parse(globalThis.localStorage.getItem('rolador-settings') || 'null')
    const selected = saved?.themeSource ?? saved?.theme
    if (selected === 'day' || selected === 'night' || selected === 'system') source = selected
  } catch {
    // Preferência indisponível ou inválida: usa o padrão do app.
  }

  let theme = source
  if (source === 'system') {
    try {
      theme = globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
    } catch {
      theme = 'day'
    }
  }

  globalThis.document.documentElement.dataset.theme = theme
  globalThis.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#101018' : '#c0c0c0')
})()
