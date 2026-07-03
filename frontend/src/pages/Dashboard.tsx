import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { getMonthlyGoal, upsertMonthlyGoal } from '../api/monthlyGoals'
import { getAvailableToSpend } from '../api/dashboard'
import { getInsights } from '../api/insights'
import type {
  AvailableToSpend,
  Insight,
  InsightSeverity,
  MonthlyGoal,
} from '../types'

const insightSeverityStyles: Record<
  InsightSeverity,
  { accent: string; text: string; label: string }
> = {
  info: { accent: 'border-l-positive', text: 'text-positive', label: 'Informativo' },
  attention: { accent: 'border-l-brass', text: 'text-brass', label: 'Atenção' },
  alert: { accent: 'border-l-negative', text: 'text-negative', label: 'Alerta' },
}

function currentPeriod() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function monthLongName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
  })
}

function monthBadge(month: number, year: number) {
  const abbr = new Date(year, month - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
  return `${abbr} ${year}`
}

/** Anima de 0 até o valor alvo a cada mudança (contagem de fechamento). */
function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame: number
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}

function LedgerRow({
  index,
  label,
  value,
  valueClass,
}: {
  index: string
  label: string
  value: string
  valueClass: string
}) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="font-mono text-xs text-ink-muted">{index}</span>
      <span className="text-ink-muted">{label}</span>
      <span
        aria-hidden
        className="mb-1 flex-1 self-end border-b border-dotted border-hairline"
      />
      <span className={`font-mono ${valueClass}`}>{value}</span>
    </div>
  )
}

function ClosingTotal({ amount }: { amount: string }) {
  const target = Number(amount)
  const animated = useCountUp(target)
  const negative = target < 0

  return (
    <p
      className={`font-mono text-5xl tracking-tight ${
        negative ? 'text-negative' : 'text-positive'
      }`}
    >
      {formatCurrency(animated)}
    </p>
  )
}

