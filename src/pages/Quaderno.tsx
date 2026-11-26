// Il quaderno di Pestiferin Giannino dentro l'app: personaggi, luoghi, elenco delle storie, stile dei disegni.
// Ogni campo si salva da solo mentre si scrive.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LUOGO, PERSONAGGIO, STILE, STORIA_QUADERNO, riassuntoPersonaggio, sezioniCompilate, type Immagine, type Scheda, type Sezione } from '../lib/quaderno'
import { etichettaSalvataggio, useSalvataggio } from '../lib/salvataggio'
import { CampoQuaderno } from '../components/Campi'
import { useLinkImmagine } from '../components/Immagini'

type Sez = 'personaggi' | 'luoghi' | 'storie' | 'stile'
const SEZIONI: { id: Sez; nome: string }[] = [
  { id: 'personaggi', nome: 'Personaggi' },
  { id: 'luoghi', nome: 'Luoghi' },
  { id: 'storie', nome: 'Storie' },
  { id: 'stile', nome: 'Stile dei disegni' }
]

interface Riga { id: string; nome: string; scheda: Scheda; immagini: Immagine[]; creato: string }

export default function Quaderno() {
  const [params, setParams] = useSearchParams()
  const sez = (SEZIONI.find((s) => s.id === params.get('sezione'))?.id ?? 'personaggi') as Sez

  return (
    <div className="stack gap-lg">
      <div className="stack">
        <h1>Il quaderno di <span className="pest">Pestiferin</span> Giannino</h1>
        <p className="muted">Qui si raccoglie tutto quello che serve per i disegni e per il libro: chi sono i personaggi, com'è fatto ognuno, dove succedono le cose e quali storie vi ricordate.</p>
        <details className="how">
          <summary>Come si compila</summary>
          <ol>
            <li>Non serve finire tutto in una volta: ogni campo si salva da solo mentre scrivete.</li>
            <li>Scrivete come parlereste. Meglio tanti dettagli in disordine che poche parole perfette.</li>
            <li>La parte <b>Com'è fatto</b> è la più importante: serve perché il personaggio resti uguale in tutti i disegni.</li>
            <li>Nella sezione <b>Storie</b> basta il titolo e una riga di trama: le racconterete per intero più avanti, registrandole.</li>
          </ol>
        </details>
      </div>
      <div className="tabs" role="tablist" aria-label="Sezioni del quaderno">
        {SEZIONI.map((s) => (
          <button key={s.id} role="tab" className="tab" aria-selected={sez === s.id} onClick={() => setParams({ sezione: s.id }, { replace: true })}>{s.nome}</button>
        ))}
      </div>
      {sez === 'personaggi' && <Elenco tabella="personaggi" sezioni={PERSONAGGIO} titolo="I personaggi" aggiungi="Aggiungi personaggio"
        vuoto="Ancora nessun personaggio. Toccate «Aggiungi personaggio» per iniziare." rotta="personaggio" />}
      {sez === 'luoghi' && <Elenco tabella="luoghi" sezioni={LUOGO} titolo="I luoghi delle storie" aggiungi="Aggiungi un luogo"
        vuoto="Ancora nessun luogo. La casa, la scuola, il parco: aggiungete quelli che tornano più spesso." rotta="luogo" />}
      {sez === 'storie' && <ElencoStorie />}
      {sez === 'stile' && <Stile />}
    </div>
  )
}

function Elenco({ tabella, sezioni, titolo, aggiungi, vuoto, rotta }: {
  tabella: 'personaggi' | 'luoghi'; sezioni: Sezione[]; titolo: string; aggiungi: string; vuoto: string; rotta: string
}) {
  const nav = useNavigate()
  const [righe, setRighe] = useState<Riga[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    void supabase.from(tabella).select('id, nome, scheda, immagini, creato').order('creato').then(({ data, error }) => {
      if (error) setErrore(error.message)
      else setRighe(data as Riga[])
    })
  }, [tabella])

  const nuovo = async () => {
    const { data, error } = await supabase.from(tabella).insert({ nome: '' }).select('id').single()
    if (error) { setErrore(error.message); return }
    nav(`/quaderno/${rotta}/${data.id}`)
  }

  return (
    <section className="stack">
      <div className="row between wrap gap-sm">
        <h2>{titolo}</h2>
        <button className="btn primary" onClick={nuovo}>{aggiungi}</button>
      </div>
      {errore && <p className="error" role="alert">{errore}</p>}
      {righe === null && !errore && <p className="muted">Carico…</p>}
      {righe?.length === 0 && <div className="empty"><p className="muted">{vuoto}</p></div>}
      <div className="qcards">
        {righe?.map((r) => <Scheda1 key={r.id} r={r} sezioni={sezioni} href={`/quaderno/${rotta}/${r.id}`} />)}
      </div>
    </section>
  )
}

