import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { createCategory, deleteCategory, listCategories } from '../api/categories'
import { ApiError } from '../lib/apiClient'
import type { Category, CategoryType } from '../types'

const inputClass =
  'border border-hairline bg-paper px-3 py-2 text-ink outline-none focus:border-brass'

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('expense')
  const [submitting, setSubmitting] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      setCategories(await listCategories())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar categorias.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createCategory({ name, type })
      setName('')
      setType('expense')
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar categoria.')
    } finally {
      setSubmitting(false)
    }
  }

  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)

  const handleDelete = async () => {
    const category = pendingDelete
    setPendingDelete(null)
    if (!category) {
      return
    }
    setError(null)
    setDeletingId(category.id)
    try {
      await deleteCategory(category.id)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          'Não é possível excluir: existem transações usando essa categoria.',
        )
      } else {
        setError(
          err instanceof Error ? err.message : 'Erro ao excluir categoria.',
        )
      }
    } finally {
      setDeletingId(null)
    }
  }

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8">
        <h1 className="font-serif text-2xl tracking-tight">Categorias</h1>

        {error && (
          <p className="border border-negative/50 bg-negative/10 px-4 py-2 text-sm text-negative">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 border border-hairline bg-card p-5"
        >
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <label htmlFor="category-name" className="text-sm text-ink-muted">
              Nome
            </label>
            <input
              id="category-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-type" className="text-sm text-ink-muted">
              Tipo
            </label>
            <select
              id="category-type"
              value={type}
              onChange={(event) => setType(event.target.value as CategoryType)}
              className={inputClass}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Adicionando...' : 'Adicionar categoria'}
          </button>
        </form>

        {loading ? (
          <p className="text-ink-muted">Carregando...</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <CategoryColumn
              title="Receitas"
              accentClass="text-positive"
              categories={incomeCategories}
              onDelete={setPendingDelete}
              deletingId={deletingId}
            />
            <CategoryColumn
              title="Despesas"
              accentClass="text-negative"
              categories={expenseCategories}
              onDelete={setPendingDelete}
              deletingId={deletingId}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir categoria?"
        description={
          pendingDelete
            ? `A categoria "${pendingDelete.name}" será removida. Se houver transações vinculadas a ela, a exclusão será bloqueada.`
            : undefined
        }
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AppLayout>
  )
}

function CategoryColumn({
  title,
  accentClass,
  categories,
  onDelete,
  deletingId,
}: {
  title: string
  accentClass: string
  categories: Category[]
  onDelete: (category: Category) => void
  deletingId: string | null
}) {
  return (
    <div className="border border-hairline bg-card p-5">
      <h2
        className={`mb-4 font-serif text-sm tracking-wide uppercase ${accentClass}`}
      >
        {title}
      </h2>
      {categories.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma categoria cadastrada.</p>
      ) : (
        <ul className="flex flex-col">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0"
            >
              <span className="text-ink">{category.name}</span>
              <button
                type="button"
                onClick={() => onDelete(category)}
                disabled={deletingId === category.id}
                className="text-sm text-ink-muted transition hover:text-negative disabled:opacity-50"
              >
                {deletingId === category.id ? 'Excluindo...' : 'Excluir'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
