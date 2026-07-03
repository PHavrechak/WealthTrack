from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

CategoryType = Literal["income", "expense"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1)
    type: CategoryType


class CategoryResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    type: CategoryType
    created_at: datetime


class TransactionCreate(BaseModel):
    category_id: UUID | None = None
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    type: CategoryType
    description: str | None = None
    transaction_date: date = Field(default_factory=date.today)


class TransactionResponse(BaseModel):
    id: UUID
    user_id: UUID
    category_id: UUID | None
    amount: Decimal
    type: CategoryType
    description: str | None
    transaction_date: date
    created_at: datetime


class MonthlyGoalUpsert(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    target_investment_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class MonthlyGoalResponse(BaseModel):
    id: UUID
    user_id: UUID
    month: int
    year: int
    target_investment_amount: Decimal
    created_at: datetime
    updated_at: datetime


class AvailableToSpendResponse(BaseModel):
    month: int
    year: int
    total_income: Decimal
    total_expenses: Decimal
    target_investment_amount: Decimal
    has_goal_defined: bool
    available_to_spend: Decimal


class InsightDetailResponse(BaseModel):
    label: str
    value: str


class InsightResponse(BaseModel):
    type: str
    severity: Literal["info", "attention", "alert"]
    message: str
    details: list[InsightDetailResponse]


class InsightsResponse(BaseModel):
    months_analyzed: int
    months_with_data: int
    sufficient_data: bool
    insights: list[InsightResponse]


class ColumnMappingResponse(BaseModel):
    date_column: str | None
    description_column: str | None
    amount_column: str | None
    type_column: str | None


class ImportPreviewRowResponse(BaseModel):
    row_number: int
    transaction_date: date | None
    description: str
    amount: Decimal | None
    type: CategoryType | None
    is_duplicate: bool
    parse_error: str | None


class ImportPreviewResponse(BaseModel):
    columns: list[str]
    suggested_mapping: ColumnMappingResponse
    mapping_confident: bool
    value_format: Literal["br", "intl"]
    date_format: Literal["dmy", "iso"]
    total_rows: int
    rows: list[ImportPreviewRowResponse]


class ImportTransactionItem(BaseModel):
    transaction_date: date
    description: str | None = None
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    type: CategoryType
    category_id: UUID | None = None


class ImportConfirmRequest(BaseModel):
    transactions: list[ImportTransactionItem] = Field(max_length=1000)
    skipped_count: int = Field(default=0, ge=0)


class ImportErrorItem(BaseModel):
    index: int
    message: str


class ImportConfirmResponse(BaseModel):
    created: int
    skipped: int
    errors: list[ImportErrorItem]
