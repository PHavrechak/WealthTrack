"""Regras de negócio do dashboard.

Isolado dos routers de propósito: esta é a lógica central do produto e
precisa ser testável sem HTTP/FastAPI no meio.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from supabase import Client

TWO_PLACES = Decimal("0.01")


@dataclass
class AvailableToSpend:
    month: int
    year: int
    total_income: Decimal
    total_expenses: Decimal
    target_investment_amount: Decimal
    has_goal_defined: bool
    available_to_spend: Decimal


def _month_bounds(month: int, year: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def _sum_amounts(rows: list[dict]) -> Decimal:
    # Somar com Decimal (a partir da representação em string), nunca float:
    # o backend devolve NUMERIC(12,2) e centavos não podem sofrer arredondamento binário.
    total = sum((Decimal(str(row["amount"])) for row in rows), Decimal("0"))
    return total.quantize(TWO_PLACES)


def compute_available_to_spend(
    db: Client, user_id: str, month: int, year: int
) -> AvailableToSpend:
    """Disponível no mês = receitas do mês − despesas do mês − meta do mês.

    Considera apenas transações já lançadas (sem projeção). Meta ausente
    entra como 0 no cálculo, com has_goal_defined=False para o frontend
    poder alertar em vez de silenciar.
    """
    period_start, period_end = _month_bounds(month, year)

    transactions = (
        db.table("transactions")
        .select("amount, type")
        .eq("user_id", user_id)
        .gte("transaction_date", period_start.isoformat())
        .lt("transaction_date", period_end.isoformat())
        .execute()
    ).data

    total_income = _sum_amounts([t for t in transactions if t["type"] == "income"])
    total_expenses = _sum_amounts([t for t in transactions if t["type"] == "expense"])

    goal_rows = (
        db.table("monthly_goals")
        .select("target_investment_amount")
        .eq("user_id", user_id)
        .eq("month", month)
        .eq("year", year)
        .execute()
    ).data

    has_goal_defined = bool(goal_rows)
    target_investment_amount = (
        Decimal(str(goal_rows[0]["target_investment_amount"])).quantize(TWO_PLACES)
        if has_goal_defined
        else Decimal("0.00")
    )

    available = (total_income - total_expenses - target_investment_amount).quantize(
        TWO_PLACES
    )

    return AvailableToSpend(
        month=month,
        year=year,
        total_income=total_income,
        total_expenses=total_expenses,
        target_investment_amount=target_investment_amount,
        has_goal_defined=has_goal_defined,
        available_to_spend=available,
    )
