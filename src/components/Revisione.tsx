import { useState } from 'react'
import { supabase, type Blocco } from '../lib/supabase'

// Revisione della pulizia fatta da Claude.
// Ogni pezzo si può togliere o rimettere, e modificare. Quando la famiglia decide diversamente da Claude
// lo ricordiamo in esempi_pulizia: le prossime pulizie terranno conto di queste scelte.

const ETICHETTA: Record<Blocco['tipo'], string> = {
  storia: 'Storia',
  contorno: 'Fuori dalla storia',
  idea: 'Idea decisa insieme'
}

export default function Revisione({ blocchi, onCambia }: { blocchi: Blocco[]; onCambia: (b: Blocco[]) => void }) {
  const [soloDubbi, setSoloDubbi] = useState(false)
  const [modifica, setModifica] = useState<string | null>(null)
  const [bozza, setBozza] = useState('')

  const nContorno = blocchi.filter((b) => b.tipo === 'contorno').length
  const nIdee = blocchi.filter((b) => b.tipo === 'idea').length
  const tolti = blocchi.filter((b) => !b.tenuto).length

  const aggiorna = (id: string, campi: Partial<Blocco>) => onCambia(blocchi.map((b) => (b.id === id ? { ...b, ...campi } : b)))

  const cambiaTenuto = async (b: Blocco) => {
    const tenuto = !b.tenuto
    const predefinito = b.tipo !== 'contorno'
    let esempio_id = b.esempio_id ?? null
    // torna alla scelta di Claude: l'esempio non serve più
    if (tenuto === predefinito && esempio_id) {
      void supabase.from('esempi_pulizia').delete().eq('id', esempio_id)
      esempio_id = null
    } else if (tenuto !== predefinito && !esempio_id) {
      esempio_id = crypto.randomUUID()
      void supabase.from('esempi_pulizia').insert({ id: esempio_id, testo: b.testo.slice(0, 1000), proposto: b.tipo, scelto: tenuto ? 'tenere' : 'togliere' })
    }
    aggiorna(b.id, { tenuto, esempio_id })
  }

  const visibili = soloDubbi ? blocchi.filter((b) => b.tipo !== 'storia') : blocchi

  return (
    <section className="panel stack">
      <div className="row between wrap gap-sm">
        <h2>Revisione</h2>
        <label className="toggle">
          <input type="checkbox" checked={soloDubbi} onChange={(e) => setSoloDubbi(e.target.checked)} />
          Solo i pezzi da controllare
        </label>
      </div>
      <p className="muted small">
        Claude ha trovato {nContorno === 1 ? '1 pezzo' : `${nContorno} pezzi`} fuori dalla storia e {nIdee === 1 ? '1 idea decisa' : `${nIdee} idee decise`} insieme.
        {' '}Pezzi tolti dal libro: {tolti}. Tocca «Rimetti» o «Togli» se non sei d'accordo.
      </p>

      <ol className="blocks" role="list">
        {visibili.map((b) => {
          const inModifica = modifica === b.id
          const campo: 'testo' | 'proposta' = b.usa_proposta && b.proposta ? 'proposta' : 'testo'
          return (
            <li key={b.id} className={`block t-${b.tipo} ${b.tenuto ? '' : 'off'}`}>
              <div className="row between wrap gap-sm">
                <span className="block-label">{ETICHETTA[b.tipo]}{!b.tenuto ? ' · tolto' : ''}</span>
                <div className="row gap-sm">
                  {!inModifica && b.tenuto && (
                    <button className="btn small ghost" onClick={() => { setModifica(b.id); setBozza(b[campo]) }}>Modifica</button>
                  )}
                  <button className="btn small" onClick={() => void cambiaTenuto(b)}>{b.tenuto ? 'Togli' : 'Rimetti'}</button>
                </div>
              </div>
              {b.motivo && b.tipo !== 'storia' && <p className="muted small">{b.motivo}</p>}

              {inModifica ? (
                <div className="stack">
                  <label htmlFor={`m-${b.id}`} className="sr">Testo</label>
                  <textarea id={`m-${b.id}`} rows={Math.min(14, Math.max(3, Math.ceil(bozza.length / 60)))} value={bozza} onChange={(e) => setBozza(e.target.value)} />
                  <div className="row gap-sm">
                    <button className="btn primary small" onClick={() => { aggiorna(b.id, { [campo]: bozza }); setModifica(null) }}>Salva</button>
                    <button className="btn small ghost" onClick={() => setModifica(null)}>Annulla</button>
                  </div>
                </div>
              ) : b.tipo === 'idea' ? (
                <div className="stack">
                  <p className={`spoken ${b.usa_proposta ? 'dim' : ''}`}><span className="muted small">Detto a voce: </span>{b.testo}</p>
                  {b.proposta && (
                    <p className={`narrated ${b.usa_proposta ? '' : 'dim'}`}><span className="muted small">Raccontato nel libro: </span>{b.proposta}</p>
                  )}
                  {b.proposta && b.tenuto && (
                    <button className="link small" onClick={() => aggiorna(b.id, { usa_proposta: !b.usa_proposta })}>
                      {b.usa_proposta ? 'Usa invece le parole dette a voce' : 'Usa la versione raccontata'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="block-text">{b.testo}</p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
