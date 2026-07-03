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

export interface ColumnMapping {
  date_column: string | null
  description_column: string | null
  amount_column: string | null
  type_column: string | null
}

export interface ImportPreviewRow {
  row_number: number
  transaction_date: string | null
  description: string
  amount: string | null
  type: CategoryType | null
  is_duplicate: boolean
  parse_error: string | null
}

export interface ImportPreviewResponse {
  columns: string[]
  suggested_mapping: ColumnMapping
  mapping_confident: boolean
  value_format: 'br' | 'intl'
  date_format: 'dmy' | 'iso'
  total_rows: number
  rows: ImportPreviewRow[]
}

export interface ImportTransactionItem {
  transaction_date: string
  description: string | null
  amount: string
  type: CategoryType
  category_id: string | null
}

export interface ImportError {
  index: number
  message: string
}

export interface ImportConfirmResponse {
  created: number
  skipped: number
  errors: ImportError[]
}
