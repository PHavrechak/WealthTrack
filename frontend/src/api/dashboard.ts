import { apiClient } from '../lib/apiClient'
import type { AvailableToSpend } from '../types'

export function getAvailableToSpend(month: number, year: number) {
  return apiClient.get<AvailableToSpend>(
    `/dashboard/available-to-spend?month=${month}&year=${year}`,
  )
}
