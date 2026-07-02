import { apiClient } from '../lib/apiClient'
import type { CategoryType, Transaction } from '../types'

export function listTransactions(month: number, year: number) {
  return apiClient.get<Transaction[]>(`/transactions?month=${month}&year=${year}`)
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
