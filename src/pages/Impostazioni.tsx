import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Membro } from '../lib/supabase'

export default function Impostazioni({ session }: { session: Session }) {
  const [membri, setMembri] = useState<Membro[]>([])
  const [admin, setAdmin] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [nomeMembro, setNomeMembro] = useState('')

  const carica = async () => {
    const [m, a] = await Promise.all([
      supabase.from('membri').select('email, nome, ruolo').order('creato'),
      supabase.rpc('is_admin')
    ])
    if (m.error) setErrore(m.error.message)
    setMembri((m.data ?? []) as Membro[])
    setAdmin(a.data === true)
  }
  useEffect(() => { void carica() }, [])

  const aggiungiMembro = async (e: FormEvent) => {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em) return
    const { error } = await supabase.from('membri').insert({ email: em, nome: nomeMembro.trim() || null })
    if (error) { setErrore(error.code === '23505' ? 'Questo indirizzo c\'è già.' : error.message); return }
    setEmail(''); setNomeMembro(''); void carica()
  }
  const togliMembro = async (m: Membro) => {
    if (m.email === session.user.email?.toLowerCase()) return
    if (!window.confirm(`Togliere ${m.email}? Non potrà più usare l'app.`)) return
    await supabase.from('membri').delete().eq('email', m.email)
    void carica()
  }

  return (
    <div className="stack gap-lg">
      <h1>Famiglia</h1>
      {errore && <p className="error" role="alert">{errore}</p>}

      <section className="panel stack">
        <h2>Personaggi</h2>
        <p className="muted small">I personaggi, con l'aspetto, il carattere e le immagini, ora si compilano nel <Link to="/quaderno" className="link">Quaderno</Link>. I loro nomi aiutano anche la trascrizione a scriverli giusti.</p>
      </section>

      <section className="panel stack">
        <h2>Chi può usare l'app</h2>
        <ul className="list" role="list">
          {membri.map((m) => (
            <li key={m.email} className="row between wrap gap-sm">
              <span><b>{m.nome || m.email}</b>{m.nome && <span className="muted small"> · {m.email}</span>}{m.ruolo === 'admin' && <span className="badge">gestisce</span>}</span>
              {admin && m.email !== session.user.email?.toLowerCase() && <button className="btn small ghost danger" onClick={() => void togliMembro(m)}>Togli</button>}
            </li>
          ))}
        </ul>
        {admin ? (
          <form className="list-row" onSubmit={aggiungiMembro}>
            <input type="email" aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input aria-label="Nome" placeholder="Nome" value={nomeMembro} onChange={(e) => setNomeMembro(e.target.value)} />
            <button className="btn small">Aggiungi</button>
          </form>
        ) : <p className="muted small">Solo chi gestisce l'app può aggiungere persone.</p>}
      </section>

      <section className="panel stack">
        <p className="muted small">Sei entrato come {session.user.email}.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Esci</button>
      </section>
    </div>
  )
}
