import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `text-sm transition ${
    isActive ? 'font-medium text-white' : 'text-neutral-400 hover:text-neutral-200'
  }`
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="text-lg font-semibold tracking-tight">
            WealthTrack
          </span>
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
          <span className="text-sm text-neutral-400">{user?.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
