"""Série mensal de receitas/despesas e helpers de variação.

Base numérica do motor de insights. Mesmo padrão do dashboard_service:
sem FastAPI, aritmética só em Decimal, funções de cálculo puras.

A janela considera apenas meses COMPLETOS — o mês corrente (parcial)
fica de fora para não distorcer a tendência.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from supabase import Client

TWO_PLACES = Decimal("0.01")


@dataclass
class TrendData:
    labels: list[str]  # "YYYY-MM", do mais antigo ao mais recente
    total_income: list[Decimal]
    total_expense: list[Decimal]
    expense_by_category: dict[str, list[Decimal]]
    goal_amounts: list[Decimal | None]
    months_with_data: int


def previous_complete_month(reference: date) -> tuple[int, int]:
    if reference.month == 1:
        return reference.year - 1, 12
    return reference.year, reference.month - 1


def _month_sequence(last: tuple[int, int], count: int) -> list[tuple[int, int]]:
    year, month = last
    seq = []
    for _ in range(count):
        seq.append((year, month))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(seq))


def build_trend_data(
    db: Client,
    user_id: str,
    months: int = 6,
    last_month: tuple[int, int] | None = None,
) -> TrendData:
    last = last_month or previous_complete_month(date.today())
    seq = _month_sequence(last, months)

    period_start = date(seq[0][0], seq[0][1], 1)
    end_year, end_month = seq[-1]
    period_end = (
        date(end_year + 1, 1, 1) if end_month == 12 else date(end_year, end_month + 1, 1)
    )

    transactions = (
        db.table("transactions")
        .select("amount, type, category_id, transaction_date")
        .eq("user_id", user_id)
        .gte("transaction_date", period_start.isoformat())
        .lt("transaction_date", period_end.isoformat())
        .execute()
    ).data
    categories = (
        db.table("categories").select("id, name").eq("user_id", user_id).execute()
    ).data
    goals = (
        db.table("monthly_goals")
        .select("month, year, target_investment_amount")
        .eq("user_id", user_id)
        .execute()
    ).data

    category_names = {c["id"]: c["name"] for c in categories}
    labels = [f"{year:04d}-{month:02d}" for year, month in seq]
    index = {label: i for i, label in enumerate(labels)}
    n = len(seq)

    total_income = [Decimal("0")] * n
    total_expense = [Decimal("0")] * n
    expense_by_category: dict[str, list[Decimal]] = {}

    for t in transactions:
        i = index.get(t["transaction_date"][:7])
        if i is None:
            continue
        amount = Decimal(str(t["amount"]))
        if t["type"] == "income":
            total_income[i] += amount
        else:
            total_expense[i] += amount
            name = category_names.get(t["category_id"], "Sem categoria")
            series = expense_by_category.setdefault(name, [Decimal("0")] * n)
            series[i] += amount

    goal_amounts: list[Decimal | None] = [None] * n
    for g in goals:
        i = index.get(f"{g['year']:04d}-{g['month']:02d}")
        if i is not None:
            goal_amounts[i] = Decimal(str(g["target_investment_amount"])).quantize(
                TWO_PLACES
            )

    total_income = [v.quantize(TWO_PLACES) for v in total_income]
    total_expense = [v.quantize(TWO_PLACES) for v in total_expense]
    expense_by_category = {
        name: [v.quantize(TWO_PLACES) for v in series]
        for name, series in expense_by_category.items()
    }
    months_with_data = sum(
        1 for i in range(n) if total_income[i] > 0 or total_expense[i] > 0
    )

    return TrendData(
        labels=labels,
        total_income=total_income,
        total_expense=total_expense,
        expense_by_category=expense_by_category,
        goal_amounts=goal_amounts,
        months_with_data=months_with_data,
    )


# ---------- helpers puros de variação ----------


def pct_change(old: Decimal, new: Decimal) -> Decimal | None:
    """Variação percentual; None quando não há base de comparação (old <= 0)."""
    if old <= 0:
        return None
    return ((new - old) / old * Decimal("100")).quantize(Decimal("0.1"))


def month_over_month_deltas(series: list[Decimal]) -> list[Decimal]:
    return [series[i] - series[i - 1] for i in range(1, len(series))]


def baseline_average(series: list[Decimal], k: int = 3) -> Decimal:
    """Média dos primeiros k meses — base menos ruidosa que mês-contra-mês."""
    k = min(k, len(series))
    return (sum(series[:k], Decimal("0")) / Decimal(k)).quantize(TWO_PLACES)
