import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { listCategories } from '../api/categories'
import { confirmImport, previewImport } from '../api/imports'
import type {
  Category,
  CategoryType,
  ColumnMapping,
  ImportConfirmResponse,
  ImportPreviewResponse,
} from '../types'

const MAX_FILE_BYTES = 5 * 1024 * 1024

const inputClass =
  'border border-hairline bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-brass'

interface EditableRow {
  key: number
  date: string
  description: string
  amount: string
  type: CategoryType
  categoryId: string
  skip: boolean
  selected: boolean
  isDuplicate: boolean
  parseError: string | null
}

function rowsFromPreview(preview: ImportPreviewResponse): EditableRow[] {
  return preview.rows.map((row) => ({
    key: row.row_number,
    date: row.transaction_date ?? '',
    description: row.description,
    amount: row.amount ?? '',
    type: row.type ?? 'expense',
    categoryId: '',
    // duplicatas e linhas com erro começam marcadas para pular
    skip: row.is_duplicate || row.parse_error !== null,
    selected: false,
    isDuplicate: row.is_duplicate,
    parseError: row.parse_error,
  }))
}

function isRowValid(row: EditableRow): boolean {
  return row.date !== '' && Number(row.amount) > 0
}

export function ImportCsv() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [bulkCategoryId, setBulkCategoryId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportConfirmResponse | null>(null)

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const toImport = useMemo(
    () => rows.filter((row) => !row.skip && isRowValid(row)),
    [rows],
  )
  const skipped = useMemo(() => rows.filter((row) => row.skip), [rows])
  const invalidCount = rows.length - toImport.length - skipped.length
  const selectedCount = rows.filter((row) => row.selected).length

  const runPreview = async (targetFile: File, overrides?: Partial<ColumnMapping>) => {
    setError(null)
    setLoading(true)
    try {
      const data = await previewImport(targetFile, overrides)
      setPreview(data)
      setMapping(data.suggested_mapping)
      setRows(rowsFromPreview(data))
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ler o arquivo.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selected = event.target.files?.[0] ?? null
    if (!selected) {
      return
    }
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Selecione um arquivo .csv.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError('Arquivo maior que o limite de 5MB.')
      return
    }
    setFile(selected)
    runPreview(selected)
  }

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    if (!file || !mapping) {
      return
    }
    const next = { ...mapping, [field]: value || null }
    setMapping(next)
    runPreview(file, next)
  }

  const updateRow = (key: number, patch: Partial<EditableRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const applyBulkCategory = () => {
    if (!bulkCategoryId) {
      return
    }
    const category = categories.find((c) => c.id === bulkCategoryId)
    if (!category) {
      return
    }
    // aplica só às selecionadas cujo tipo bate com o da categoria
    setRows((prev) =>
      prev.map((row) =>
        row.selected && row.type === category.type
          ? { ...row, categoryId: bulkCategoryId, selected: false }
          : row,
      ),
    )
    setBulkCategoryId('')
  }

  const toggleSelectAll = (checked: boolean) => {
    setRows((prev) => prev.map((row) => ({ ...row, selected: checked })))
  }

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    try {
      const response = await confirmImport(
        toImport.map((row) => ({
          transaction_date: row.date,
          description: row.description || null,
          amount: row.amount,
          type: row.type,
          category_id: row.categoryId || null,
        })),
        skipped.length,
      )
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar.')
    } finally {
      setLoading(false)
    }
  }

  const stepLabel = (n: number, label: string) => (
    <span
      className={`font-serif text-sm ${step === n ? 'text-brass' : 'text-ink-muted'}`}
    >
      {n}. {label}
    </span>
  )

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-serif text-2xl tracking-tight">Importar extrato CSV</h1>
          <div className="flex items-center gap-4">
            {stepLabel(1, 'Arquivo')}
            {stepLabel(2, 'Revisão')}
            {stepLabel(3, 'Confirmação')}
          </div>
        </div>

        {error && (
          <p className="border border-negative/50 bg-negative/10 px-4 py-2 text-sm text-negative">
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="flex flex-col items-start gap-4 border border-hairline bg-card p-8">
            <h2 className="font-serif text-sm tracking-wide text-ink-muted uppercase">
              Selecione o arquivo
            </h2>
            <p className="text-sm text-ink-muted">
              Arquivo .csv exportado do seu banco, com até 5MB e 1000 linhas.
              Delimitador (vírgula ou ponto-e-vírgula), formato de valor e de
              data são detectados automaticamente.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-sm text-ink-muted file:mr-4 file:cursor-pointer file:border file:border-hairline file:bg-paper file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
            />
            {loading && <p className="text-sm text-ink-muted">Lendo arquivo...</p>}
            <Link
              to="/transacoes"
              className="text-sm text-ink-muted transition hover:text-ink"
            >
              ← Voltar para transações
            </Link>
          </div>
        )}

        {step === 2 && preview && mapping && (
          <>
            <div className="border border-hairline bg-card p-5">
              <h2 className="mb-3 font-serif text-sm tracking-wide text-ink-muted uppercase">
                Mapeamento de colunas
              </h2>
              {!preview.mapping_confident && (
                <p className="mb-3 border border-brass/50 bg-brass/10 px-3 py-2 text-sm text-brass">
                  Não foi possível identificar todas as colunas automaticamente —
                  selecione abaixo qual coluna corresponde a cada campo.
                </p>
              )}
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    ['date_column', 'Data'],
                    ['description_column', 'Descrição'],
                    ['amount_column', 'Valor'],
                    ['type_column', 'Tipo (opcional)'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="flex flex-col gap-1">
                    <label className="text-xs text-ink-muted">{label}</label>
                    <select
                      value={mapping[field] ?? ''}
                      onChange={(event) =>
                        handleMappingChange(field, event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {preview.columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border border-hairline bg-card px-5 py-3">
                <span className="text-sm text-ink-muted">
                  {selectedCount} linha(s) selecionada(s)
                </span>
                <select
                  value={bulkCategoryId}
                  onChange={(event) => setBulkCategoryId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Categoria em lote...</option>
                  <optgroup label="Receitas">
                    {categories
                      .filter((c) => c.type === 'income')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Despesas">
                    {categories
                      .filter((c) => c.type === 'expense')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={applyBulkCategory}
                  disabled={!bulkCategoryId || selectedCount === 0}
                  className="border border-hairline px-3 py-1.5 text-sm text-ink-muted transition hover:border-ink-muted hover:text-ink disabled:opacity-50"
                >
                  Aplicar às selecionadas
                </button>
                <span className="text-xs text-ink-muted">
                  (aplica só às linhas do mesmo tipo da categoria)
                </span>
              </div>
            )}

            <div className="overflow-x-auto border border-hairline bg-card">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left">
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((r) => r.selected)}
                        onChange={(event) => toggleSelectAll(event.target.checked)}
                      />
                    </th>
                    <th className="px-3 py-2 font-mono text-xs text-ink-muted">#</th>
                    <th className="px-3 py-2 font-serif font-normal text-ink-muted">Data</th>
                    <th className="px-3 py-2 font-serif font-normal text-ink-muted">Descrição</th>
                    <th className="px-3 py-2 font-serif font-normal text-ink-muted">Valor</th>
                    <th className="px-3 py-2 font-serif font-normal text-ink-muted">Tipo</th>
                    <th className="px-3 py-2 font-serif font-normal text-ink-muted">Categoria</th>
                    <th className="px-3 py-2 font-serif font-normal text-ink-muted">Pular</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.key}
                      className={`border-b border-hairline last:border-b-0 ${
                        row.parseError
                          ? 'bg-negative/10'
                          : row.isDuplicate
                            ? 'bg-brass/10'
                            : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(event) =>
                            updateRow(row.key, { selected: event.target.checked })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                        {String(row.key).padStart(2, '0')}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) =>
                            updateRow(row.key, { date: event.target.value })
                          }
                          className={`${inputClass} font-mono`}
                        />
                      </td>
                      <td className="w-full px-3 py-2">
                        <input
                          value={row.description}
                          onChange={(event) =>
                            updateRow(row.key, { description: event.target.value })
                          }
                          className={`${inputClass} w-full`}
                        />
                        {row.isDuplicate && (
                          <span className="mt-1 block font-mono text-xs text-brass">
                            duplicata provável
                          </span>
                        )}
                        {row.parseError && (
                          <span className="mt-1 block font-mono text-xs text-negative">
                            {row.parseError}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={row.amount}
                          onChange={(event) =>
                            updateRow(row.key, { amount: event.target.value })
                          }
                          className={`${inputClass} w-24 font-mono`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.type}
                          onChange={(event) =>
                            updateRow(row.key, {
                              type: event.target.value as CategoryType,
                              categoryId: '',
                            })
                          }
                          className={inputClass}
                        >
                          <option value="income">Receita</option>
                          <option value="expense">Despesa</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.categoryId}
                          onChange={(event) =>
                            updateRow(row.key, { categoryId: event.target.value })
                          }
                          className={inputClass}
                        >
                          <option value="">Sem categoria</option>
                          {categories
                            .filter((c) => c.type === row.type)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.skip}
                          onChange={(event) =>
                            updateRow(row.key, { skip: event.target.checked })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-ink-muted">
                <span className="font-mono">{toImport.length}</span> a importar ·{' '}
                <span className="font-mono">{skipped.length}</span> puladas
                {invalidCount > 0 && (
                  <span className="text-negative">
                    {' '}
                    · {invalidCount} com data/valor inválido (corrija ou marque
                    "Pular")
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setPreview(null)
                    setFile(null)
                  }}
                  className="border border-hairline px-4 py-2 text-sm text-ink-muted transition hover:border-ink-muted hover:text-ink"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={loading || invalidCount > 0 || toImport.length === 0}
                  onClick={() => setStep(3)}
                  className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continuar
                </button>
              </div>
            </div>
          </>
        )}

        {step === 3 && !result && (
          <div className="flex flex-col items-start gap-4 border border-hairline bg-card p-8">
            <h2 className="font-serif text-sm tracking-wide text-ink-muted uppercase">
              Resumo da importação
            </h2>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-12">
                <dt className="text-ink-muted">Transações a criar</dt>
                <dd className="font-mono text-ink">{toImport.length}</dd>
              </div>
              <div className="flex justify-between gap-12">
                <dt className="text-ink-muted">Linhas puladas (duplicatas/descartadas)</dt>
                <dd className="font-mono text-ink">{skipped.length}</dd>
              </div>
            </dl>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="border border-hairline px-4 py-2 text-sm text-ink-muted transition hover:border-ink-muted hover:text-ink"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirm}
                className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Importando...' : 'Confirmar importação'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="flex flex-col items-start gap-4 border border-hairline bg-card p-8">
            <h2 className="font-serif text-sm tracking-wide text-ink-muted uppercase">
              Importação concluída
            </h2>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-12">
                <dt className="text-ink-muted">Criadas</dt>
                <dd className="font-mono text-positive">{result.created}</dd>
              </div>
              <div className="flex justify-between gap-12">
                <dt className="text-ink-muted">Puladas</dt>
                <dd className="font-mono text-ink">{result.skipped}</dd>
              </div>
              <div className="flex justify-between gap-12">
                <dt className="text-ink-muted">Erros</dt>
                <dd
                  className={`font-mono ${result.errors.length > 0 ? 'text-negative' : 'text-ink'}`}
                >
                  {result.errors.length}
                </dd>
              </div>
            </dl>
            {result.errors.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-negative">
                {result.errors.map((item) => (
                  <li key={item.index} className="font-mono text-xs">
                    linha {item.index + 1}: {item.message}
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/transacoes"
              className="bg-brass px-4 py-2 text-sm font-medium text-paper transition hover:bg-brass/90"
            >
              Ver transações
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
