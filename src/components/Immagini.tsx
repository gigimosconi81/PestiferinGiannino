// Immagini di riferimento: caricate nell'archivio privato "immagini" di Supabase,
// mostrate con link temporanei. Le foto grandi vengono rimpicciolite nel telefono prima di caricarle.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Immagine } from '../lib/quaderno'

const linkCache = new Map<string, { url: string; scade: number }>()

async function linkTemporanei(paths: string[]): Promise<Record<string, string>> {
  const ora = Date.now()
  const mancano = paths.filter((p) => (linkCache.get(p)?.scade ?? 0) <= ora)
  if (mancano.length) {
    const { data } = await supabase.storage.from('immagini').createSignedUrls(mancano, 3600)
    for (const d of data ?? []) if (d.path && d.signedUrl) linkCache.set(d.path, { url: d.signedUrl, scade: ora + 50 * 60_000 })
  }
  return Object.fromEntries(paths.map((p) => [p, linkCache.get(p)?.url ?? '']))
}

// Restituisce il primo link disponibile (per le miniature negli elenchi)
export function useLinkImmagine(path: string | undefined): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let vivo = true
    if (path) void linkTemporanei([path]).then((m) => { if (vivo) setUrl(m[path] ?? '') })
    else setUrl('')
    return () => { vivo = false }
  }, [path])
  return url
}

async function rimpicciolisci(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  try {
    const bmp = await createImageBitmap(file)
    const max = 1800, s = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (s === 1 && file.size < 2_500_000) return file
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86))
    return blob && blob.size < file.size ? blob : file
  } catch { return file }
}

export default function Immagini({ id, cartella, valore, onCambia }: {
  id: string
  cartella: string
  valore: Immagine[]
  onCambia: (lista: Immagine[], subito?: boolean) => void
}) {
  const [link, setLink] = useState<Record<string, string>>({})
  const [nota, setNota] = useState<string | null>(null)
  const [errore, setErrore] = useState(false)
  const [togli, setTogli] = useState<string | null>(null)
  const chiave = valore.map((v) => v.path).join('|')

  useEffect(() => {
    let vivo = true
    if (valore.length) void linkTemporanei(valore.map((v) => v.path)).then((m) => { if (vivo) setLink(m) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave])

  const carica = async (files: FileList) => {
    let lista = [...valore]
    const tutti = Array.from(files)
    for (let i = 0; i < tutti.length; i++) {
      setErrore(false)
      setNota(`Carico l'immagine ${i + 1} di ${tutti.length}…`)
      const blob = await rimpicciolisci(tutti[i])
      const est = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : blob.type.includes('hei') ? 'heic' : 'jpg'
      const path = `${cartella}/${crypto.randomUUID()}.${est}`
      const { error } = await supabase.storage.from('immagini').upload(path, blob, { contentType: blob.type || 'image/jpeg' })
      if (error) {
        setErrore(true)
        setNota(/mime|type/i.test(error.message) ? 'Questo formato non va: usate una foto JPG o PNG.'
          : /size|large/i.test(error.message) ? 'Immagine troppo grande (massimo 20 MB).'
          : 'Caricamento non riuscito: ' + error.message)
        return
      }
      lista = [...lista, { path, nota: '' }]
      onCambia(lista, true)
    }
    setNota('Immagini caricate.')
  }

  const rimuovi = async (path: string) => {
    if (togli !== path) { setTogli(path); setTimeout(() => setTogli((t) => (t === path ? null : t)), 4000); return }
    onCambia(valore.filter((v) => v.path !== path), true)
    await supabase.storage.from('immagini').remove([path])
    setTogli(null)
  }

  return (
    <div className="stack">
      {valore.length > 0 ? (
        <div className="imgs">
          {valore.map((im, i) => (
            <div className="img" key={im.path}>
              {link[im.path] ? <img src={link[im.path]} alt={`Immagine di riferimento ${i + 1}`} loading="lazy" /> : <div className="img-vuota" />}
              <label className="sr" htmlFor={`${id}-n-${i}`}>Cosa prendere da questa immagine</label>
              <textarea id={`${id}-n-${i}`} rows={2} placeholder="Cosa prendere da questa immagine" defaultValue={im.nota}
                onChange={(e) => onCambia(valore.map((v) => (v.path === im.path ? { ...v, nota: e.target.value } : v)))} />
              <button type="button" className="btn small ghost danger" onClick={() => void rimuovi(im.path)}>
                {togli === im.path ? 'Sicuro? Tocca ancora' : 'Togli'}
              </button>
            </div>
          ))}
        </div>
      ) : <p className="muted small">Nessuna immagine per ora.</p>}
      <div className="row wrap gap-sm">
        <label className="btn small upload" htmlFor={`${id}-file`}>
          Aggiungi immagini
          <input id={`${id}-file`} type="file" accept="image/*" multiple
            onChange={(e) => { if (e.target.files?.length) void carica(e.target.files).finally(() => { e.target.value = '' }) }} />
        </label>
        {nota && <span className={errore ? 'error small' : 'muted small'} aria-live="polite">{nota}</span>}
      </div>
    </div>
  )
}
