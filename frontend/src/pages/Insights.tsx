import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { getInsights } from '../api/insights'
import type { Insight, InsightSeverity, InsightsResponse } from '../types'

const severityStyles: Record<
  InsightSeverity,
  { accent: string; text: string; label: string }
> = {
  info: { accent: 'border-l-positive', text: 'text-positive', label: 'Informativo' },
  attention: { accent: 'border-l-brass', text: 'text-brass', label: 'Atenção' },
  alert: { accent: 'border-l-negative', text: 'text-negative', label: 'Alerta' },
}

function InsightCard({ insight }: { insight: Insight }) {
  const style = severityStyles[insight.severity]

  return (
    <li className={`border border-hairline border-l-2 ${style.accent} bg-card p-5`}>
      <p className={`mb-2 font-mono text-xs tracking-widest uppercase ${style.text}`}>
        {style.label}
      </p>
      <p className="text-ink">{insight.message}</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink-muted transition hover:text-ink">
          Ver detalhes
        </summary>
        <dl className="mt-3 flex flex-col gap-1.5 border-t border-hairline pt-3">
          {insight.details.map((detail) => (
            <div key={detail.label} className="flex items-baseline gap-2 text-sm">
              <dt className="text-ink-muted">{detail.label}</dt>
              <span
                aria-hidden
                className="mb-1 flex-1 self-end border-b border-dotted border-hairline"
              />
              <dd className="font-mono text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  )
}

export function Insights() {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        setData(await getInsights())
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar insights.',
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-2xl tracking-tight">Insights</h1>
          {data && data.sufficient_data && (
            <span className="font-serif text-sm text-ink-muted">
              Análise dos últimos {data.months_analyzed} meses completos
            </span>
          )}
        </div>

        {error && (
          <p className="border border-negative/50 bg-negative/10 px-4 py-2 text-sm text-negative">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-ink-muted">Carregando...</p>
        ) : data && !data.sufficient_data ? (
          <div className="flex flex-col items-start gap-4 border border-hairline bg-card p-8">
            <h2 className="font-serif text-sm tracking-wide text-ink-muted uppercase">
              Ainda não há histórico suficiente
            </h2>
            <p className="text-ink-muted">
              Os insights aparecem a partir de 3 meses completos de
              lançamentos — hoje você tem {data.months_with_data}{' '}
              {data.months_with_data === 1 ? 'mês' : 'meses'}. Continue
              registrando suas transações que a análise começa a valer a pena.
            </p>
            <Link
              to="/transacoes"
              className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90"
            >
              Registrar transações
            </Link>
          </div>
        ) : data && data.insights.length === 0 ? (
          <p className="text-ink-muted">
            Nenhum padrão de atenção detectado no período — seus gastos estão
            estáveis em relação à sua renda.
          </p>
        ) : data ? (
          <ul className="flex flex-col gap-4">
            {data.insights.map((insight, i) => (
              <InsightCard key={`${insight.type}-${i}`} insight={insight} />
            ))}
          </ul>
        ) : null}
      </div>
    </AppLayout>
  )
}
