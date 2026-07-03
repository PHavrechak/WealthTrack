import { apiClient } from '../lib/apiClient'
import type {
  ColumnMapping,
  ImportConfirmResponse,
  ImportPreviewResponse,
  ImportTransactionItem,
} from '../types'

export function previewImport(file: File, mapping?: Partial<ColumnMapping>) {
  const form = new FormData()
  form.append('file', file)
  if (mapping?.date_column) form.append('date_column', mapping.date_column)
  if (mapping?.description_column)
    form.append('description_column', mapping.description_column)
  if (mapping?.amount_column) form.append('amount_column', mapping.amount_column)
  if (mapping?.type_column) form.append('type_column', mapping.type_column)
  return apiClient.postForm<ImportPreviewResponse>(
    '/transactions/import/preview',
    form,
  )
}

export function confirmImport(
  transactions: ImportTransactionItem[],
  skippedCount: number,
) {
  return apiClient.post<ImportConfirmResponse>('/transactions/import/confirm', {
    transactions,
    skipped_count: skippedCount,
  })
}
