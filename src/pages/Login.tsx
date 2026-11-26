import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (!error) { setSent(true); return }
    setError(/load failed|failed to fetch|network/i.test(error.message) ? 'Non riesco a collegarmi: controlla la connessione.' : error.message)
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setCodeError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email' })
    setBusy(false)
    if (error) setCodeError('Codice non valido o scaduto. Controlla l\'ultima email ricevuta.')
  }

  return (
    <main className="center login">
      <div className="panel stack">
        <div className="brand big">
          <img src="/icon.svg" alt="" width="48" height="48" />
          <span>Le storie di <b className="pest">Pestiferin</b></span>
        </div>
        <p className="muted">Registra le storie di Pestiferin Giannino e trasformale in un libro.</p>
        {sent ? (
          <form onSubmit={verifyCode} className="stack">
            <p className="notice" role="status">Ti ho mandato un'email a {email}. Tocca il link, oppure scrivi qui il codice che trovi nel messaggio.</p>
            <label htmlFor="login-code">Codice</label>
            <input id="login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="123456"
              className="otp" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn primary wide" disabled={busy || code.replace(/\D/g, '').length < 6}>Entra</button>
            {codeError && <p className="error" role="alert">{codeError}</p>}
            <button type="button" className="link" onClick={() => { setSent(false); setCode('') }}>Cambia indirizzo</button>
          </form>
        ) : (
          <form onSubmit={sendLink} className="stack">
            <label htmlFor="login-email">La tua email</label>
            <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn primary wide" disabled={busy}>Mandami il link per entrare</button>
            {error && <p className="error" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </main>
  )
}
