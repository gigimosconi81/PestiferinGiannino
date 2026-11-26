import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { avviaFunzione, bloccato, ETICHETTA_STATO, supabase, testoFinale, type Blocco, type Registrazione, type Storia } from '../lib/supabase'
import { elencoAttesa, togliAttesaDiStoria, type InAttesa } from '../lib/archivio'
import { suCambio, sincronizza } from '../lib/sincronizza'
import Registratore from '../components/Registratore'
import Revisione from '../components/Revisione'
import { formattaDurata } from '../lib/registratore'

export default function StoriaPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [storia, setStoria] = useState<Storia | null>(null)
  const [regs, setRegs] = useState<Registrazione[]>([])
  const [attesa, setAttesa] = useState<InAttesa[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [elimina, setElimina] = useState(false)
  const titoloRef = useRef<HTMLInputElement>(null)

  const carica = useCallback(async () => {
    const [s, r] = await Promise.all([
      supabase.from('storie').select('*').eq('id', id).maybeSingle(),
      supabase.from('registrazioni').select('*').eq('storia_id', id).order('registrata_il').order('parte')
    ])
    if (s.error) { setErrore(/fetch|network|load failed/i.test(s.error.message) ? 'Senza connessione: puoi comunque registrare, il racconto resta nel telefono.' : s.error.message); return }
    if (!s.data) { setErrore('Questa storia non esiste più.'); return }
    setErrore(null)
    setStoria(s.data as Storia)
    if (!r.error) setRegs(r.data as Registrazione[])
  }, [id])

  const caricaAttesa = useCallback(() => { void elencoAttesa(id).then(setAttesa).catch(() => {}) }, [id])

  useEffect(() => {
    void carica(); caricaAttesa()
    return suCambio(() => { caricaAttesa(); void carica() })
  }, [carica, caricaAttesa])

  // mentre il server lavora (trascrizione o pulizia) controlliamo ogni 4 secondi
  const lavora = storia?.stato === 'in_pulizia' || regs.some((r) => r.stato === 'in_trascrizione')
  useEffect(() => {
    if (!lavora) return
    const t = setInterval(() => { void carica() }, 4000)
    return () => clearInterval(t)
  }, [lavora, carica])

  const salva = async (campi: Partial<Storia>) => {
    if (!storia) return
    setStoria({ ...storia, ...campi })
    const { error } = await supabase.from('storie').update(campi).eq('id', storia.id)
    if (error) setAvviso('Non salvato: ' + error.message)
  }

  const trascrivi = async (r: Registrazione) => {
    setAvviso(null)
    setRegs((l) => l.map((x) => (x.id === r.id ? { ...x, stato: 'in_trascrizione', errore: null } : x)))
    const e = await avviaFunzione('trascrivi', { registrazione_id: r.id })
    if (e) { setAvviso(e); void carica() }
  }

  const ripulisci = async () => {
    if (!storia) return
    if (storia.blocchi?.length && storia.stato !== 'in_pulizia' && !window.confirm('La revisione attuale verrà sostituita da una nuova pulizia. Continuare?')) return
    setAvviso(null)
    setStoria({ ...storia, stato: 'in_pulizia', pulizia_errore: null })
    const e = await avviaFunzione('ripulisci', { storia_id: storia.id })
    if (e) { setAvviso(e); void carica() }
  }

  const togliRegistrazione = async (r: Registrazione) => {
    if (!window.confirm(`Eliminare la parte ${r.parte}? L'audio verrà cancellato.`)) return
    await supabase.storage.from('audio').remove([r.storage_path])
    await supabase.from('registrazioni').delete().eq('id', r.id)
    void carica()
  }

  const eliminaStoria = async () => {
    if (!storia) return
    if (!elimina) { setElimina(true); setTimeout(() => setElimina(false), 5000); return }
    const paths = regs.map((r) => r.storage_path)
    if (paths.length) await supabase.storage.from('audio').remove(paths)
    const { error } = await supabase.from('storie').delete().eq('id', storia.id)
    if (error) { setAvviso(error.message); return }
    await togliAttesaDiStoria(storia.id).catch(() => {})
    nav('/')
  }

  const trascritte = regs.filter((r) => r.stato === 'trascritta')
  const inTrascrizione = regs.some((r) => r.stato === 'in_trascrizione' || r.stato === 'caricata')
  const conErrore = regs.some((r) => r.stato === 'errore')
  const puliziaFerma = storia?.stato === 'in_pulizia' && bloccato(storia.aggiornato)
  const finale = storia?.blocchi ? testoFinale(storia.blocchi) : ''

  // Il registratore resta sempre nello stesso punto della pagina: se la storia si ricarica
  // (per esempio quando torna la rete) la registrazione in corso non si interrompe.
  return (
    <div className="stack gap-lg">
      <Link to="/" className="link">← Tutte le storie</Link>

      {!storia && (errore ? <p className="error" role="alert">{errore}</p> : <p className="muted">Carico la storia…</p>)}

      {storia && <section className="stack">
        <label htmlFor="titolo" className="sr">Titolo</label>
        <input id="titolo" ref={titoloRef} className="title-input" placeholder="Titolo della storia (si può decidere dopo)"
          defaultValue={storia.titolo} key={storia.titolo}
          onBlur={(e) => { if (e.target.value !== storia.titolo) void salva({ titolo: e.target.value }) }} />
        <label htmlFor="trama" className="muted small">La storia in una riga</label>
        <textarea id="trama" rows={2} defaultValue={storia.trama ?? ''} placeholder="Es. Pestiferin nasconde le chiavi del nonno nel frigo"
          onBlur={(e) => { if (e.target.value !== (storia.trama ?? '')) void salva({ trama: e.target.value }) }} />
        <div className="row gap-sm wrap">
          <span className={`badge st-${storia.stato}`}>{ETICHETTA_STATO[storia.stato]}</span>
          {errore && <span className="muted small">{errore}</span>}
        </div>
      </section>}

      {avviso && <p className="error" role="alert">{avviso}</p>}

      <section className="panel stack">
        <h2>Racconta</h2>
        <Registratore storiaId={id} onParteSalvata={caricaAttesa} />
      </section>

      {storia && <>
      {(regs.length > 0 || attesa.length > 0) && (
        <section className="panel stack">
          <h2>Registrazioni</h2>
          <ul className="regs" role="list">
            {regs.map((r) => (
              <RigaRegistrazione key={r.id} r={r} onTrascrivi={() => trascrivi(r)} onTogli={() => togliRegistrazione(r)} />
            ))}
            {attesa.map((a) => (
              <li key={a.id} className="reg">
                <div className="row between wrap gap-sm">
                  <b>Parte {a.parte}{a.recuperata ? ' (recuperata)' : ''}</b>
                  <span className="muted small">{formattaDurata(a.durata)} · nel telefono, da caricare</span>
                </div>
                <AudioLocale blob={a.blob} />
              </li>
            ))}
          </ul>
          {attesa.length > 0 && <button className="btn small" onClick={() => void sincronizza()}>Carica ora</button>}
        </section>
      )}

      {trascritte.length > 0 && (
        <section className="panel stack">
          <div className="row between wrap gap-sm">
            <h2>Trascrizione</h2>
            <button className="btn primary" onClick={ripulisci} disabled={(storia.stato === 'in_pulizia' && !puliziaFerma) || inTrascrizione || conErrore}>
              {puliziaFerma ? 'Riprova la pulizia' : storia.stato === 'in_pulizia' ? 'Claude la sta ripulendo…' : storia.blocchi?.length ? 'Ripulisci di nuovo' : 'Ripulisci la storia'}
            </button>
          </div>
          {inTrascrizione && <p className="muted small">Aspetta che tutte le parti siano trascritte prima di ripulire.</p>}
          {conErrore && <p className="muted small">Una parte non è stata trascritta: riprova la sua trascrizione o eliminala, poi ripulisci.</p>}
          {storia.stato === 'in_pulizia' && !puliziaFerma && <p className="muted small">Ci vuole circa un minuto. Puoi chiudere la pagina: il lavoro continua.</p>}
          {puliziaFerma && <p className="error small">La pulizia sembra essersi interrotta. Puoi riprovare.</p>}
          {storia.pulizia_errore && <p className="error" role="alert">La pulizia non è riuscita: {storia.pulizia_errore}</p>}
          <details>
            <summary>Leggi la trascrizione completa</summary>
            <div className="prose">
              {trascritte.map((r) => <p key={r.id}>{r.trascrizione}</p>)}
            </div>
          </details>
        </section>
      )}

      {storia.blocchi && storia.blocchi.length > 0 && storia.stato !== 'in_pulizia' && (
        <Revisione
          blocchi={storia.blocchi}
          onCambia={(b: Blocco[]) => void salva({ blocchi: b, testo_finale: testoFinale(b), ...(storia.stato === 'pronta' ? {} : { stato: 'da_rivedere' }) })}
        />
      )}

      {finale && storia.stato !== 'in_pulizia' && (
        <section className="panel stack">
          <div className="row between wrap gap-sm">
            <h2>Il testo per il libro</h2>
            <CopiaTesto testo={finale} />
          </div>
          <div className="prose book">{finale}</div>
          {storia.stato !== 'pronta'
            ? <button className="btn primary" onClick={() => void salva({ stato: 'pronta' })}>Segna come pronta per il libro</button>
            : <button className="btn" onClick={() => void salva({ stato: 'da_rivedere' })}>Rimetti in revisione</button>}
        </section>
      )}

      <div className="row end">
        <button className="btn danger small" onClick={eliminaStoria}>{elimina ? 'Sicuro? Tocca ancora per eliminare tutto' : 'Elimina questa storia'}</button>
      </div>
      </>}
    </div>
  )
}

