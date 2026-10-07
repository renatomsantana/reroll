/** Remove somente os resíduos da coleta desativada, preservando o tabuleiro. */
export function limparEstatisticasAntigas(): void {
  try {
    localStorage.removeItem('reroll.analytics.consent.v1')
  } catch {
    // Armazenamento bloqueado não pode impedir o uso do tabuleiro.
  }
  for (const cookie of document.cookie.split(';')) {
    const nome = cookie.split('=')[0].trim()
    if (nome === '_ga' || nome.startsWith('_ga_')) {
      for (const dominio of ['', '; domain=reroll.com.br', '; domain=www.reroll.com.br']) {
        document.cookie = `${nome}=; Max-Age=0; path=/${dominio}; SameSite=Lax; Secure`
      }
    }
  }
}

limparEstatisticasAntigas()
