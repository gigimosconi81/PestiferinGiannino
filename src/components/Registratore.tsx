import { formattaDurata, registrazionePossibile, useRegistratore } from '../lib/registratore'

export default function Registratore({ storiaId, onParteSalvata }: { storiaId: string; onParteSalvata: () => void }) {
  const r = useRegistratore(storiaId, onParteSalvata)
  const attivo = r.stato === 'registra' || r.stato === 'pausa'

  if (!registrazionePossibile()) {
    return <p className="error">Questo browser non può registrare. Prova con Safari su iPhone o Chrome su Android.</p>
  }

  return (
    <div className="recorder">
      {!attivo ? (
        <button className="rec-btn" onClick={r.avvia} disabled={r.stato !== 'pronto'} aria-label="Inizia a registrare">
          <span className="rec-dot" aria-hidden="true" />
          <span>{r.stato === 'avvio' ? 'Preparo il microfono…' : r.stato === 'chiusura' ? 'Salvo…' : 'Registra'}</span>
        </button>
      ) : (
        <div className="rec-live" role="group" aria-label="Registrazione in corso">
          <div className={`rec-time ${r.stato === 'pausa' ? 'paused' : ''}`} aria-live="off">
            <span className="rec-dot small" aria-hidden="true" />
            {formattaDurata(r.secondi)}
            {r.stato === 'pausa' && <span className="muted small"> in pausa</span>}
          </div>
          <div className="meter" aria-hidden="true"><i style={{ transform: `scaleX(${r.stato === 'pausa' ? 0 : r.livello})` }} /></div>
          <div className="row gap-sm">
            {r.stato === 'registra'
              ? <button className="btn" onClick={r.pausa}>Pausa</button>
              : <button className="btn" onClick={r.riprendi}>Riprendi</button>}
            <button className="btn primary" onClick={r.ferma}>Fine</button>
          </div>
        </div>
      )}
      {r.errore && <p className="error" role="alert">{r.errore}</p>}
      <p className="muted small">
        {attivo
          ? 'Tieni il telefono vicino e lo schermo acceso. Il racconto si salva nel telefono mentre registri.'
          : 'Si può registrare anche senza internet: la registrazione si carica appena torna la rete. Una storia può avere più parti.'}
      </p>
    </div>
  )
}
