import { useState, type FormEvent } from 'react'
import { erroreDalLink, messaggioAccesso, supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(erroreDalLink)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (!error) { setSent(true); return }
    setError(messaggioAccesso(error))
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setCodeError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email' })
    setBusy(false)
    if (error) setCodeError(messaggioAccesso(error))
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
            <p className="notice" role="status">Ti ho mandato un'email a {email}. Aprila sul telefono dove usi l'app e tocca il link. Se nel messaggio c'è anche un codice di 6 cifre, puoi scriverlo qui.</p>
            <label htmlFor="login-code">Codice</label>
            <input id="login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="123456"
              className="otp" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn primary wide" disabled={busy || code.replace(/\D/g, '').length < 6}>Entra</button>
            {codeError && <p className="error" role="alert">{codeError}</p>}
            <button type="button" className="link" onClick={() => { setSent(false); setCode('') }}>Cambia indirizzo o chiedi un'altra email</button>
          </form>
        ) : (
          <form onSubmit={sendLink} className="stack">
            <label htmlFor="login-email">La tua email</label>
            <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn primary wide" disabled={busy}>Mandami il link per entrare</button>
            {error && <p className="error" role="alert">{error}</p>}
            <p className="muted small">Se hai aggiunto l'app alla schermata Home, apri il link dell'email da Safari e poi riapri l'app: oppure, se l'email contiene un codice di 6 cifre, scrivilo direttamente nell'app.</p>
            <button type="button" className="link" onClick={() => { if (email.trim()) setSent(true); else setError('Scrivi prima la tua email.') }}>Ho già un codice dall'email</button>
          </form>
        )}
      </div>
    </main>
  )
}
