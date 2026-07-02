import { apiClient } from '../lib/apiClient'
import type { Category, CategoryType } from '../types'

export function listCategories() {
  return apiClient.get<Category[]>('/categories')
}

export function createCategory(payload: { name: string; type: CategoryType }) {
  return apiClient.post<Category>('/categories', payload)
}

export function deleteCategory(id: string) {
  return apiClient.delete<void>(`/categories/${id}`)
}
