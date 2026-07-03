import { apiClient } from '../lib/apiClient'
import type { CategoryType, Transaction } from '../types'

export function listTransactions(month: number, year: number) {
  return apiClient.get<Transaction[]>(`/transactions?month=${month}&year=${year}`)
}

/** Meses "YYYY-MM" com pelo menos uma transação, mais recente primeiro. */
export function listTransactionMonths() {
  return apiClient.get<string[]>('/transactions/months')
}

export interface CreateTransactionPayload {
  category_id: string | null
  amount: string
  type: CategoryType
  description: string | null
  transaction_date: string
}

export function createTransaction(payload: CreateTransactionPayload) {
  return apiClient.post<Transaction>('/transactions', payload)
}

export function deleteTransaction(id: string) {
  return apiClient.delete<void>(`/transactions/${id}`)
}
