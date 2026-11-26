// Ripulisce una storia trascritta con Claude.
// Claude NON riscrive il racconto: riceve le frasi numerate e dice solo quali sono storia,
// quali sono contorno da togliere ("pensiamo a cosa può fare adesso") e quali sono idee
// decise insieme, per le quali propone una o due frasi narrative.
//
// Variabili (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   chiave della Claude API
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0'
import { clientFamiglia, cors, inBackground, messaggioErrore, risposta } from '../_shared/comune.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.0'

const MODELLO = 'claude-opus-5-5'

type Tipo = 'storia' | 'contorno' | 'idea'
interface Intervallo { da: number; a: number; tipo: Tipo; motivo: string; proposta: string }
interface Blocco { id: string; tipo: Tipo; testo: string; proposta: string; motivo: string; tenuto: boolean; usa_proposta: boolean }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return risposta({ errore: 'Metodo non permesso' }, 405)

  const db = await clientFamiglia(req)
  if (db instanceof Response) return db

  let id: string | undefined
  try { id = (await req.json())?.storia_id } catch { /* corpo non valido */ }
  if (!id) return risposta({ errore: 'Manca storia_id' }, 400)
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return risposta({ errore: 'Pulizia non ancora configurata: manca la chiave della Claude API' }, 503)

  const { data: storia } = await db.from('storie').select('id, titolo').eq('id', id).maybeSingle()
  if (!storia) return risposta({ errore: 'Storia non trovata' }, 404)
  const { data: regs, error } = await db.from('registrazioni').select('trascrizione, stato')
    .eq('storia_id', id).order('registrata_il', { ascending: true }).order('parte', { ascending: true })
  if (error) return risposta({ errore: error.message }, 500)
  const testi = (regs ?? []).filter((r) => r.stato === 'trascritta' && r.trascrizione).map((r) => r.trascrizione as string)
  if (!testi.length) return risposta({ errore: 'Non c\'è ancora nessuna trascrizione da ripulire' }, 409)

  await db.from('storie').update({ stato: 'in_pulizia', pulizia_errore: null }).eq('id', id)
  inBackground(ripulisci(db, storia, testi))
  return risposta({ ok: true }, 202)
})

// Divide il testo in frasi, tenendo insieme punteggiatura e virgolette
export function dividiInFrasi(testo: string): string[] {
  return testo.replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?…»"])\s+(?=[A-ZÀ-Ý«"—–-])/u)
    .map((f) => f.trim()).filter(Boolean)
}

