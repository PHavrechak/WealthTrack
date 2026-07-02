import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { getMonthlyGoal, upsertMonthlyGoal } from '../api/monthlyGoals'
import { getAvailableToSpend } from '../api/dashboard'
import type { AvailableToSpend, MonthlyGoal } from '../types'

function currentPeriod() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

function formatCurrency(value: string) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function Dashboard() {
  const [{ month, year }] = useState(currentPeriod)
  const [goal, setGoal] = useState<MonthlyGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [available, setAvailable] = useState<AvailableToSpend | null>(null)
  const [availableLoading, setAvailableLoading] = useState(true)

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

  useEffect(() => {
    loadGoal()
    loadAvailable()
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

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div
          className={`rounded-2xl border p-8 ${
            available && Number(available.available_to_spend) < 0
              ? 'border-red-900/60 bg-red-950/20'
              : 'border-neutral-800 bg-neutral-900'
          }`}
        >
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Disponível para gastar este mês
          </h2>

          {availableLoading ? (
            <p className="text-neutral-400">Carregando...</p>
          ) : available ? (
            <>
              <p
                className={`text-5xl font-semibold tracking-tight ${
                  Number(available.available_to_spend) < 0
                    ? 'text-red-400'
                    : 'text-emerald-400'
                }`}
              >
                {formatCurrency(available.available_to_spend)}
              </p>

              {Number(available.available_to_spend) < 0 && (
                <p className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-400">
                  Seus gastos já ultrapassaram o que a meta de investimento
                  permite neste mês.
                </p>
              )}

              {!available.has_goal_defined && (
                <p className="mt-3 rounded-lg border border-amber-900 bg-amber-950/40 px-4 py-2 text-sm text-amber-400">
                  Defina sua meta do mês para um cálculo mais preciso — por
                  enquanto ela está sendo considerada como zero.
                </p>
              )}

              <dl className="mt-5 flex flex-col gap-1.5 border-t border-neutral-800 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-400">Receitas do mês</dt>
                  <dd className="text-emerald-400">
                    {formatCurrency(available.total_income)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-400">Despesas do mês</dt>
                  <dd className="text-red-400">
                    −{formatCurrency(available.total_expenses)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-400">Meta de investimento</dt>
                  <dd className="text-neutral-300">
                    −{formatCurrency(available.target_investment_amount)}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Meta do mês
          </h2>

          {loading ? (
            <p className="text-neutral-400">Carregando...</p>
          ) : editing ? (
            <form
              onSubmit={handleSubmit}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="goal-amount" className="text-sm text-neutral-300">
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
                  className="w-40 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                Cancelar
              </button>
            </form>
          ) : goal ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-semibold text-neutral-100">
                {formatCurrency(goal.target_investment_amount)}
              </span>
              <button
                type="button"
                onClick={startEditing}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                Editar meta
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-neutral-500">
                Nenhuma meta definida para este mês.
              </span>
              <button
                type="button"
                onClick={startEditing}
                className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-500"
              >
                Definir meta
              </button>
            </div>
          )}
        </div>

        <p className="text-neutral-500">
          Mais métricas em breve — relatórios de padrão de gasto chegam nas
          próximas etapas.
        </p>
      </div>
    </AppLayout>
  )
}
