import { Component, type ErrorInfo, type ReactNode } from 'react'

// Al posto della pagina bianca: il messaggio d'errore e due vie d'uscita (come in VacationPlans)
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; where: string }> {
  state = { error: null as Error | null, where: '' }

  static getDerivedStateFromError(error: Error) { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const where = (info.componentStack ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(' ← ')
    this.setState({ where })
    console.error(error, info)
  }

  render() {
    const { error, where } = this.state
    if (!error) return this.props.children
    return (
      <main className="center">
        <div className="panel stack" style={{ maxWidth: 480 }}>
          <h1>Qualcosa non ha funzionato</h1>
          <p className="muted">Fai uno screenshot di questa pagina e mandalo a chi gestisce l'app: il testo qui sotto serve a capire cosa è successo.</p>
          <pre className="crash">{String(error.message || error)}{where ? `\n\n${where}` : ''}{`\n\n${navigator.userAgent}`}</pre>
          <button className="btn primary wide" onClick={() => window.location.reload()}>Ricarica</button>
          <button className="btn wide" onClick={() => {
            try { Object.keys(localStorage).filter((k) => !k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k)) } catch { /* ignora */ }
            window.location.href = '/'
          }}>Torna all'inizio</button>
        </div>
      </main>
    )
  }
}
