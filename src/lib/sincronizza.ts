// Carica sul server le registrazioni rimaste nel telefono e fa partire la trascrizione.
// Gira all'avvio, quando torna la rete, dopo ogni registrazione e ogni minuto se c'è qualcosa in attesa.
import { avviaFunzione, supabase } from './supabase'
import { elencoAttesa, togliDaAttesa, type InAttesa } from './archivio'

type Ascoltatore = () => void
const ascoltatori = new Set<Ascoltatore>()
export function suCambio(fn: Ascoltatore): () => void { ascoltatori.add(fn); return () => { ascoltatori.delete(fn) } }
const avvisa = () => ascoltatori.forEach((fn) => fn())

export let ultimoErrore: string | null = null
let inCorso: Promise<void> | null = null
const senzaRete = () => navigator.onLine === false

export function estensione(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

async function caricaUna(a: InAttesa): Promise<void> {
  const percorso = `${a.storiaId}/${a.id}.${estensione(a.mime)}`
  const up = await supabase.storage.from('audio').upload(percorso, a.blob, { contentType: a.mime.split(';')[0], upsert: true })
  if (up.error) throw new Error(up.error.message)
  const ins = await supabase.from('registrazioni').upsert({
    id: a.id,
    storia_id: a.storiaId,
    parte: a.parte,
    storage_path: percorso,
    mime: a.mime.split(';')[0],
    durata_sec: Math.round(a.durata),
    dimensione: a.blob.size,
    registrata_il: a.registrataIl
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (ins.error) {
    throw new Error(ins.error.code === '23503'
      ? 'la storia di questa registrazione non esiste più'
      : ins.error.message)
  }
  await supabase.from('storie').update({ stato: 'registrata' }).eq('id', a.storiaId).eq('stato', 'da_raccontare')
  await togliDaAttesa(a.id)
  avvisa()
  // Se la trascrizione non parte (servizio non configurato, rete), resta "caricata" e si può rilanciare dalla storia
  await avviaFunzione('trascrivi', { registrazione_id: a.id })
}

export function sincronizza(): Promise<void> {
  if (inCorso) return inCorso
  inCorso = (async () => {
    try {
      if (senzaRete()) return
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      ultimoErrore = null
      for (const a of await elencoAttesa()) {
        if (senzaRete()) break
        // un errore su una registrazione non blocca le altre: si riprova al giro successivo
        try { await caricaUna(a) }
        catch (e) { ultimoErrore = e instanceof Error ? e.message : String(e) }
      }
    } finally {
      inCorso = null
      avvisa()
    }
  })()
  return inCorso
}

let avviato = false
export function avviaSincronizzazione() {
  if (avviato) return
  avviato = true
  window.addEventListener('online', () => { void sincronizza() })
  setInterval(() => { void elencoAttesa().then((l) => { if (l.length) void sincronizza() }) }, 60_000)
  void sincronizza()
}