function Scheda1({ r, sezioni, href }: { r: Riga; sezioni: Sezione[]; href: string }) {
  const valori = { ...r.scheda, nome: r.nome, immagini: r.immagini } as Record<string, unknown>
  const fatte = sezioniCompilate(sezioni, valori)
  const foto = useLinkImmagine(r.immagini?.[0]?.path)
  const colore = /^#[0-9a-f]{6}$/i.test(r.scheda?.colore ?? '') ? r.scheda.colore : 'var(--muted)'
  return (
    <Link to={href} className="qcard">
      {foto ? <img className="thumb" src={foto} alt="" /> : <span className="thumb" style={{ background: colore }} aria-hidden="true">{(r.nome.trim()[0] ?? '?').toUpperCase()}</span>}
      <span className="stack gap-xs" style={{ minWidth: 0 }}>
        <span className="card-title">{r.nome || 'Senza nome'}</span>
        <span className="muted small">{r.scheda?.tipo ? `${r.scheda.tipo} · ` : ''}{fatte.filter(Boolean).length} di {sezioni.length} parti compilate</span>
        {sezioni.length > 1 && <span className="qmeter" aria-hidden="true">{fatte.map((f, i) => <i key={i} className={f ? 'on' : ''} />)}</span>}
      </span>
    </Link>
  )
}

export function SchedaPage({ tabella }: { tabella: 'personaggi' | 'luoghi' }) {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const sezioni = tabella === 'personaggi' ? PERSONAGGIO : LUOGO
  const indietro = `/quaderno?sezione=${tabella}`
  const [riga, setRiga] = useState<Riga | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [elimina, setElimina] = useState(false)
  const { stato, errore: errSalva, salva, scrivi } = useSalvataggio(tabella, { colonna: 'id', valore: id })

  useEffect(() => {
    void supabase.from(tabella).select('id, nome, scheda, immagini, creato').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error) setErrore(error.message)
      else if (!data) setErrore('Questa scheda non esiste più.')
      else setRiga({ ...(data as Riga), scheda: (data as Riga).scheda ?? {}, immagini: (data as Riga).immagini ?? [] })
    })
  }, [tabella, id])

  if (!riga) return <div className="stack"><Link to={indietro} className="link">← Indietro</Link>{errore ? <p className="error">{errore}</p> : <p className="muted">Carico…</p>}</div>

  const cambia = (k: string, v: string) => {
    if (k === 'nome') { setRiga({ ...riga, nome: v }); salva({ nome: v.trim() }); return }
    const scheda = { ...riga.scheda, [k]: v }
    setRiga({ ...riga, scheda })
    salva(tabella === 'personaggi' ? { scheda, descrizione: riassuntoPersonaggio(scheda) || null } : { scheda })
  }
  const cambiaImmagini = (immagini: Immagine[], subito?: boolean) => { setRiga({ ...riga, immagini }); salva({ immagini }, subito) }

  const eliminaScheda = async () => {
    if (!elimina) { setElimina(true); setTimeout(() => setElimina(false), 5000); return }
    const paths = riga.immagini.map((i) => i.path)
    const { error } = await supabase.from(tabella).delete().eq('id', id)
    if (error) { setErrore(error.message); return }
    if (paths.length) await supabase.storage.from('immagini').remove(paths)
    nav(indietro)
  }

  return (
    <div className="stack gap-lg">
      <div className="row between wrap gap-sm sticky-bar">
        <Link to={indietro} className="link" onClick={() => void scrivi()}>← {tabella === 'personaggi' ? 'Tutti i personaggi' : 'Tutti i luoghi'}</Link>
        <span className={`small ${stato === 'errore' ? 'error' : 'muted'}`} aria-live="polite">{errSalva ?? etichettaSalvataggio(stato)}</span>
      </div>
      {errore && <p className="error" role="alert">{errore}</p>}
      {sezioni.map((s, i) => (
        <section key={s.titolo} className="panel stack">
          <h2>{sezioni.length > 1 && <span className="muted small num">{i + 1}/{sezioni.length}</span>} {s.titolo}</h2>
          {s.intro && <p className="muted small">{s.intro}</p>}
          {s.campi.map((c) => (
            <CampoQuaderno key={c.k} id={`q-${id}`} campo={c}
              valore={c.k === 'nome' ? riga.nome : riga.scheda[c.k] ?? ''}
              immagini={riga.immagini} cartella={`${tabella}/${id}`} campione={riga.nome}
              onCambia={(v) => cambia(c.k, v)} onImmagini={cambiaImmagini} />
          ))}
        </section>
      ))}
      <div className="row between wrap gap-sm">
        <Link to={indietro} className="btn" onClick={() => void scrivi()}>← Fatto</Link>
        <button className="btn small danger" onClick={eliminaScheda}>{elimina ? 'Sicuro? Tocca ancora per eliminare' : 'Elimina questa scheda'}</button>
      </div>
    </div>
  )
}

interface RigaStoria { id: string; titolo: string; trama: string | null; quaderno: Scheda; stato: string; creato: string }

