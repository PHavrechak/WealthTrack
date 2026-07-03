import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `border-b pb-0.5 text-sm transition ${
    isActive
      ? 'border-brass text-ink'
      : 'border-transparent text-ink-muted hover:text-ink'
  }`
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="font-serif text-lg tracking-tight">WealthTrack</span>
          <nav className="flex items-center gap-6">
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/categorias" className={navLinkClass}>
              Categorias
            </NavLink>
            <NavLink to="/transacoes" className={navLinkClass}>
              Transações
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-muted">{user?.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="border border-hairline px-3 py-1.5 text-sm text-ink-muted transition hover:border-ink-muted hover:text-ink"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
