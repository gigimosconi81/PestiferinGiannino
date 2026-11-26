// Il quaderno dei personaggi: le domande delle schede.
// Le risposte finiscono nella colonna "scheda" (jsonb) di personaggi, luoghi, stile e storie.

export type TipoCampo = 'text' | 'area' | 'choice' | 'color' | 'images'

export interface Campo {
  k: string
  label: string
  type: TipoCampo
  hint?: string
  ph?: string
  options?: string[]
}

export interface Sezione {
  titolo: string
  intro?: string
  campi: Campo[]
}

export interface Immagine { path: string; nota: string }
export type Scheda = Record<string, string>

export const PERSONAGGIO: Sezione[] = [
  { titolo: 'Chi è', campi: [
    { k: 'nome', label: 'Nome', type: 'text', ph: 'Es. Pestiferin Giannino' },
    { k: 'soprannomi', label: 'Soprannomi, e perché si chiama così', type: 'area' },
    { k: 'tipo', label: 'Che cos\'è', hint: 'Un bambino, un cane, un adulto, un animale, una creatura inventata…', type: 'text' },
    { k: 'eta', label: 'Quanti anni ha (o quanti ne dimostra)', type: 'text' },
    { k: 'ruolo', label: 'Quanto conta nelle storie', type: 'choice', options: ['Protagonista', 'C\'è quasi sempre', 'Compare ogni tanto', 'È il rivale o il "cattivo"'] }
  ] },
  { titolo: 'Com\'è fatto', intro: 'La parte più importante per i disegni: più è precisa, più il personaggio resta uguale in tutte le pagine.', campi: [
    { k: 'corpo', label: 'Corporatura e altezza', hint: 'Alto, basso, magro, rotondo… e rispetto agli altri: «arriva alla spalla di…».', type: 'area' },
    { k: 'viso', label: 'Viso o muso', hint: 'Forma, naso, guance, denti, lentiggini…', type: 'area' },
    { k: 'capelli', label: 'Capelli o pelo', hint: 'Colore preciso, lunghezza, forma: ciuffo ribelle, ricci, pelo corto…', type: 'area' },
    { k: 'occhi', label: 'Occhi', hint: 'Colore, grandezza, occhiali, sopracciglia…', type: 'text' },
    { k: 'segni', label: 'Segni particolari', hint: 'Quello che lo rende riconoscibile al primo sguardo: un orecchio piegato, un cerotto sempre sul ginocchio…', type: 'area' }
  ] },
  { titolo: 'Cosa indossa e cosa porta con sé', campi: [
    { k: 'vestiti', label: 'Vestiti di tutti i giorni', hint: 'Con i colori. Se cambia spesso, quelli più tipici.', type: 'area' },
    { k: 'oggetto', label: 'Un oggetto che ha sempre con sé', hint: 'Uno zaino, una fionda, un collare con la medaglietta…', type: 'text' }
  ] },
  { titolo: 'Carattere', campi: [
    { k: 'carattere', label: 'Tre parole per descriverlo', type: 'text' },
    { k: 'emozioni', label: 'Cosa lo fa ridere, arrabbiare, spaventare', type: 'area' },
    { k: 'debolezza', label: 'Il suo punto debole', hint: 'Golosità, paura del buio, non sa stare fermo…', type: 'text' }
  ] },
  { titolo: 'Come parla e si muove', campi: [
    { k: 'frasi', label: 'Frasi tipiche, modi di dire, versi', hint: 'Le frasi che gli fate dire sempre. Per Simba: come abbaia, cosa fa quando è contento.', type: 'area' },
    { k: 'movimento', label: 'Come si muove', hint: 'Corre sempre, cammina in punta di piedi, si nasconde…', type: 'text' }
  ] },
  { titolo: 'Cosa combina', campi: [
    { k: 'marachelle', label: 'Le cose che fa di solito', hint: 'Per Pestiferin: le marachelle tipiche. Per gli altri: come reagiscono.', type: 'area' },
    { k: 'scena', label: 'Una scena che vi ricordate benissimo', hint: 'Bastano due righe: serve a capire il tono delle storie.', type: 'area' }
  ] },
  { titolo: 'Con gli altri personaggi', campi: [
    { k: 'rapporti', label: 'Che rapporto ha con gli altri', hint: 'Chi è il suo migliore amico, con chi litiga, chi lo sgrida…', type: 'area' }
  ] },
  { titolo: 'Per i disegni', campi: [
    { k: 'colore', label: 'Il suo colore', hint: 'Nel libro le parole legate a lui avranno questo colore.', type: 'color' },
    { k: 'da_non_fare', label: 'Cose da non sbagliare mai', hint: '«Simba non ha il collare rosso», «Giannino non porta mai il cappello»…', type: 'area' },
    { k: 'immagini', label: 'Immagini di riferimento', hint: 'Foto di un cane simile, un personaggio dei cartoni che somiglia, un vostro disegno anche fatto male. Per i bambini meglio un disegno o un cartone che una foto vera. Per ogni immagine scrivete cosa prendere.', type: 'images' }
  ] }
]

