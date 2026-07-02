import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { createCategory, deleteCategory, listCategories } from '../api/categories'
import { ApiError } from '../lib/apiClient'
import type { Category, CategoryType } from '../types'

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

  const handleDelete = async (category: Category) => {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) {
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
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>

        {error && (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
        >
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <label htmlFor="category-name" className="text-sm text-neutral-300">
              Nome
            </label>
            <input
              id="category-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-type" className="text-sm text-neutral-300">
              Tipo
            </label>
            <select
              id="category-type"
              value={type}
              onChange={(event) => setType(event.target.value as CategoryType)}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Adicionando...' : 'Adicionar categoria'}
          </button>
        </form>

        {loading ? (
          <p className="text-neutral-400">Carregando...</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <CategoryColumn
              title="Receitas"
              categories={incomeCategories}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
            <CategoryColumn
              title="Despesas"
              categories={expenseCategories}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function CategoryColumn({
  title,
  categories,
  onDelete,
  deletingId,
}: {
  title: string
  categories: Category[]
  onDelete: (category: Category) => void
  deletingId: string | null
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-400">
        {title}
      </h2>
      {categories.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma categoria cadastrada.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2"
            >
              <span className="text-neutral-100">{category.name}</span>
              <button
                type="button"
                onClick={() => onDelete(category)}
                disabled={deletingId === category.id}
                className="text-sm text-red-400 transition hover:text-red-300 disabled:opacity-50"
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
