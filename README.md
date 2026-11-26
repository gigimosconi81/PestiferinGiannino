# Le storie di Pestiferin

Web app da installare sul telefono per trasformare in libro le storie di Pestiferin Giannino che Agata racconta a Riccardo.

**Fase 1 (questa versione):** registrare, trascrivere, ripulire con Claude, rivedere.

1. **Registra**: si preme il tasto rosso e si racconta. Funziona anche senza internet: l'audio si salva nel telefono ogni 5 secondi, quindi se l'app si chiude o la batteria finisce non si perde niente. I racconti lunghi vengono divisi in parti da 20 minuti senza interrompere la registrazione.
2. **Trascrive**: appena c'è rete la registrazione viene caricata e trasformata in testo. I nomi dei personaggi elencati nella pagina *Famiglia* aiutano a scriverli giusti.
3. **Ripulisce**: Claude legge la trascrizione e segna i pezzi fuori dalla storia ("pensiamo a cosa può fare adesso…") e le idee decise insieme a Riccardo, per le quali propone una frase raccontata. Claude non riscrive il resto: le parole restano quelle di Agata.
4. **Revisione**: ogni pezzo si può togliere, rimettere o modificare. Quando la famiglia non è d'accordo con Claude la scelta viene ricordata e usata come esempio nelle pulizie successive.

Prossime fasi: schede dei personaggi e disegni, impaginazione, PDF per Amazon KDP.

## Messa in funzione

Servono quattro account: **Supabase** (database e archivio audio), **Vercel** (pubblicazione), **Claude API** (pulizia del testo, console.anthropic.com) e **OpenAI** (trascrizione, platform.openai.com).

1. **Database**: crea un nuovo progetto Supabase. In *SQL Editor → New query* incolla tutto `supabase/schema.sql` e premi *Run*. Poi togli il `--` dall'ultima riga, metti il tuo indirizzo email (minuscolo) e rilancia solo quella riga: diventi l'amministratore. Gli altri membri della famiglia li aggiungi poi dall'app, nella pagina *Famiglia*.
2. **Accessi**: in Supabase, *Authentication → URL Configuration*: in *Site URL* metti l'indirizzo Vercel dell'app e aggiungilo anche in *Redirect URLs*.
3. **Funzioni del server**: con la [Supabase CLI](https://supabase.com/docs/guides/cli), dalla cartella del progetto:

   ```bash
   supabase login
   supabase link --project-ref IL_TUO_PROJECT_REF
   supabase secrets set ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
   supabase functions deploy trascrivi
   supabase functions deploy ripulisci
   ```

   In alternativa le funzioni si possono creare dalla dashboard (*Edge Functions → Deploy a new function*) copiando i file di `supabase/functions/`, e le chiavi si inseriscono in *Edge Functions → Secrets*.
4. **Pubblicazione**: in Vercel: *Add New → Project*, importa questo repository, aggiungi le variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (da Supabase, *Project Settings → API*), poi *Deploy*.

Senza le chiavi l'app funziona lo stesso per registrare e caricare l'audio: la trascrizione e la pulizia partono quando le chiavi ci sono, dal tasto *Trascrivi* della storia.

## Costi indicativi

- Trascrizione: circa 0,30–0,40 € per un'ora di racconto.
- Pulizia con Claude: pochi centesimi per storia. Claude restituisce solo quali frasi tenere, non riscrive il testo, quindi la risposta è breve.
- Supabase e Vercel: i piani gratuiti bastano. Il piano gratuito di Supabase permette due progetti attivi e 1 GB di archivio: circa 40 ore di audio.

## Sviluppo locale

```bash
cp .env.example .env   # e inserisci i valori
npm install
npm run dev
```

## Come è fatto

- `src/lib/registratore.ts`: registrazione con salvataggio continuo, cambio parte ogni 20 minuti, schermo acceso.
- `src/lib/archivio.ts`: archivio nel telefono (IndexedDB) per le registrazioni in corso e quelle da caricare.
- `src/lib/sincronizza.ts`: caricamento delle registrazioni e avvio della trascrizione.
- `supabase/functions/trascrivi`: trascrizione (modello `gpt-4o-transcribe`, si cambia con il secret `TRASCRIZIONE_MODELLO`).
- `supabase/functions/ripulisci`: pulizia con Claude (`claude-opus-5-5`, con modello di riserva automatico se Claude rifiuta una richiesta).