function RigaRegistrazione({ r, onTrascrivi, onTogli }: { r: Registrazione; onTrascrivi: () => void; onTogli: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const ascolta = async () => {
    const { data } = await supabase.storage.from('audio').createSignedUrl(r.storage_path, 3600)
    if (data?.signedUrl) setUrl(data.signedUrl)
  }
  const stato = r.stato === 'trascritta' ? 'trascritta' : r.stato === 'in_trascrizione' ? 'in trascrizione…' : r.stato === 'errore' ? 'errore' : 'caricata, da trascrivere'
  return (
    <li className="reg">
      <div className="row between wrap gap-sm">
        <b>Parte {r.parte}</b>
        <span className="muted small">{r.durata_sec ? formattaDurata(r.durata_sec) + ' · ' : ''}{stato}</span>
      </div>
      {r.stato === 'errore' && r.errore && <p className="error small">{r.errore}</p>}
      <div className="row gap-sm wrap">
        {url ? <audio controls src={url} preload="none" /> : <button className="btn small" onClick={ascolta}>Ascolta</button>}
        {(r.stato === 'errore' || r.stato === 'caricata' || (r.stato === 'in_trascrizione' && bloccato(r.aggiornato))) && (
          <button className="btn small" onClick={onTrascrivi}>{r.stato === 'in_trascrizione' ? 'Riprova la trascrizione' : 'Trascrivi'}</button>
        )}
        {r.stato === 'trascritta' && <button className="btn small ghost" onClick={onTrascrivi}>Trascrivi di nuovo</button>}
        <button className="btn small ghost danger" onClick={onTogli}>Elimina</button>
      </div>
    </li>
  )
}

function AudioLocale({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <audio controls src={url} preload="metadata" /> : null
}

function CopiaTesto({ testo }: { testo: string }) {
  const [fatto, setFatto] = useState(false)
  return (
    <button className="btn small" onClick={() => {
      navigator.clipboard?.writeText(testo).then(() => { setFatto(true); setTimeout(() => setFatto(false), 2000) }).catch(() => {})
    }}>{fatto ? 'Copiato' : 'Copia il testo'}</button>
  )
}
