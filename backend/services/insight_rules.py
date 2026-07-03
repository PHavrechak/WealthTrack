"""Regras determinísticas de insight sobre os dados do trend_service.

Nenhuma IA generativa aqui: cada insight nasce de comparação percentual,
limiar ou tendência. Critério de aceite: o insight precisa ajudar a decidir
algo, não só informar um número. Toda regra exige >= 3 meses com dados.

Cada insight carrega os números que o sustentam (details), para o frontend
mostrar o "porquê" sem depender de gráfico.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING

from services.trend_service import (
    TrendData,
    baseline_average,
    month_over_month_deltas,
    pct_change,
)

MIN_MONTHS_WITH_DATA = 3

# Regra 2 — categoria em aceleração: exigir os DOIS limiares (R$ e %)
# reduz falso positivo em categorias pequenas (30% de R$40 é ruído)
# e em categorias grandes (R$150 sobre aluguel de R$5000 é ruído).
CATEGORY_MIN_GROWTH_ABS = Decimal("150")
CATEGORY_MIN_GROWTH_PCT = Decimal("30")
CATEGORY_MIN_RISING_MONTHS = 3

# Regra 4 — projeção só é útil num horizonte em que dá pra agir.
PROJECTION_HORIZON_MONTHS = 12


@dataclass
class InsightDetail:
    label: str
    value: str


@dataclass
class Insight:
    type: str
    severity: str  # info | attention | alert
    message: str
    details: list[InsightDetail]


def fmt_brl(value: Decimal) -> str:
    quantized = value.quantize(Decimal("0.01"))
    text = f"{quantized:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")
    return f"R$ {text}"


def fmt_pct(value: Decimal) -> str:
    return f"{value:+.1f}%".replace(".", ",")


def generate_insights(trend: TrendData) -> list[Insight]:
    if trend.months_with_data < MIN_MONTHS_WITH_DATA:
        return []

    insights: list[Insight] = []
    insights.extend(_rule_income_vs_expense(trend))
    insights.extend(_rule_category_acceleration(trend))
    insights.extend(_rule_goal_kept_but_spending_rising(trend))
    insights.extend(_rule_expense_projection(trend))

    severity_rank = {"alert": 0, "attention": 1, "info": 2}
    insights.sort(key=lambda i: severity_rank[i.severity])
    return insights


# ---------- Regra 1: renda vs despesa ----------


def _rule_income_vs_expense(trend: TrendData) -> list[Insight]:
    income_base = baseline_average(trend.total_income)
    expense_base = baseline_average(trend.total_expense)
    income_recent = trend.total_income[-1]
    expense_recent = trend.total_expense[-1]

    income_growth = pct_change(income_base, income_recent)
    expense_growth = pct_change(expense_base, expense_recent)
    if income_growth is None or expense_growth is None:
        return []
    if expense_growth <= income_growth:
        return []

    gap = expense_growth - income_growth
    severity = "alert" if gap >= 25 else "attention" if gap >= 10 else "info"

    return [
        Insight(
            type="income_vs_expense",
            severity=severity,
            message=(
                f"Sua renda aumentou {fmt_pct(income_growth)}, mas suas despesas "
                f"aumentaram {fmt_pct(expense_growth)} no mesmo período."
            ),
            details=[
                InsightDetail("Receita média no início do período", fmt_brl(income_base)),
                InsightDetail("Receita no mês mais recente", fmt_brl(income_recent)),
                InsightDetail("Crescimento da receita", fmt_pct(income_growth)),
                InsightDetail("Despesa média no início do período", fmt_brl(expense_base)),
                InsightDetail("Despesa no mês mais recente", fmt_brl(expense_recent)),
                InsightDetail("Crescimento das despesas", fmt_pct(expense_growth)),
            ],
        )
    ]


# ---------- Regra 2: categoria em aceleração ----------


def _rule_category_acceleration(trend: TrendData) -> list[Insight]:
    insights: list[Insight] = []
    period = len(trend.labels)

    for name, series in trend.expense_by_category.items():
        deltas = month_over_month_deltas(series)
        rising_months = sum(1 for d in deltas if d > 0)
        if rising_months < CATEGORY_MIN_RISING_MONTHS:
            continue

        base = baseline_average(series)
        recent = series[-1]
        growth_abs = recent - base
        growth_pct = pct_change(base, recent)
        if growth_pct is None:
            continue
        if growth_abs < CATEGORY_MIN_GROWTH_ABS or growth_pct < CATEGORY_MIN_GROWTH_PCT:
            continue

        severity = "alert" if growth_pct >= 80 else "attention"
        insights.append(
            Insight(
                type="category_acceleration",
                severity=severity,
                message=(
                    f"Seu gasto com {name} cresceu {fmt_brl(growth_abs)} "
                    f"({fmt_pct(growth_pct)}) nos últimos {period} meses."
                ),
                details=[
                    InsightDetail("Gasto médio no início do período", fmt_brl(base)),
                    InsightDetail("Gasto no mês mais recente", fmt_brl(recent)),
                    InsightDetail("Crescimento no período", f"{fmt_brl(growth_abs)} ({fmt_pct(growth_pct)})"),
                    InsightDetail(
                        "Meses em alta",
                        f"{rising_months} de {len(deltas)} comparações mês a mês",
                    ),
                ],
            )
        )
    return insights


# ---------- Regra 3: meta mantida apesar de consumo crescente ----------


def _rule_goal_kept_but_spending_rising(trend: TrendData) -> list[Insight]:
    n = len(trend.labels)
    months_kept = 0
    for i in range(n):
        goal = trend.goal_amounts[i]
        if goal is None:
            return []  # meta não definida em algum mês: regra não se aplica
        if trend.total_income[i] - trend.total_expense[i] - goal < 0:
            return []  # meta furada em algum mês: outras regras cobrem esse caso
        months_kept += 1

    expense_base = baseline_average(trend.total_expense)
    expense_recent = trend.total_expense[-1]
    expense_growth = pct_change(expense_base, expense_recent)
    deltas = month_over_month_deltas(trend.total_expense)
    rising_months = sum(1 for d in deltas if d > 0)

    if expense_growth is None or expense_growth < 10 or rising_months < 3:
        return []

    return [
        Insight(
            type="goal_kept_spending_rising",
            severity="attention",
            message=(
                "Você está mantendo sua meta de investimento todos os meses, "
                "mas seu padrão de consumo está aumentando constantemente — "
                "a folga para cumprir a meta está encolhendo."
            ),
            details=[
                InsightDetail("Meses com meta cumprida", f"{months_kept} de {n}"),
                InsightDetail("Despesa média no início do período", fmt_brl(expense_base)),
                InsightDetail("Despesa no mês mais recente", fmt_brl(expense_recent)),
                InsightDetail("Crescimento das despesas", fmt_pct(expense_growth)),
                InsightDetail(
                    "Meses em alta",
                    f"{rising_months} de {len(deltas)} comparações mês a mês",
                ),
            ],
        )
    ]


# ---------- Regra 4: projeção simples de risco ----------


def _rule_expense_projection(trend: TrendData) -> list[Insight]:
    n = len(trend.labels)
    if n < 2:
        return []

    # projeção linear simples: ritmo médio mensal = (último - primeiro) / (n-1)
    expense_slope = (trend.total_expense[-1] - trend.total_expense[0]) / Decimal(n - 1)
    income_slope = (trend.total_income[-1] - trend.total_income[0]) / Decimal(n - 1)
    closing_rate = expense_slope - income_slope
    current_gap = trend.total_income[-1] - trend.total_expense[-1]

    if closing_rate <= 0 or current_gap <= 0:
        return []

    months_until = int(
        (current_gap / closing_rate).to_integral_value(rounding=ROUND_CEILING)
    )
    if months_until > PROJECTION_HORIZON_MONTHS:
        return []

    severity = "alert" if months_until <= 6 else "attention"
    return [
        Insight(
            type="expense_projection",
            severity=severity,
            message=(
                f"Projeção (estimativa, não fato): mantendo o ritmo dos últimos "
                f"{n} meses, suas despesas alcançariam sua renda em cerca de "
                f"{months_until} {'mês' if months_until == 1 else 'meses'}, "
                "zerando sua capacidade de investimento."
            ),
            details=[
                InsightDetail("Folga atual (receita − despesa)", fmt_brl(current_gap)),
                InsightDetail("Crescimento médio mensal da despesa", fmt_brl(expense_slope)),
                InsightDetail("Crescimento médio mensal da receita", fmt_brl(income_slope)),
                InsightDetail("Ritmo de fechamento da folga", f"{fmt_brl(closing_rate)}/mês"),
                InsightDetail("Meses até despesas alcançarem a renda", str(months_until)),
                InsightDetail("Natureza", "Projeção linear simples — não é um fato"),
            ],
        )
    ]
