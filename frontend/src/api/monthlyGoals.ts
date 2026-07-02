import { apiClient, ApiError } from '../lib/apiClient'
import type { MonthlyGoal } from '../types'

export async function getMonthlyGoal(
  month: number,
  year: number,
): Promise<MonthlyGoal | null> {
  try {
    return await apiClient.get<MonthlyGoal>(
      `/monthly-goals?month=${month}&year=${year}`,
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null
    }
    throw err
  }
}

export function upsertMonthlyGoal(payload: {
  month: number
  year: number
  target_investment_amount: string
}) {
  return apiClient.put<MonthlyGoal>('/monthly-goals', payload)
}
