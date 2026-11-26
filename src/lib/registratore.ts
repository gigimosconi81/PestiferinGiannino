// Registratore per i racconti.
// - Salva un pezzo ogni 5 secondi nel telefono (vedi archivio.ts).
// - Ogni 20 minuti chiude la parte e ne apre una nuova senza interrompere: i file restano
//   piccoli e il servizio di trascrizione li accetta.
// - Tiene lo schermo acceso mentre registra (dove il telefono lo permette).
import { useCallback, useEffect, useRef, useState } from 'react'
import { chiudiParte, iniziaParte, salvaPezzo } from './archivio'
import { sincronizza } from './sincronizza'

export type StatoRegistratore = 'pronto' | 'avvio' | 'registra' | 'pausa' | 'chiusura'

const DURATA_PARTE = 20 * 60
const PEZZO_MS = 5000

export const partiAttive = new Set<string>()

function scegliFormato(): string {
  const candidati = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
  for (const c of candidati) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  return ''
}

export function registrazionePossibile(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export function useRegistratore(storiaId: string, onParteSalvata: () => void) {
  const [stato, setStato] = useState<StatoRegistratore>('pronto')
  const [secondi, setSecondi] = useState(0)
  const [livello, setLivello] = useState(0)
  const [errore, setErrore] = useState<string | null>(null)

  const stream = useRef<MediaStream | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const parte = useRef<{ id: string; numero: number; secondi: number; seq: number; scritture: Promise<void> } | null>(null)
  const numeroParte = useRef(0)
  const timer = useRef<number | null>(null)
  const wake = useRef<WakeLockSentinel | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const raf = useRef<number | null>(null)
  const formato = useRef('')
  const fermando = useRef(false)
  const callback = useRef(onParteSalvata)
  callback.current = onParteSalvata

  const chiediSchermoAcceso = async () => {
    try { wake.current = await navigator.wakeLock?.request('screen') ?? null } catch { wake.current = null }
  }

  const avviaParte = useCallback(async () => {
    if (!stream.current) return
    numeroParte.current += 1
    const id = crypto.randomUUID()
    const p = { id, numero: numeroParte.current, secondi: 0, seq: 0, scritture: Promise.resolve() }
    parte.current = p
    partiAttive.add(id)
    await iniziaParte({ id, storiaId, mime: formato.current || 'audio/webm', parte: p.numero, iniziata: new Date().toISOString() })
    const r = new MediaRecorder(stream.current, { ...(formato.current ? { mimeType: formato.current } : {}), audioBitsPerSecond: 48000 })
    if (!formato.current) formato.current = r.mimeType
    r.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return
      const seq = p.seq++
      p.scritture = p.scritture.then(() => salvaPezzo(id, seq, e.data)).catch(() => setErrore('Il telefono non riesce a salvare l\'audio: spazio pieno?'))
    }
    r.onstop = async () => {
      await p.scritture
      await chiudiParte(id, p.secondi)
      partiAttive.delete(id)
      callback.current()
      void sincronizza()
      if (fermando.current) return
      // cambio parte automatico: si riparte subito sullo stesso microfono
      if (stream.current) void avviaParte()
    }
    rec.current = r
    r.start(PEZZO_MS)
  }, [storiaId])

  const fermaTutto = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null }
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    void audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    void wake.current?.release().catch(() => {})
    wake.current = null
    setLivello(0)
  }

  const avvia = useCallback(async () => {
    setErrore(null)
    if (!registrazionePossibile()) { setErrore('Questo browser non può registrare. Prova con Safari su iPhone o Chrome su Android.'); return }
    setStato('avvio')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch {
      setStato('pronto')
      setErrore('Serve il permesso per il microfono. Controlla le impostazioni del browser e riprova.')
      return
    }
    formato.current = scegliFormato()
    fermando.current = false
    numeroParte.current = 0
    setSecondi(0)
    await chiediSchermoAcceso()

    // indicatore del volume, per vedere che il microfono sente
    try {
      const ctx = new AudioContext()
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(stream.current).connect(an)
      const dati = new Uint8Array(an.fftSize)
      const giro = () => {
        an.getByteTimeDomainData(dati)
        let somma = 0
        for (const v of dati) somma += ((v - 128) / 128) ** 2
        setLivello(Math.min(1, Math.sqrt(somma / dati.length) * 4))
        raf.current = requestAnimationFrame(giro)
      }
      audioCtx.current = ctx
      giro()
    } catch { /* senza indicatore si registra lo stesso */ }

    await avviaParte()
    setStato('registra')
    timer.current = window.setInterval(() => {
      const p = parte.current
      if (!p || rec.current?.state !== 'recording') return
      p.secondi += 1
      setSecondi((s) => s + 1)
      if (p.secondi >= DURATA_PARTE) rec.current.stop() // onstop apre la parte successiva
    }, 1000)
  }, [avviaParte])

  const pausa = useCallback(() => {
    if (rec.current?.state === 'recording') { rec.current.pause(); setStato('pausa') }
  }, [])
  const riprendi = useCallback(() => {
    if (rec.current?.state === 'paused') { rec.current.resume(); setStato('registra'); void chiediSchermoAcceso() }
  }, [])
  const ferma = useCallback(() => {
    fermando.current = true
    setStato('chiusura')
    const r = rec.current
    const finito = () => { fermaTutto(); setStato('pronto') }
    if (r && r.state !== 'inactive') {
      r.addEventListener('stop', () => setTimeout(finito, 0), { once: true })
      r.stop()
    } else finito()
  }, [])

  // se lo schermo si spegne e si riaccende, richiediamo di tenerlo acceso
  useEffect(() => {
    const vis = () => { if (document.visibilityState === 'visible' && rec.current?.state === 'recording') void chiediSchermoAcceso() }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])

  // uscendo dalla pagina mentre registra: si chiude e si salva quello che c'è
  useEffect(() => () => {
    fermando.current = true
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
    fermaTutto()
  }, [])

  return { stato, secondi, livello, errore, avvia, pausa, riprendi, ferma }
}

export function formattaDurata(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