const ISTRUZIONI = `Aiuti una famiglia a trasformare in libro illustrato per bambini le storie che Agata inventa e racconta a voce a Riccardo. Il protagonista è Pestiferin Giannino, chiamato così perché ne combina di ogni.

Ricevi la trascrizione automatica di un racconto, divisa in frasi numerate. La trascrizione non distingue chi parla: lo capisci dal contesto. Mentre racconta, Agata parla anche con Riccardo, e Riccardo interviene.

Il tuo compito è dividere tutte le frasi in blocchi consecutivi, senza saltarne nessuna, e dare a ogni blocco un tipo:
- "storia": la narrazione, le descrizioni, i dialoghi tra i personaggi. Anche se il parlato è imperfetto, resta storia. Nel dubbio, scegli storia: è molto peggio togliere un pezzo di racconto che lasciare una frase di troppo.
- "contorno": quello che nel libro non deve finire. Per esempio i commenti fuori dalla storia ("pensiamo a cosa può fare adesso", "dove eravamo rimasti?", "sei stanco?", "aspetta che bevo un sorso"), le frasi ripetute dopo un'interruzione, le false partenze, le richieste di silenzio, le parole trascritte da rumori.
- "idea": i momenti in cui Agata e Riccardo decidono insieme cosa succede ("e se Simba scappasse?" "va bene, allora Simba scappa..."). Il contenuto deve entrare nel libro, ma la forma è una conversazione fuori dal racconto. Per questi blocchi scrivi in "proposta" una o due frasi narrative che raccontano quello che è stato deciso. Usa lo stesso tempo verbale e lo stesso tono del racconto, e non aggiungere fatti che non sono stati detti.

Regole:
- Non riscrivere e non correggere le frasi: decidi solo il tipo dei blocchi. "proposta" si scrive solo per i blocchi "idea"; per gli altri lascia una stringa vuota.
- Unisci le frasi consecutive dello stesso tipo in un solo blocco. "da" e "a" sono i numeri della prima e dell'ultima frase del blocco, inclusi.
- "motivo" spiega in italiano semplice, in massimo 12 parole, perché hai scelto quel tipo. La famiglia lo legge per decidere se è d'accordo.
- "titolo_suggerito": un titolo breve e simpatico per la storia, adatto a un libro per bambini.
- La trascrizione automatica può sbagliare i nomi propri: tienine conto per capire chi è chi.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['titolo_suggerito', 'blocchi'],
  properties: {
    titolo_suggerito: { type: 'string' },
    blocchi: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['da', 'a', 'tipo', 'motivo', 'proposta'],
        properties: {
          da: { type: 'integer' },
          a: { type: 'integer' },
          tipo: { type: 'string', enum: ['storia', 'contorno', 'idea'] },
          motivo: { type: 'string' },
          proposta: { type: 'string' }
        }
      }
    }
  }
}

async function ripulisci(db: SupabaseClient, storia: { id: string; titolo: string }, testi: string[]) {
  try {
    const frasi = dividiInFrasi(testi.join('\n'))
    const [{ data: pers }, { data: esempi }] = await Promise.all([
      db.from('personaggi').select('nome, descrizione').order('creato'),
      db.from('esempi_pulizia').select('testo, proposto, scelto').order('creato', { ascending: false }).limit(30)
    ])

    const contesto: string[] = []
    if (pers?.length) {
      contesto.push('Personaggi delle storie:\n' + pers.map((p) => `- ${p.nome}${p.descrizione ? ': ' + p.descrizione : ''}`).join('\n'))
    }
    if (esempi?.length) {
      contesto.push('Decisioni prese dalla famiglia nelle storie precedenti, quando non era d\'accordo con te. Seguile come esempio:\n' +
        esempi.map((e) => `- «${e.testo.slice(0, 300)}»: tu avevi scelto ${e.proposto}, la famiglia ha deciso di ${e.scelto === 'tenere' ? 'tenerlo nel libro' : 'toglierlo'}.`).join('\n'))
    }
    contesto.push('Trascrizione divisa in frasi:\n' + frasi.map((f, i) => `[${i + 1}] ${f}`).join('\n'))

    const client = new Anthropic()
    // deno-lint-ignore no-explicit-any
    const params: any = {
      model: MODELLO,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: ISTRUZIONI,
      messages: [{ role: 'user', content: contesto.join('\n\n') }]
    }
    const msg = await client.beta.messages.create(params)
    if (msg.stop_reason === 'refusal') throw new Error('Claude non ha potuto elaborare questo testo')
    if (msg.stop_reason === 'max_tokens') throw new Error('La storia è troppo lunga per una sola pulizia')
    const testo = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const out = JSON.parse(testo) as { titolo_suggerito: string; blocchi: Intervallo[] }

    const blocchi = costruisciBlocchi(frasi, out.blocchi)
    const agg: Record<string, unknown> = { blocchi, stato: 'da_rivedere', pulizia_errore: null }
    if (!storia.titolo.trim() && out.titolo_suggerito?.trim()) agg.titolo = out.titolo_suggerito.trim()
    agg.testo_finale = testoFinale(blocchi)
    const { error } = await db.from('storie').update(agg).eq('id', storia.id)
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error(e)
    let m = messaggioErrore(e)
    if (e instanceof Anthropic.AuthenticationError) m = 'Chiave della Claude API non valida'
    else if (e instanceof Anthropic.RateLimitError) m = 'Troppe richieste a Claude: riprova tra qualche minuto'
    else if (e instanceof Anthropic.APIError) m = `Claude API: ${e.status ?? ''} ${e.message}`.slice(0, 500)
    await db.from('storie').update({ stato: 'trascritta', pulizia_errore: m }).eq('id', storia.id)
  }
}

// Trasforma gli intervalli di Claude in blocchi di testo, coprendo tutte le frasi anche se Claude ne ha saltata qualcuna
function costruisciBlocchi(frasi: string[], intervalli: Intervallo[]): Blocco[] {
  const tipoDi: (Intervallo | null)[] = frasi.map(() => null)
  for (const iv of intervalli ?? []) {
    const da = Math.max(1, Math.min(iv.da, iv.a)), a = Math.min(frasi.length, Math.max(iv.da, iv.a))
    for (let i = da; i <= a; i++) if (!tipoDi[i - 1]) tipoDi[i - 1] = iv
  }
  const blocchi: Blocco[] = []
  let corrente = null as { iv: Intervallo | null; frasi: string[] } | null
  const chiudi = () => {
    if (!corrente) return
    const tipo: Tipo = corrente.iv?.tipo ?? 'storia'
    blocchi.push({
      id: crypto.randomUUID(),
      tipo,
      testo: corrente.frasi.join(' '),
      proposta: tipo === 'idea' ? (corrente.iv?.proposta ?? '').trim() : '',
      motivo: corrente.iv?.motivo ?? '',
      tenuto: tipo !== 'contorno',
      usa_proposta: tipo === 'idea' && Boolean(corrente.iv?.proposta?.trim())
    })
  }
  frasi.forEach((f, i) => {
    const iv = tipoDi[i]
    if (corrente && corrente.iv === iv) corrente.frasi.push(f)
    else { chiudi(); corrente = { iv, frasi: [f] } }
  })
  chiudi()
  return blocchi
}

function testoFinale(blocchi: Blocco[]): string {
  return blocchi.filter((b) => b.tenuto).map((b) => (b.usa_proposta && b.proposta ? b.proposta : b.testo)).join(' ')
}
