// Disegna un campo del quaderno (testo, scelta, colore, immagini).
import type { Campo, Immagine } from '../lib/quaderno'
import { COLORI } from '../lib/quaderno'
import Immagini from './Immagini'

export function CampoQuaderno({ id, campo, valore, immagini, cartella, campione, onCambia, onImmagini }: {
  id: string
  campo: Campo
  valore: string
  immagini?: Immagine[]
  cartella?: string
  campione?: string
  onCambia: (v: string) => void
  onImmagini?: (lista: Immagine[], subito?: boolean) => void
}) {
  const fid = `${id}-${campo.k}`
  if (campo.type === 'text' || campo.type === 'area') {
    return (
      <div className="field">
        <label htmlFor={fid}>{campo.label}</label>
        {campo.hint && <p className="hint">{campo.hint}</p>}
        {campo.type === 'text'
          ? <input id={fid} type="text" autoComplete="off" placeholder={campo.ph} defaultValue={valore} onChange={(e) => onCambia(e.target.value)} />
          : <textarea id={fid} rows={3} placeholder={campo.ph} defaultValue={valore} onChange={(e) => onCambia(e.target.value)} />}
      </div>
    )
  }
  if (campo.type === 'choice') {
    return (
      <div className="field">
        <span className="lbl" id={fid}>{campo.label}</span>
        {campo.hint && <p className="hint">{campo.hint}</p>}
        <div className="chips" role="group" aria-labelledby={fid}>
          {campo.options!.map((o) => (
            <button key={o} type="button" className="chipbtn" aria-pressed={valore === o} onClick={() => onCambia(valore === o ? '' : o)}>{o}</button>
          ))}
        </div>
      </div>
    )
  }
  if (campo.type === 'color') {
    return (
      <div className="field">
        <span className="lbl" id={fid}>{campo.label}</span>
        {campo.hint && <p className="hint">{campo.hint}</p>}
        <div className="swatches" role="group" aria-labelledby={fid}>
          {COLORI.map((c) => (
            <button key={c} type="button" className="swatch" aria-pressed={valore === c} aria-label={`Colore ${c}`} style={{ background: c }} onClick={() => onCambia(c)} />
          ))}
          <input type="color" aria-label="Altro colore" value={/^#[0-9a-f]{6}$/i.test(valore) ? valore : '#888888'} onChange={(e) => onCambia(e.target.value)} />
          <span className="sample-word" style={{ color: valore || undefined }}>{campione || 'Nome'}</span>
        </div>
      </div>
    )
  }
  // immagini
  return (
    <div className="field">
      <span className="lbl">{campo.label}</span>
      {campo.hint && <p className="hint">{campo.hint}</p>}
      <Immagini id={fid} cartella={cartella ?? 'varie'} valore={immagini ?? []} onCambia={(l, s) => onImmagini?.(l, s)} />
    </div>
  )
}
