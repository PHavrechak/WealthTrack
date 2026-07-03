"""Popula um usuário de teste com meses de histórico simulando inflação de estilo de vida.

Uso (a partir de backend/, com o venv ativado):
    python scripts/seed_demo_data.py <user_id>
    python scripts/seed_demo_data.py <user_id> --reset   # apaga transações e metas do usuário antes

Padrão simulado (mês 0 = mais antigo):
- Salário: +1% ao mês (reajuste gradual)
- Aluguel/Contas: estáveis
- Delivery: +20% ao mês (a categoria que o motor de tendência deve detectar)
- Mercado: +6% ao mês / Lazer: +8% ao mês (crescimento moderado, acima da renda)
- Meta de investimento: fixa (R$600) todos os meses
"""

import argparse
import os
import random
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

CATEGORIES = [
    ("Salário", "income"),
    ("Aluguel", "expense"),
    ("Contas", "expense"),
    ("Mercado", "expense"),
    ("Delivery", "expense"),
    ("Lazer", "expense"),
]

GOAL_AMOUNT = "600.00"


def month_sequence(count: int, reference: date) -> list[tuple[int, int]]:
    """(ano, mês) do mais antigo ao mais recente, terminando no mês de referência."""
    year, month = reference.year, reference.month
    seq = []
    for _ in range(count):
        seq.append((year, month))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(seq))


def jitter(base: float, spread: float = 0.05) -> str:
    return f"{base * random.uniform(1 - spread, 1 + spread):.2f}"


def random_day(year: int, month: int, today: date) -> int:
    last_day = 28
    if (year, month) == (today.year, today.month):
        last_day = min(today.day, 28)
    return random.randint(1, last_day)


def tx(user_id, category_id, amount, tx_type, description, year, month, today):
    return {
        "user_id": user_id,
        "category_id": category_id,
        "amount": amount,
        "type": tx_type,
        "description": description,
        "transaction_date": date(year, month, random_day(year, month, today)).isoformat(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("user_id", help="UUID do usuário (auth.users.id)")
    parser.add_argument("--months", type=int, default=9, help="meses de histórico (default: 9)")
    parser.add_argument("--reset", action="store_true", help="apaga transações e metas do usuário antes de popular")
    parser.add_argument("--seed", type=int, default=None, help="seed do random, para dados reprodutíveis")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    url = os.environ.get("SUPABASE_URL")
    secret = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not secret:
        sys.exit("SUPABASE_URL/SUPABASE_SECRET_KEY ausentes no backend/.env")

    db = create_client(url, secret)
    today = date.today()

    if args.reset:
        db.table("transactions").delete().eq("user_id", args.user_id).execute()
        db.table("monthly_goals").delete().eq("user_id", args.user_id).execute()
        print("Transações e metas anteriores do usuário removidas (--reset).")

    # garante as categorias, reaproveitando as que já existirem (por nome+tipo)
    existing = db.table("categories").select("id, name, type").eq("user_id", args.user_id).execute().data
    by_key = {(c["name"], c["type"]): c["id"] for c in existing}
    cat_ids: dict[str, str] = {}
    for name, ctype in CATEGORIES:
        if (name, ctype) in by_key:
            cat_ids[name] = by_key[(name, ctype)]
        else:
            created = (
                db.table("categories")
                .insert({"user_id": args.user_id, "name": name, "type": ctype})
                .execute()
            )
            cat_ids[name] = created.data[0]["id"]

    months = month_sequence(args.months, today)
    rows: list[dict] = []
    goals: list[dict] = []

    for i, (year, month) in enumerate(months):
        rows.append(tx(args.user_id, cat_ids["Salário"], jitter(5600 * 1.01**i, 0.01), "income", "Salário", year, month, today))
        rows.append(tx(args.user_id, cat_ids["Aluguel"], jitter(1600, 0.005), "expense", "Aluguel", year, month, today))
        rows.append(tx(args.user_id, cat_ids["Contas"], jitter(500, 0.06), "expense", "Contas do mês", year, month, today))

        mercado_total = 900 * 1.06**i
        for part in range(3):
            rows.append(tx(args.user_id, cat_ids["Mercado"], jitter(mercado_total / 3), "expense", "Mercado", year, month, today))

        delivery_total = 250 * 1.20**i
        delivery_count = 4 + i // 2
        for part in range(delivery_count):
            rows.append(tx(args.user_id, cat_ids["Delivery"], jitter(delivery_total / delivery_count), "expense", "Delivery", year, month, today))

        lazer_total = 350 * 1.08**i
        for part in range(2):
            rows.append(tx(args.user_id, cat_ids["Lazer"], jitter(lazer_total / 2), "expense", "Lazer", year, month, today))

        goals.append({"user_id": args.user_id, "month": month, "year": year, "target_investment_amount": GOAL_AMOUNT})

    db.table("transactions").insert(rows).execute()
    db.table("monthly_goals").upsert(goals, on_conflict="user_id,month,year").execute()

    print(f"\n{len(rows)} transações e {len(goals)} metas criadas para o usuário {args.user_id}.")
    print(f"Categorias usadas: {', '.join(cat_ids)}\n")
    print(f"{'Mês':<9}{'Qtd':>5}{'Receita':>12}{'Despesa':>12}")
    for year, month in months:
        label = f"{year:04d}-{month:02d}"
        month_rows = [r for r in rows if r["transaction_date"].startswith(label)]
        income = sum(Decimal(r["amount"]) for r in month_rows if r["type"] == "income")
        expense = sum(Decimal(r["amount"]) for r in month_rows if r["type"] == "expense")
        print(f"{label:<9}{len(month_rows):>5}{income:>12.2f}{expense:>12.2f}")


if __name__ == "__main__":
    main()
