// Trascrive una registrazione: scarica l'audio dall'archivio e lo manda al servizio di trascrizione.
// Risponde subito all'app; il lavoro continua in background e lo stato si aggiorna nella tabella registrazioni.
//
// Variabili (Supabase → Edge Functions → Secrets):
//   OPENAI_API_KEY        chiave del servizio di trascrizione
//   TRASCRIZIONE_MODELLO  facoltativa, predefinito gpt-4o-transcribe
import { clientFamiglia, cors, inBackground, messaggioErrore, risposta } from '../_shared/comune.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.0'

const MODELLO = Deno.env.get('TRASCRIZIONE_MODELLO') ?? 'gpt-4o-transcribe'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return risposta({ errore: 'Metodo non permesso' }, 405)

  const db = await clientFamiglia(req)
  if (db instanceof Response) return db

  let id: string | undefined
  try { id = (await req.json())?.registrazione_id } catch { /* corpo non valido */ }
  if (!id) return risposta({ errore: 'Manca registrazione_id' }, 400)
  if (!Deno.env.get('OPENAI_API_KEY')) return risposta({ errore: 'Trascrizione non ancora configurata: manca la chiave del servizio' }, 503)

  const { data: reg, error } = await db.from('registrazioni').select('id, storia_id, storage_path, mime, stato, aggiornato').eq('id', id).maybeSingle()
  if (error) return risposta({ errore: error.message }, 500)
  if (!reg) return risposta({ errore: 'Registrazione non trovata' }, 404)
  // già partita da meno di 5 minuti (per esempio in automatico dopo il caricamento): non la paghiamo due volte
  if (reg.stato === 'in_trascrizione' && Date.now() - Date.parse(reg.aggiornato) < 5 * 60_000) {
    return risposta({ errore: 'La trascrizione di questa parte è già in corso' }, 409)
  }

  await db.from('registrazioni').update({ stato: 'in_trascrizione', errore: null }).eq('id', id)
  inBackground(trascrivi(db, reg))
  return risposta({ ok: true }, 202)
})

async function trascrivi(db: SupabaseClient, reg: { id: string; storia_id: string; storage_path: string; mime: string | null }) {
  try {
    const { data: file, error } = await db.storage.from('audio').download(reg.storage_path)
    if (error || !file) throw new Error('Audio non trovato nell\'archivio: ' + (error?.message ?? ''))

    // I nomi dei personaggi aiutano il servizio a scriverli giusti
    const { data: pers } = await db.from('personaggi').select('nome').order('creato')
    const nomi = (pers ?? []).map((p) => p.nome).filter(Boolean)
    const suggerimento = 'Storia per bambini raccontata a voce in italiano.' +
      (nomi.length ? ' Personaggi: ' + nomi.join(', ') + '.' : '')

    const estensione = reg.storage_path.split('.').pop() ?? 'webm'
    const form = new FormData()
    form.append('file', new File([file], `registrazione.${estensione}`, { type: reg.mime ?? file.type }))
    form.append('model', MODELLO)
    form.append('language', 'it')
    form.append('prompt', suggerimento)
    form.append('response_format', 'json')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: form
    })
    if (!res.ok) throw new Error(`Servizio di trascrizione: ${res.status} ${(await res.text()).slice(0, 300)}`)
    const { text } = await res.json() as { text?: string }
    if (!text?.trim()) throw new Error('La trascrizione è vuota: forse l\'audio non si sente')

    await db.from('registrazioni').update({ stato: 'trascritta', trascrizione: text.trim(), errore: null }).eq('id', reg.id)

    // Se tutte le parti della storia sono trascritte, la storia passa a "trascritta"
    const { data: tutte } = await db.from('registrazioni').select('stato').eq('storia_id', reg.storia_id)
    if (tutte && tutte.every((r) => r.stato === 'trascritta')) {
      await db.from('storie').update({ stato: 'trascritta' }).eq('id', reg.storia_id).in('stato', ['da_raccontare', 'registrata'])
    }
  } catch (e) {
    console.error(e)
    await db.from('registrazioni').update({ stato: 'errore', errore: messaggioErrore(e) }).eq('id', reg.id)
  }
}
