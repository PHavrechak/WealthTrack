import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { AppLayout } from '../components/AppLayout'
import { listCategories } from '../api/categories'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
} from '../api/transactions'
import type { Category, CategoryType, Transaction } from '../types'

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

function formatMonthInputValue(month: number, year: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

const inputClass =
  'border border-hairline bg-paper px-3 py-2 text-ink outline-none focus:border-brass'

export function Transactions() {
  const [{ month, year }, setPeriod] = useState(currentPeriod)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [type, setType] = useState<CategoryType>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState(todayIsoDate)
  const [submitting, setSubmitting] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach((category) => map.set(category.id, category))
    return map
  }, [categories])

  const formCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  )

  const load = async (targetMonth: number, targetYear: number) => {
    setLoading(true)
    setError(null)
    try {
      const [tx, cats] = await Promise.all([
        listTransactions(targetMonth, targetYear),
        listCategories(),
      ])
      setTransactions(tx)
      setCategories(cats)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar transações.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(month, year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year])

  const handlePeriodChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [newYear, newMonth] = event.target.value.split('-').map(Number)
    if (newYear && newMonth) {
      setPeriod({ month: newMonth, year: newYear })
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createTransaction({
        category_id: categoryId || null,
        amount,
        type,
        description: description || null,
        transaction_date: transactionDate,
      })
      setAmount('')
      setDescription('')
      setCategoryId('')
      await load(month, year)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar transação.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm('Excluir esta transação?')) {
      return
    }
    setError(null)
    setDeletingId(transaction.id)
    try {
      await deleteTransaction(transaction.id)
      setTransactions((prev) => prev.filter((t) => t.id !== transaction.id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao excluir transação.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-serif text-2xl tracking-tight">Transações</h1>
          <div className="flex items-center gap-2">
            <label htmlFor="period" className="text-sm text-ink-muted">
              Período
            </label>
            <input
              id="period"
              type="month"
              value={formatMonthInputValue(month, year)}
              onChange={handlePeriodChange}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>

        {error && (
          <p className="border border-negative/50 bg-negative/10 px-4 py-2 text-sm text-negative">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 border border-hairline bg-card p-5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tx-type" className="text-sm text-ink-muted">
              Tipo
            </label>
            <select
              id="tx-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value as CategoryType)
                setCategoryId('')
              }}
              className={inputClass}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tx-category" className="text-sm text-ink-muted">
              Categoria
            </label>
            <select
              id="tx-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className={inputClass}
            >
              <option value="">Sem categoria</option>
              {formCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tx-amount" className="text-sm text-ink-muted">
              Valor
            </label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={`${inputClass} w-28 font-mono`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tx-date" className="text-sm text-ink-muted">
              Data
            </label>
            <input
              id="tx-date"
              type="date"
              required
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
            <label htmlFor="tx-description" className="text-sm text-ink-muted">
              Descrição (opcional)
            </label>
            <input
              id="tx-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>

        {loading ? (
          <p className="text-ink-muted">Carregando...</p>
        ) : transactions.length === 0 ? (
          <p className="text-ink-muted">
            Nenhum lançamento neste período. Registre o primeiro no formulário
            acima.
          </p>
        ) : (
          <ul className="border border-hairline bg-card">
            {transactions.map((transaction, position) => {
              const category = transaction.category_id
                ? categoriesById.get(transaction.category_id)
                : undefined
              const isIncome = transaction.type === 'income'
              return (
                <li
                  key={transaction.id}
                  className="flex items-baseline gap-3 border-b border-hairline px-5 py-3 last:border-b-0"
                >
                  <span className="font-mono text-xs text-ink-muted">
                    {String(position + 1).padStart(2, '0')}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-ink">
                      {transaction.description ||
                        category?.name ||
                        'Sem descrição'}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      {new Date(
                        `${transaction.transaction_date}T00:00:00`,
                      ).toLocaleDateString('pt-BR')}
                      {category ? ` · ${category.name}` : ''}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="mb-1 flex-1 self-end border-b border-dotted border-hairline"
                  />
                  <span
                    className={`font-mono ${
                      isIncome ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {isIncome ? '+' : '−'}
                    {formatCurrency(transaction.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(transaction)}
                    disabled={deletingId === transaction.id}
                    className="text-sm text-ink-muted transition hover:text-negative disabled:opacity-50"
                  >
                    {deletingId === transaction.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
