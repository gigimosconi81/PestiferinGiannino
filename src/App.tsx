import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { avviaSincronizzazione } from './lib/sincronizza'
import { recuperaPartiInterrotte } from './lib/archivio'
import { partiAttive } from './lib/registratore'
import Login from './pages/Login'
import Libreria from './pages/Libreria'
import StoriaPage from './pages/Storia'
import Impostazioni from './pages/Impostazioni'
import Shell from './components/Shell'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [membro, setMembro] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setMembro(undefined); return }
    let vivo = true
    supabase.rpc('is_member').then(({ data, error }) => {
      if (!vivo) return
      // senza rete non sappiamo: lasciamo entrare, i dati nel telefono restano utilizzabili
      setMembro(error ? true : data === true)
    })
    return () => { vivo = false }
  }, [session])

  useEffect(() => {
    if (!session || !membro) return
    // registrazioni rimaste a metà dall'ultima volta, poi caricamento di quelle in attesa
    recuperaPartiInterrotte(partiAttive).catch(() => 0).finally(() => avviaSincronizzazione())
  }, [session, membro])

  if (!isConfigured) {
    return (
      <main className="center">
        <div className="panel stack">
          <h1>Manca la configurazione</h1>
          <p className="muted">L'app non sa ancora a quale database collegarsi. Le istruzioni sono nel file README del progetto.</p>
        </div>
      </main>
    )
  }
  if (session === undefined) return <main className="center"><p className="muted">…</p></main>
  if (!session) return <Login />
  if (membro === undefined) return <main className="center"><p className="muted">…</p></main>
  if (!membro) {
    return (
      <main className="center">
        <div className="panel stack">
          <h1>Non sei ancora nella famiglia</h1>
          <p className="muted">L'indirizzo {session.user.email} non è tra quelli che possono usare l'app. Chiedi a chi la gestisce di aggiungerti, poi ricarica la pagina.</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Esci</button>
        </div>
      </main>
    )
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Libreria />} />
        <Route path="/storia/:id" element={<StoriaPage />} />
        <Route path="/impostazioni" element={<Impostazioni session={session} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
