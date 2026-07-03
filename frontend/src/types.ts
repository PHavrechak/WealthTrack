export type CategoryType = 'income' | 'expense'

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string | null
  amount: string
  type: CategoryType
  description: string | null
  transaction_date: string
  created_at: string
}

export interface MonthlyGoal {
  id: string
  user_id: string
  month: number
  year: number
  target_investment_amount: string
  created_at: string
  updated_at: string
}

export interface AvailableToSpend {
  month: number
  year: number
  total_income: string
  total_expenses: string
  target_investment_amount: string
  has_goal_defined: boolean
  available_to_spend: string
}

export type InsightSeverity = 'info' | 'attention' | 'alert'

export interface InsightDetail {
  label: string
  value: string
}

export interface Insight {
  type: string
  severity: InsightSeverity
  message: string
  details: InsightDetail[]
}

export interface InsightsResponse {
  months_analyzed: number
  months_with_data: number
  sufficient_data: boolean
  insights: Insight[]
}
