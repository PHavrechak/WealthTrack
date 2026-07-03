/**
 * Política de sessão da aplicação — camada própria, por cima do
 * auto-refresh do supabase-js (que continua ativo).
 *
 * PARA TESTAR LOCALMENTE: reduza os dois limites e o intervalo de checagem
 * (ex: limites = 2 * 60 * 1000 e checagem = 5 * 1000), valide o comportamento
 * e REVERTA para 1 hora antes de commitar.
 */
export const SESSION_ABSOLUTE_LIMIT_MS = 60 * 60 * 1000 // 1h desde o login
export const INACTIVITY_LIMIT_MS = 60 * 60 * 1000 // 1h sem interação
export const ACTIVITY_WRITE_THROTTLE_MS = 20 * 1000
export const EXPIRY_CHECK_INTERVAL_MS = 30 * 1000

export const SESSION_STARTED_KEY = 'wealthtrack.session_started_at'
export const LAST_ACTIVITY_KEY = 'wealthtrack.last_activity_at'

export const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'click',
  'scroll',
  'touchstart',
] as const

export function isSessionExpired(now = Date.now()): boolean {
  const startedAt = Number(localStorage.getItem(SESSION_STARTED_KEY))
  const lastActivityAt = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
  if (startedAt && now - startedAt > SESSION_ABSOLUTE_LIMIT_MS) {
    return true
  }
  if (lastActivityAt && now - lastActivityAt > INACTIVITY_LIMIT_MS) {
    return true
  }
  return false
}

export function ensureSessionTimestamps(now = Date.now()): void {
  if (!localStorage.getItem(SESSION_STARTED_KEY)) {
    localStorage.setItem(SESSION_STARTED_KEY, String(now))
  }
  if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
  }
}

export function clearSessionTimestamps(): void {
  localStorage.removeItem(SESSION_STARTED_KEY)
  localStorage.removeItem(LAST_ACTIVITY_KEY)
}