export function Dashboard() {
  const [{ month, year }] = useState(currentPeriod)
  const [goal, setGoal] = useState<MonthlyGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [available, setAvailable] = useState<AvailableToSpend | null>(null)
  const [availableLoading, setAvailableLoading] = useState(true)

  const [topInsight, setTopInsight] = useState<Insight | null>(null)

  const [editing, setEditing] = useState(false)
  const [targetAmount, setTargetAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadGoal = async () => {
    setLoading(true)
    setError(null)
    try {
      setGoal(await getMonthlyGoal(month, year))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar meta.')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailable = async () => {
    setAvailableLoading(true)
    try {
      setAvailable(await getAvailableToSpend(month, year))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao calcular o disponível para gastar.',
      )
    } finally {
      setAvailableLoading(false)
    }
  }

  const loadTopInsight = async () => {
    try {
      const data = await getInsights()
      // o backend já ordena por severidade; o primeiro é o mais relevante
      setTopInsight(
        data.sufficient_data && data.insights.length > 0
          ? data.insights[0]
          : null,
      )
    } catch {
      // sem dados suficientes ou erro: o card simplesmente não aparece
      setTopInsight(null)
    }
  }

  useEffect(() => {
    loadGoal()
    loadAvailable()
    loadTopInsight()
  }, [])

  const startEditing = () => {
    setTargetAmount(goal?.target_investment_amount ?? '')
    setEditing(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      setGoal(
        await upsertMonthlyGoal({
          month,
          year,
          target_investment_amount: targetAmount,
        }),
      )
      setEditing(false)
      loadAvailable()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar meta.')
    } finally {
      setSubmitting(false)
    }
  }

  const isNegative = available
    ? Number(available.available_to_spend) < 0
    : false
  const hasEntries = available
    ? Number(available.total_income) !== 0 ||
      Number(available.total_expenses) !== 0
    : false

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-2xl tracking-tight">Dashboard</h1>
          <span className="font-serif text-sm text-ink-muted">
            Extrato — {monthLongName(month, year)} de {year}
          </span>
        </div>

        {error && (
          <p className="border border-negative/50 bg-negative/10 px-4 py-2 text-sm text-negative">
            {error}
          </p>
        )}

        <div
          className={`relative border p-8 ${
            isNegative ? 'border-negative/50' : 'border-hairline'
          } bg-card`}
        >
          <span
            aria-hidden
            className="absolute top-6 right-6 rotate-2 border border-dashed border-brass px-2.5 py-1 font-mono text-xs tracking-widest text-brass"
          >
            {monthBadge(month, year)}
          </span>

          <h2 className="mb-6 font-serif text-sm tracking-wide text-ink-muted uppercase">
            Fechamento do mês
          </h2>

          {availableLoading ? (
            <p className="text-ink-muted">Carregando...</p>
          ) : available ? (
            !hasEntries ? (
              <div className="flex flex-col items-start gap-4 py-2">
                <p className="text-ink-muted">
                  Nenhum lançamento neste mês. Registre o primeiro.
                </p>
                <Link
                  to="/transacoes"
                  className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90"
                >
                  Registrar lançamento
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  <LedgerRow
                    index="001"
                    label="Receitas do mês"
                    value={formatCurrency(available.total_income)}
                    valueClass="text-positive"
                  />
                  <LedgerRow
                    index="002"
                    label="Despesas do mês"
                    value={`−${formatCurrency(available.total_expenses)}`}
                    valueClass="text-negative"
                  />
                  <LedgerRow
                    index="003"
                    label="Meta de investimento"
                    value={`−${formatCurrency(available.target_investment_amount)}`}
                    valueClass="text-brass"
                  />
                </div>

                <div className="mt-5 border-t border-hairline" />
                <div className="mt-[3px] border-t border-hairline" />

                <div className="mt-5">
                  <p className="mb-1 font-serif text-sm text-ink-muted">
                    Disponível para gastar
                  </p>
                  <ClosingTotal amount={available.available_to_spend} />
                </div>

                {isNegative && (
                  <p className="mt-4 border border-negative/50 bg-negative/10 px-4 py-2 text-sm text-negative">
                    Seus gastos já ultrapassaram o que a meta de investimento
                    permite neste mês.
                  </p>
                )}

                {!available.has_goal_defined && (
                  <p className="mt-4 border border-brass/50 bg-brass/10 px-4 py-2 text-sm text-brass">
                    Defina sua meta do mês para um cálculo mais preciso — por
                    enquanto ela está sendo considerada como zero.
                  </p>
                )}
              </>
            )
          ) : null}
        </div>

        <div className="border border-hairline bg-card p-6">
          <h2 className="mb-1 font-serif text-sm tracking-wide text-ink-muted uppercase">
            Meta do mês
          </h2>

          {loading ? (
            <p className="text-ink-muted">Carregando...</p>
          ) : editing ? (
            <form
              onSubmit={handleSubmit}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-amount" className="text-sm text-ink-muted">
                  Valor alvo de investimento
                </label>
                <input
                  id="goal-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={targetAmount}
                  onChange={(event) => setTargetAmount(event.target.value)}
                  className="w-40 border border-hairline bg-paper px-3 py-2 font-mono text-ink outline-none focus:border-brass"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="border border-hairline px-4 py-2 text-sm text-ink-muted transition hover:border-ink-muted hover:text-ink"
              >
                Cancelar
              </button>
            </form>
          ) : goal ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-3xl text-ink">
                {formatCurrency(goal.target_investment_amount)}
              </span>
              <button
                type="button"
                onClick={startEditing}
                className="border border-hairline px-3 py-1.5 text-sm text-ink-muted transition hover:border-ink-muted hover:text-ink"
              >
                Editar meta
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-ink-muted">
                Nenhuma meta definida para este mês. Defina a primeira.
              </span>
              <button
                type="button"
                onClick={startEditing}
                className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90"
              >
                Definir meta
              </button>
            </div>
          )}
        </div>

        {topInsight && (
          <div
            className={`border border-hairline border-l-2 ${insightSeverityStyles[topInsight.severity].accent} bg-card p-5`}
          >
            <p
              className={`mb-2 font-mono text-xs tracking-widest uppercase ${insightSeverityStyles[topInsight.severity].text}`}
            >
              {insightSeverityStyles[topInsight.severity].label}
            </p>
            <p className="text-ink">{topInsight.message}</p>
            <Link
              to="/insights"
              className="mt-3 inline-block text-sm text-brass transition hover:text-brass/80"
            >
              Ver todos os insights →
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
