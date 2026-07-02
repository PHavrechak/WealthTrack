import { useAuth } from '../context/AuthContext'

export function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">
          WealthTrack
        </span>
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

      <main className="flex flex-1 items-center justify-center text-neutral-500">
        Dashboard em construção
      </main>
    </div>
  )
}
