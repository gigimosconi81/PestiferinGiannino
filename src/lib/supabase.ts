import { createClient } from '@supabase/supabase-js'

// Accetta anche indirizzi copiati con /rest/v1/ o con una barra finale
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const url = rawUrl?.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})

export type StatoStoria = 'da_raccontare' | 'registrata' | 'trascritta' | 'in_pulizia' | 'da_rivedere' | 'pronta'
export type TipoBlocco = 'storia' | 'contorno' | 'idea'

export interface Blocco {
  id: string
  tipo: TipoBlocco
  testo: string
  proposta: string
  motivo: string
  tenuto: boolean
  usa_proposta: boolean
  esempio_id?: string | null
}

export interface Storia {
  id: string
  titolo: string
  trama: string | null
  stato: StatoStoria
  blocchi: Blocco[] | null
  pulizia_errore: string | null
  testo_finale: string | null
  creato: string
  aggiornato: string
}

export type StatoRegistrazione = 'caricata' | 'in_trascrizione' | 'trascritta' | 'errore'

export interface Registrazione {
  id: string
  storia_id: string
  parte: number
  storage_path: string
  mime: string | null
  durata_sec: number | null
  dimensione: number | null
  stato: StatoRegistrazione
  trascrizione: string | null
  errore: string | null
  registrata_il: string | null
}

export interface Personaggio {
  id: string
  nome: string
  descrizione: string | null
}

export interface Membro {
  email: string
  nome: string | null
  ruolo: 'admin' | 'famiglia'
}

export const ETICHETTA_STATO: Record<StatoStoria, string> = {
  da_raccontare: 'Da raccontare',
  registrata: 'Registrata',
  trascritta: 'Trascritta',
  in_pulizia: 'Claude la sta ripulendo',
  da_rivedere: 'Da rivedere',
  pronta: 'Pronta per il libro'
}

// Chiede a una funzione del server di partire; restituisce un messaggio leggibile se non ci riesce
export async function avviaFunzione(nome: 'trascrivi' | 'ripulisci', body: Record<string, string>): Promise<string | null> {
  const { error } = await supabase.functions.invoke(nome, { body })
  if (!error) return null
  try {
    // L'errore della funzione contiene la risposta: leggiamo il nostro messaggio "errore"
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json()
      if (j?.errore) return String(j.errore)
    }
  } catch { /* risposta non leggibile */ }
  return /fetch|network|load failed/i.test(error.message) ? 'Senza connessione: riprova quando c\'è rete' : error.message
}

export function testoFinale(blocchi: Blocco[]): string {
  return blocchi.filter((b) => b.tenuto).map((b) => (b.usa_proposta && b.proposta ? b.proposta : b.testo)).join(' ')
}
