import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Tutte le storie">
          <img src="/icon.svg" alt="" width="34" height="34" />
          <span>Le storie di <b className="pest">Pestiferin</b></span>
        </Link>
        <nav className="topnav" aria-label="Menu">
          <NavLink to="/" end>Storie</NavLink>
          <NavLink to="/quaderno">Quaderno</NavLink>
          <NavLink to="/impostazioni">Famiglia</NavLink>
        </nav>
      </header>
      <main className="page">{children}</main>
    </div>
  )
}
