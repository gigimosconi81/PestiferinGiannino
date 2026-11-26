import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ETICHETTA_STATO, supabase, type Storia } from '../lib/supabase'
import { elencoAttesa } from '../lib/archivio'
import { suCambio, sincronizza, ultimoErrore } from '../lib/sincronizza'

type Riga = Pick<Storia, 'id' | 'titolo' | 'trama' | 'stato' | 'aggiornato'> & { registrazioni: { count: number }[] }

export default function Libreria() {
  const nav = useNavigate()
  const [storie, setStorie] = useState<Riga[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [attesa, setAttesa] = useState(0)
  const [creo, setCreo] = useState(false)

  const carica = async () => {
    const { data, error } = await supabase.from('storie')
      .select('id, titolo, trama, stato, aggiornato, registrazioni(count)')
      .order('aggiornato', { ascending: false })
    if (error) setErrore(/fetch|network|load failed/i.test(error.message) ? 'Senza connessione: le storie si vedranno quando torna la rete.' : error.message)
    else { setErrore(null); setStorie(data as unknown as Riga[]) }
  }

  useEffect(() => {
    void carica()
    const conta = () => { void elencoAttesa().then((l) => setAttesa(l.length)).catch(() => {}) }
    conta()
    return suCambio(() => { conta(); void carica() })
  }, [])

  const nuova = async () => {
    setCreo(true)
    const { data, error } = await supabase.from('storie').insert({ titolo: '' }).select('id').single()
    setCreo(false)
    if (error) { setErrore(error.message); return }
    nav(`/storia/${data.id}`)
  }

  return (
    <div className="stack gap-lg">
      <div className="row between">
        <h1>Le storie</h1>
        <button className="btn primary" onClick={nuova} disabled={creo}>Nuova storia</button>
      </div>

      {attesa > 0 && (
        <div className="notice row between">
          <span>{attesa === 1 ? '1 registrazione' : `${attesa} registrazioni`} ancora nel telefono, da caricare.{ultimoErrore ? ` Ultimo errore: ${ultimoErrore}` : ''}</span>
          <button className="btn small" onClick={() => void sincronizza()}>Carica ora</button>
        </div>
      )}
      {errore && <p className="error" role="alert">{errore}</p>}

      {storie === null && !errore && <p className="muted">Carico le storie…</p>}
      {storie?.length === 0 && (
        <div className="empty">
          <p><b>Ancora nessuna storia.</b></p>
          <p className="muted">Tocca «Nuova storia», poi il grande tasto rosso per registrare Agata mentre racconta.</p>
        </div>
      )}

      <ul className="cards" role="list">
        {storie?.map((s) => {
          const n = s.registrazioni?.[0]?.count ?? 0
          return (
            <li key={s.id}>
              <Link to={`/storia/${s.id}`} className="card">
                <span className="card-title">{s.titolo.trim() || 'Storia senza titolo'}</span>
                {s.trama && <span className="muted small clamp">{s.trama}</span>}
                <span className="row gap-sm wrap">
                  <span className={`badge st-${s.stato}`}>{ETICHETTA_STATO[s.stato]}</span>
                  <span className="muted small">{n === 0 ? 'nessuna registrazione' : n === 1 ? '1 registrazione' : `${n} registrazioni`}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
