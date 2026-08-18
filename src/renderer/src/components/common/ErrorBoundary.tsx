import { Component, type ReactNode } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { Button } from './Button'
import './ErrorBoundary.css'

interface ErrorBoundaryTexts {
  title: string
  message: string
  reload: string
}

interface Props {
  children: ReactNode
  t: ErrorBoundaryTexts
}

interface State {
  hasError: boolean
}

/**
 * Sem isso, qualquer exceção não tratada durante a renderização (ex.: uma regressão futura
 * na inicialização do Three.js/Rapier) derruba a árvore React inteira pra uma janela em
 * branco, sem nenhuma mensagem — pra um app desktop isso é bem pior que uma aba de
 * navegador que dá pra recarregar. `getDerivedStateFromError`/`componentDidCatch` só
 * funcionam num componente de classe, não tem equivalente em hooks.
 */
class ErrorBoundaryImpl extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('Erro não tratado na interface:', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="error-boundary">
        <h1>{this.props.t.title}</h1>
        <p>{this.props.t.message}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          {this.props.t.reload}
        </Button>
      </div>
    )
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const t = useTranslation()
  return <ErrorBoundaryImpl t={t.errorBoundary}>{children}</ErrorBoundaryImpl>
}
