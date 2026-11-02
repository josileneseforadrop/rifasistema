import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkError, reloadOnceForNewVersion } from '../lib/lazyRetry'

interface Props {
  children: ReactNode
  /** muda quando a rota muda, para limpar o erro ao navegar */
  resetKey?: string
}

/** Evita a "tela preta": mostra o erro com opção de tentar de novo em vez de desmontar o site. */
export default class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[erro na tela]', error, info.componentStack)
    if (isChunkError(error)) reloadOnceForNewVersion()
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunk = isChunkError(this.state.error)
    return (
      <div className="card center" style={{ maxWidth: 520, margin: '40px auto' }}>
        <h3 style={{ marginTop: 0 }}>{chunk ? 'Uma nova versão do sistema está disponível' : 'Algo deu errado nesta tela'}</h3>
        <p className="muted">
          {chunk ? 'Recarregue a página para continuar.' : 'Tente novamente. Se o problema continuar, recarregue a página.'}
        </p>
        {!chunk && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.6 }}>{this.state.error.message}</pre>}
        <div className="row" style={{ justifyContent: 'center' }}>
          {!chunk && <button className="btn ghost" onClick={() => this.setState({ error: null })}>Tentar novamente</button>}
          <button className="btn" onClick={() => location.reload()}>Recarregar página</button>
        </div>
      </div>
    )
  }
}