function ElencoStorie() {
  const [righe, setRighe] = useState<RigaStoria[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [nuovaId, setNuovaId] = useState<string | null>(null)

  useEffect(() => {
    void supabase.from('storie').select('id, titolo, trama, quaderno, stato, creato').order('creato', { ascending: false }).then(({ data, error }) => {
      if (error) setErrore(error.message)
      else setRighe(data as RigaStoria[])
    })
  }, [])

  const nuova = async () => {
    const { data, error } = await supabase.from('storie').insert({ titolo: '' }).select('id, titolo, trama, quaderno, stato, creato').single()
    if (error) { setErrore(error.message); return }
    setRighe((r) => [data as RigaStoria, ...(r ?? [])])
    setNuovaId(data.id)
  }

  return (
    <section className="stack">
      <div className="row between wrap gap-sm">
        <h2>Le storie che ricordate</h2>
        <button className="btn primary" onClick={nuova}>Aggiungi una storia</button>
      </div>
      <p className="muted small">Basta il titolo e una riga di trama. Ogni storia dell'elenco compare anche nella pagina Storie, pronta da registrare.</p>
      {errore && <p className="error" role="alert">{errore}</p>}
      {righe === null && !errore && <p className="muted">Carico…</p>}
      {righe?.length === 0 && <div className="empty"><p className="muted">Ancora nessuna storia. Aggiungete la prima che vi viene in mente.</p></div>}
      {righe && righe.length > 0 && <p className="muted small">{righe.length === 1 ? '1 storia' : `${righe.length} storie`}</p>}
      {righe?.map((r) => <StoriaQuaderno key={r.id} r={r} focus={r.id === nuovaId} />)}
    </section>
  )
}

function StoriaQuaderno({ r, focus }: { r: RigaStoria; focus: boolean }) {
  const [quaderno, setQuaderno] = useState<Scheda>(r.quaderno ?? {})
  const { stato, salva } = useSalvataggio('storie', { colonna: 'id', valore: r.id })
  const cambia = (k: string, v: string) => { const q = { ...quaderno, [k]: v }; setQuaderno(q); salva({ quaderno: q }) }
  return (
    <article className="panel stack">
      <div className="field">
        <label htmlFor={`s-${r.id}-titolo`}>Titolo</label>
        <input id={`s-${r.id}-titolo`} className="strong" defaultValue={r.titolo} autoFocus={focus} onChange={(e) => salva({ titolo: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={`s-${r.id}-trama`}>La storia in una riga</label>
        <textarea id={`s-${r.id}-trama`} rows={2} defaultValue={r.trama ?? ''} onChange={(e) => salva({ trama: e.target.value })} />
      </div>
      <div className="grid2">
        {STORIA_QUADERNO.filter((c) => c.type === 'text').map((c) => (
          <CampoQuaderno key={c.k} id={`s-${r.id}`} campo={c} valore={quaderno[c.k] ?? ''} onCambia={(v) => cambia(c.k, v)} />
        ))}
      </div>
      {STORIA_QUADERNO.filter((c) => c.type === 'choice').map((c) => (
        <CampoQuaderno key={c.k} id={`s-${r.id}`} campo={{ ...c }} valore={quaderno[c.k] ?? ''} onCambia={(v) => cambia(c.k, v)} />
      ))}
      <div className="row between wrap gap-sm">
        <Link to={`/storia/${r.id}`} className="link">Apri per registrarla →</Link>
        <span className="muted small" aria-live="polite">{etichettaSalvataggio(stato)}</span>
      </div>
    </article>
  )
}

function Stile() {
  const [riga, setRiga] = useState<{ scheda: Scheda; immagini: Immagine[] } | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const { stato, salva } = useSalvataggio('stile', { colonna: 'id', valore: 1 })

  useEffect(() => {
    void supabase.from('stile').select('scheda, immagini').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) setErrore(error.message)
      else setRiga({ scheda: data?.scheda ?? {}, immagini: data?.immagini ?? [] })
    })
  }, [])

  if (!riga) return errore ? <p className="error">{errore}</p> : <p className="muted">Carico…</p>
  const s = STILE[0]
  return (
    <section className="panel stack">
      <div className="row between wrap gap-sm">
        <h2>{s.titolo}</h2>
        <span className="muted small" aria-live="polite">{etichettaSalvataggio(stato)}</span>
      </div>
      {s.campi.map((c) => (
        <CampoQuaderno key={c.k} id="stile" campo={c} valore={riga.scheda[c.k] ?? ''} immagini={riga.immagini} cartella="stile"
          onCambia={(v) => { const scheda = { ...riga.scheda, [c.k]: v }; setRiga({ ...riga, scheda }); salva({ scheda }) }}
          onImmagini={(immagini, subito) => { setRiga({ ...riga, immagini }); salva({ immagini }, subito) }} />
      ))}
    </section>
  )
}