export const LUOGO: Sezione[] = [
  { titolo: 'Il luogo', campi: [
    { k: 'nome', label: 'Nome', ph: 'Es. La casa di Giannino', type: 'text' },
    { k: 'descrizione', label: 'Com\'è fatto', hint: 'Grande o piccolo, colori, cosa c\'è dentro, cosa si vede dalla finestra…', type: 'area' },
    { k: 'atmosfera', label: 'Che sensazione dà', hint: 'Accogliente, misterioso, caotico…', type: 'text' },
    { k: 'storie', label: 'In quali storie compare', type: 'area' },
    { k: 'immagini', label: 'Immagini di riferimento', hint: 'Foto del posto vero, se esiste, o di un posto simile.', type: 'images' }
  ] }
]

export const STILE: Sezione[] = [
  { titolo: 'Che disegni vi piacciono', campi: [
    { k: 'piace', label: 'Libri, fumetti o cartoni di cui vi piacciono i disegni', hint: 'Geronimo Stilton? Diario di una schiappa? Un cartone in particolare? Acquerelli delicati?', type: 'area' },
    { k: 'colori', label: 'Colori', type: 'choice', options: ['Vivaci e accesi', 'Delicati', 'Un po\' e un po\''] },
    { k: 'non_piace', label: 'Cosa non vi piace', type: 'area' },
    { k: 'immagini', label: 'Esempi di disegni che vi piacciono', hint: 'Foto di pagine di libri o fermi immagine di cartoni.', type: 'images' }
  ] }
]

// Campi in più per ogni storia dell'elenco (titolo e trama sono colonne della tabella storie)
export const STORIA_QUADERNO: Campo[] = [
  { k: 'personaggi', label: 'Chi c\'è', type: 'text' },
  { k: 'ricordo', label: 'Quanto ve la ricordate', type: 'choice', options: ['Benissimo', 'A grandi linee', 'Solo un pezzo'] },
  { k: 'chi', label: 'Chi se la ricorda meglio', type: 'choice', options: ['Agata', 'Riccardo', 'Tutti e due'] },
  { k: 'note', label: 'Note', type: 'text' }
]

export const COLORI = ['#d9442f', '#f08a24', '#f4b400', '#2e9b5c', '#1fa3a3', '#2f6fd9', '#7a4fd1', '#d14f9a', '#8a5a3c', '#3b3f5c']

const pieno = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim().length > 0)

// Quali sezioni hanno almeno una risposta (per la barra di completamento)
export function sezioniCompilate(sezioni: Sezione[], valori: Record<string, unknown>): boolean[] {
  return sezioni.map((s) => s.campi.some((c) => pieno(valori[c.k])))
}

// Descrizione breve del personaggio, usata da trascrizione e pulizia per capire chi è chi
export function riassuntoPersonaggio(s: Scheda): string {
  return [s.tipo, s.soprannomi, s.ruolo, s.carattere ? 'carattere: ' + s.carattere : '']
    .map((x) => (x ?? '').trim()).filter(Boolean).join('; ').slice(0, 400)
}
