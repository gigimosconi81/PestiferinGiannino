import { createClient } from '@supabase/supabase-js'

// Accetta anche indirizzi copiati con /rest/v1/ o con una barra finale
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const url = rawUrl?.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isConfigured = Boolean(url && key)

// Errore arrivato dal link dell'email (link scaduto, già usato…): lo leggiamo prima che la libreria pulisca l'indirizzo
function leggiErroreDalLink(): string | null {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.hash.replace(/^#/, '') + '&' + window.location.search.replace(/^\?/, ''))
  const codice = p.get('error_code') ?? p.get('error')
  if (!codice) return null
  const descr = p.get('error_description')?.replace(/\+/g, ' ') ?? ''
  if (codice === 'otp_expired' || /expired|invalid/i.test(descr)) return 'Il link dell\'email è scaduto o è già stato usato. Chiedine uno nuovo qui sotto e toccalo una volta sola.'
  return `Il link dell'email non ha funzionato (${codice}${descr ? ': ' + descr : ''}). Chiedine uno nuovo.`
}
export const erroreDalLink = leggiErroreDalLink()

// Messaggi d'accesso in italiano, con il dettaglio tecnico per capire cosa succede
export function messaggioAccesso(error: { message: string; status?: number; code?: string }): string {
  const tecnico = ` (dettaglio: ${error.code ?? error.status ?? ''} ${error.message})`
  if (error.code === 'over_email_send_rate_limit' || error.status === 429 || /rate limit/i.test(error.message)) {
    return 'Sono state chieste troppe email in poco tempo: il servizio ne manda al massimo 2 all\'ora. Aspetta circa un\'ora e riprova una volta sola. Se hai già un\'email recente, usa quella.' + tecnico
  }
  if (error.status === 500 && /sending/i.test(error.message)) {
    return 'Il servizio non è riuscito a spedire l\'email: c\'è un problema nelle impostazioni email di Supabase (SMTP). Avvisa chi gestisce l\'app.' + tecnico
  }
  if (error.code === 'otp_expired' || /expired|invalid/i.test(error.message)) return 'Codice o link scaduto, oppure già usato. Chiedine uno nuovo.' + tecnico
  if (/load failed|failed to fetch|network/i.test(error.message)) return 'Non riesco a collegarmi: controlla la connessione.' + tecnico
  return 'Accesso non riuscito.' + tecnico
}

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
  aggiornato: string
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

// Lavoro del server fermo da troppo tempo: probabilmente interrotto, si può rilanciare
export function bloccato(aggiornato: string | null | undefined, minuti = 5): boolean {
  return Boolean(aggiornato) && Date.now() - Date.parse(aggiornato as string) > minuti * 60_000
}

export function testoFinale(blocchi: Blocco[]): string {
  return blocchi.filter((b) => b.tenuto).map((b) => (b.usa_proposta && b.proposta ? b.proposta : b.testo)).join(' ')
}
