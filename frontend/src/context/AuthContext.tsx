import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import {
  ACTIVITY_EVENTS,
  ACTIVITY_WRITE_THROTTLE_MS,
  EXPIRY_CHECK_INTERVAL_MS,
  LAST_ACTIVITY_KEY,
  clearSessionTimestamps,
  ensureSessionTimestamps,
  isSessionExpired,
} from '../lib/sessionPolicy'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const expiringRef = useRef(false)

  const forceExpire = () => {
    if (expiringRef.current) {
      return
    }
    expiringRef.current = true
    clearSessionTimestamps()
    // signOut adiado para fora do callback do onAuthStateChange
    // (chamadas ao supabase dentro do callback podem travar o client)
    window.setTimeout(async () => {
      await supabase.auth.signOut()
      expiringRef.current = false
      navigate('/login?motivo=sessao-expirada', { replace: true })
    }, 0)
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        clearSessionTimestamps()
        setSession(null)
        setLoading(false)
        return
      }
      if (newSession && isSessionExpired()) {
        // aba reaberta depois do limite: derruba já na inicialização
        setSession(null)
        setLoading(false)
        forceExpire()
        return
      }
      if (newSession) {
        // login novo (timestamps limpos no signOut anterior) inicia a janela;
        // sessão restaurada dentro da janela mantém os timestamps existentes
        ensureSessionTimestamps()
      }
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const user = session?.user ?? null

  useEffect(() => {
    if (!user) {
      return
    }
    let lastWrite = 0
    const recordActivity = () => {
      const now = Date.now()
      if (now - lastWrite < ACTIVITY_WRITE_THROTTLE_MS) {
        return
      }
      lastWrite = now
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
    }
    recordActivity()
    ACTIVITY_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, {
        passive: true,
        capture: true,
      }),
    )
    return () =>
      ACTIVITY_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity, {
          capture: true,
        }),
      )
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }
    const intervalId = window.setInterval(() => {
      if (isSessionExpired()) {
        forceExpire()
      }
    }, EXPIRY_CHECK_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const signOut = async () => {
    clearSessionTimestamps()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
