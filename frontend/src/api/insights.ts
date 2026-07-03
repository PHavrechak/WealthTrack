import { apiClient } from '../lib/apiClient'
import type { InsightsResponse } from '../types'

export function getInsights(months = 6) {
  return apiClient.get<InsightsResponse>(`/insights?months=${months}`)
}
