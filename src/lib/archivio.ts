// Archivio locale nel telefono (IndexedDB).
// - "parti": le registrazioni in corso. Ogni 5 secondi un pezzo d'audio finisce in "pezzi",
//   così se il telefono si spegne o l'app si chiude non si perde il racconto.
// - "attesa": le registrazioni finite che devono ancora essere caricate sul server.

const DB_NOME = 'storie-pestiferin'
const VERSIONE = 1

export interface ParteInCorso {
  id: string
  storiaId: string
  mime: string
  parte: number
  iniziata: string // ISO
}

export interface InAttesa {
  id: string
  storiaId: string
  mime: string
  parte: number
  registrataIl: string
  durata: number
  blob: Blob
  recuperata?: boolean
}

interface Pezzo { parteId: string; seq: number; blob: Blob }

let aperto: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!aperto) {
    aperto = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOME, VERSIONE)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('parti')) d.createObjectStore('parti', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('pezzi')) d.createObjectStore('pezzi', { keyPath: ['parteId', 'seq'] })
        if (!d.objectStoreNames.contains('attesa')) d.createObjectStore('attesa', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => { aperto = null; reject(req.error) }
    })
  }
  return aperto
}

function attendi<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
}
function fine(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) })
}

export async function iniziaParte(p: ParteInCorso): Promise<void> {
  const tx = (await db()).transaction('parti', 'readwrite')
  tx.objectStore('parti').put(p)
  await fine(tx)
}

export async function salvaPezzo(parteId: string, seq: number, blob: Blob): Promise<void> {
  const tx = (await db()).transaction('pezzi', 'readwrite')
  tx.objectStore('pezzi').put({ parteId, seq, blob } satisfies Pezzo)
  await fine(tx)
}

async function pezziDi(parteId: string): Promise<Pezzo[]> {
  const tx = (await db()).transaction('pezzi', 'readonly')
  const range = IDBKeyRange.bound([parteId, 0], [parteId, Number.MAX_SAFE_INTEGER])
  const tutti = await attendi(tx.objectStore('pezzi').getAll(range)) as Pezzo[]
  return tutti.sort((a, b) => a.seq - b.seq)
}

// Chiude una parte: unisce i pezzi in un solo file e lo mette in attesa di caricamento
export async function chiudiParte(parteId: string, durata: number, recuperata = false): Promise<InAttesa | null> {
  const d = await db()
  const parte = await attendi(d.transaction('parti', 'readonly').objectStore('parti').get(parteId)) as ParteInCorso | undefined
  if (!parte) return null
  const pezzi = await pezziDi(parteId)
  const tx = d.transaction(['parti', 'pezzi', 'attesa'], 'readwrite')
  let voce: InAttesa | null = null
  if (pezzi.length) {
    const blob = new Blob(pezzi.map((p) => p.blob), { type: parte.mime })
    voce = { id: parte.id, storiaId: parte.storiaId, mime: parte.mime, parte: parte.parte, registrataIl: parte.iniziata, durata, blob, recuperata }
    tx.objectStore('attesa').put(voce)
  }
  tx.objectStore('parti').delete(parteId)
  tx.objectStore('pezzi').delete(IDBKeyRange.bound([parteId, 0], [parteId, Number.MAX_SAFE_INTEGER]))
  await fine(tx)
  return voce
}

// All'avvio: le registrazioni rimaste a metà (app chiusa, batteria finita) diventano registrazioni in attesa
export async function recuperaPartiInterrotte(attive: Set<string>): Promise<number> {
  const parti = await attendi((await db()).transaction('parti', 'readonly').objectStore('parti').getAll()) as ParteInCorso[]
  let n = 0
  for (const p of parti) {
    if (attive.has(p.id)) continue
    const pezzi = await pezziDi(p.id)
    const durata = pezzi.length * 5 // ogni pezzo sono circa 5 secondi
    if (await chiudiParte(p.id, durata, true)) n++
  }
  return n
}

export async function elencoAttesa(storiaId?: string): Promise<InAttesa[]> {
  const tutte = await attendi((await db()).transaction('attesa', 'readonly').objectStore('attesa').getAll()) as InAttesa[]
  return tutte.filter((a) => !storiaId || a.storiaId === storiaId).sort((a, b) => a.registrataIl.localeCompare(b.registrataIl))
}

export async function togliDaAttesa(id: string): Promise<void> {
  const tx = (await db()).transaction('attesa', 'readwrite')
  tx.objectStore('attesa').delete(id)
  await fine(tx)
}
