// Pezzi in comune alle funzioni: intestazioni CORS e accesso al database come l'utente che chiama.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.0'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

export function risposta(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Client che agisce con i permessi di chi ha fatto la richiesta: valgono le stesse regole dell'app.
export async function clientFamiglia(req: Request): Promise<SupabaseClient | Response> {
  const auth = req.headers.get('Authorization')
  if (!auth) return risposta({ errore: 'Accesso mancante' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false }
  })
  const { data, error } = await db.rpc('is_member')
  if (error || data !== true) return risposta({ errore: 'Questo account non fa parte della famiglia' }, 403)
  return db
}

// Lavoro lungo dopo aver già risposto all'app (la trascrizione e la pulizia possono durare un minuto).
export function inBackground(p: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime
  if (rt?.waitUntil) rt.waitUntil(p)
  else p.catch((e) => console.error(e))
}

export function messaggioErrore(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.slice(0, 500)
}
