// Salvataggio automatico mentre si scrive: raccoglie le modifiche e le scrive dopo una pausa,
// una scrittura alla volta per riga. Si usa per le schede del quaderno.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type StatoSalvataggio = 'salvato' | 'da_salvare' | 'salvataggio' | 'errore'

export function useSalvataggio(tabella: string, chiave: { colonna: string; valore: string | number }) {
  const [stato, setStato] = useState<StatoSalvataggio>('salvato')
  const [errore, setErrore] = useState<string | null>(null)
  const inAttesa = useRef<Record<string, unknown>>({})
  const timer = useRef<number | null>(null)
  const catena = useRef<Promise<void>>(Promise.resolve())

  const scrivi = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const patch = inAttesa.current
    if (!Object.keys(patch).length) return catena.current
    inAttesa.current = {}
    setStato('salvataggio')
    catena.current = catena.current.then(async () => {
      const { error } = await supabase.from(tabella).update(patch).eq(chiave.colonna, chiave.valore)
      if (error) {
        // rimetto le modifiche in coda per il prossimo tentativo
        inAttesa.current = { ...patch, ...inAttesa.current }
        setErrore(/fetch|network|load failed/i.test(error.message) ? 'Senza connessione: riprovo appena torna la rete' : error.message)
        setStato('errore')
      } else {
        setErrore(null)
        setStato(Object.keys(inAttesa.current).length ? 'da_salvare' : 'salvato')
      }
    })
    return catena.current
  }, [tabella, chiave.colonna, chiave.valore])

  const salva = useCallback((campi: Record<string, unknown>, subito = false) => {
    inAttesa.current = { ...inAttesa.current, ...campi }
    setStato('da_salvare')
    if (timer.current) clearTimeout(timer.current)
    if (subito) void scrivi()
    else timer.current = window.setTimeout(() => { void scrivi() }, 900)
  }, [scrivi])

  // uscendo dalla scheda si salva quello che resta; se c'era un errore si riprova quando torna la rete
  useEffect(() => {
    const online = () => { void scrivi() }
    window.addEventListener('online', online)
    return () => { window.removeEventListener('online', online); void scrivi() }
  }, [scrivi])

  return { stato, errore, salva, scrivi }
}

export function etichettaSalvataggio(s: StatoSalvataggio): string {
  return s === 'salvato' ? 'Salvato' : s === 'salvataggio' ? 'Salvataggio…' : s === 'da_salvare' ? 'Da salvare…' : 'Non salvato'
}
