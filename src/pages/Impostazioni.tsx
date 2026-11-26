import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Membro, type Personaggio } from '../lib/supabase'

export default function Impostazioni({ session }: { session: Session }) {
  const [personaggi, setPersonaggi] = useState<Personaggio[]>([])
  const [membri, setMembri] = useState<Membro[]>([])
  const [admin, setAdmin] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [descr, setDescr] = useState('')
  const [email, setEmail] = useState('')
  const [nomeMembro, setNomeMembro] = useState('')

  const carica = async () => {
    const [p, m, a] = await Promise.all([
      supabase.from('personaggi').select('id, nome, descrizione').order('creato'),
      supabase.from('membri').select('email, nome, ruolo').order('creato'),
      supabase.rpc('is_admin')
    ])
    if (p.error) setErrore(p.error.message)
    setPersonaggi((p.data ?? []) as Personaggio[])
    setMembri((m.data ?? []) as Membro[])
    setAdmin(a.data === true)
  }
  useEffect(() => { void carica() }, [])

  const aggiungiPersonaggio = async (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const { error } = await supabase.from('personaggi').insert({ nome: nome.trim(), descrizione: descr.trim() || null })
    if (error) { setErrore(error.message); return }
    setNome(''); setDescr(''); void carica()
  }
  const salvaPersonaggio = async (p: Personaggio, campi: Partial<Personaggio>) => {
    const { error } = await supabase.from('personaggi').update(campi).eq('id', p.id)
    if (error) setErrore(error.message)
  }
  const togliPersonaggio = async (p: Personaggio) => {
    if (!window.confirm(`Togliere ${p.nome} dall'elenco?`)) return
    await supabase.from('personaggi').delete().eq('id', p.id)
    void carica()
  }

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
        <p className="muted small">I nomi servono alla trascrizione per scriverli giusti («Pestiferin» non è una parola che conosce) e a Claude per capire chi è chi. Le schede complete con l'aspetto arriveranno con i disegni.</p>
        <ul className="list" role="list">
          {personaggi.map((p) => (
            <li key={p.id} className="list-row">
              <input aria-label="Nome" defaultValue={p.nome} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.nome) void salvaPersonaggio(p, { nome: e.target.value.trim() }) }} />
              <input aria-label={`Chi è ${p.nome}`} placeholder="Chi è, in poche parole" defaultValue={p.descrizione ?? ''}
                onBlur={(e) => { if (e.target.value !== (p.descrizione ?? '')) void salvaPersonaggio(p, { descrizione: e.target.value || null }) }} />
              <button className="btn small ghost danger" onClick={() => void togliPersonaggio(p)}>Togli</button>
            </li>
          ))}
        </ul>
        <form className="list-row" onSubmit={aggiungiPersonaggio}>
          <input aria-label="Nome del nuovo personaggio" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input aria-label="Chi è" placeholder="Chi è, in poche parole" value={descr} onChange={(e) => setDescr(e.target.value)} />
          <button className="btn small">Aggiungi</button>
        </form>
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
