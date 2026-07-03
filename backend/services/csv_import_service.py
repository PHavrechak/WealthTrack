"""Importação de extrato CSV: parse com detecção de formato, duplicatas e lote.

Nada de categorização automática aqui (etapa seguinte). O parse não grava
nada — só lê, sugere mapeamento e devolve as linhas para revisão humana.
"""

import csv
import hashlib
import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from postgrest.exceptions import APIError
from supabase import Client

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 1000
TWO_PLACES = Decimal("0.01")

# nomes comuns de cabeçalho (comparados após normalizar acentos/caixa)
DATE_HINTS = ("data", "date")
DESCRIPTION_HINTS = ("descri", "histor", "memo", "lancamento", "detalhe", "description")
AMOUNT_HINTS = ("valor", "amount", "value", "montante", "quantia")
TYPE_HINTS = ("tipo", "type", "d/c", "c/d", "dc", "debito/credito")

BR_AMOUNT_RE = re.compile(r"^-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}$|^-?\s*(?:R\$\s*)?\d+,\d{2}$")
DMY_DATE_RE = re.compile(r"^\d{2}[/-]\d{2}[/-]\d{4}$")
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass
class ParsedRow:
    row_number: int  # 1-based, contando a partir da primeira linha de dados
    transaction_date: date | None
    description: str
    amount: Decimal | None
    type: str | None
    parse_error: str | None = None
    is_duplicate: bool = False


@dataclass
class ParsedPreview:
    columns: list[str]
    suggested_mapping: dict[str, str | None]
    mapping_confident: bool
    value_format: str  # 'br' | 'intl'
    date_format: str  # 'dmy' | 'iso'
    total_rows: int
    rows: list[ParsedRow] = field(default_factory=list)


class CsvImportError(Exception):
    """Erro de arquivo/limite que o router converte em HTTP 4xx."""


def _normalize(text: str) -> str:
    ascii_text = (
        unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    )
    return ascii_text.strip().lower()


def _decode(file_bytes: bytes) -> str:
    if len(file_bytes) > MAX_FILE_BYTES:
        raise CsvImportError("Arquivo maior que o limite de 5MB.")
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise CsvImportError("Não foi possível ler o arquivo como texto (encoding desconhecido).")


def _detect_delimiter(header_line: str) -> str:
    # bancos brasileiros costumam exportar com ponto-e-vírgula
    return ";" if header_line.count(";") >= max(header_line.count(","), 1) else ","


def _suggest_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    for column in columns:
        normalized = _normalize(column)
        if any(hint in normalized for hint in hints):
            return column
    return None


def _detect_value_format(samples: list[str], delimiter: str) -> str:
    for sample in samples:
        if BR_AMOUNT_RE.match(sample.strip()):
            return "br"
    if any("." in s for s in samples):
        return "intl"
    return "br" if delimiter == ";" else "intl"


def _detect_date_format(samples: list[str]) -> str:
    for sample in samples:
        if DMY_DATE_RE.match(sample.strip()):
            return "dmy"
        if ISO_DATE_RE.match(sample.strip()):
            return "iso"
    return "dmy"


def _parse_amount(raw: str, value_format: str) -> tuple[Decimal, bool]:
    """Retorna (valor absoluto, era_negativo)."""
    text = raw.strip().replace("R$", "").replace(" ", "")
    negative = text.startswith("-") or (text.startswith("(") and text.endswith(")"))
    text = text.strip("()+-")
    if value_format == "br":
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", "")
    value = Decimal(text).quantize(TWO_PLACES)
    return abs(value), negative


def _parse_date(raw: str, date_format: str) -> date:
    text = raw.strip()
    if date_format == "iso":
        return date.fromisoformat(text)
    return datetime.strptime(text.replace("-", "/"), "%d/%m/%Y").date()


def _infer_type(type_value: str | None, negative: bool) -> str:
    if type_value:
        normalized = _normalize(type_value)
        if normalized.startswith("c") or normalized in ("entrada", "receita"):
            return "income"
        if normalized.startswith("d") or normalized in ("saida", "despesa"):
            return "expense"
    return "expense" if negative else "income"


def parse_csv_preview(
    file_bytes: bytes,
    mapping_overrides: dict[str, str | None] | None = None,
) -> ParsedPreview:
    text = _decode(file_bytes)
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        raise CsvImportError("O arquivo precisa de um cabeçalho e ao menos uma linha de dados.")

    delimiter = _detect_delimiter(lines[0])
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    all_rows = [row for row in reader if any(cell.strip() for cell in row)]
    columns = [c.strip() for c in all_rows[0]]
    data_rows = all_rows[1:]
    if len(data_rows) > MAX_ROWS:
        raise CsvImportError(f"Arquivo com mais de {MAX_ROWS} linhas — divida em arquivos menores.")

    overrides = mapping_overrides or {}

    def resolve(key: str, hints: tuple[str, ...]) -> str | None:
        override = overrides.get(key)
        if override:
            if override not in columns:
                raise CsvImportError(f"Coluna '{override}' não existe no arquivo.")
            return override
        return _suggest_column(columns, hints)

    mapping = {
        "date_column": resolve("date_column", DATE_HINTS),
        "description_column": resolve("description_column", DESCRIPTION_HINTS),
        "amount_column": resolve("amount_column", AMOUNT_HINTS),
        "type_column": resolve("type_column", TYPE_HINTS),
    }
    confident = all(
        mapping[key] for key in ("date_column", "description_column", "amount_column")
    )

    index = {column: i for i, column in enumerate(columns)}

    def cell(row: list[str], column: str | None) -> str:
        if column is None:
            return ""
        i = index[column]
        return row[i].strip() if i < len(row) else ""

    amount_samples = [cell(r, mapping["amount_column"]) for r in data_rows[:20]]
    date_samples = [cell(r, mapping["date_column"]) for r in data_rows[:20]]
    value_format = _detect_value_format([s for s in amount_samples if s], delimiter)
    date_format = _detect_date_format([s for s in date_samples if s])

    rows: list[ParsedRow] = []
    if confident:
        for i, raw_row in enumerate(data_rows):
            row_number = i + 1
            description = cell(raw_row, mapping["description_column"])
            try:
                amount, negative = _parse_amount(cell(raw_row, mapping["amount_column"]), value_format)
                if amount == 0:
                    raise InvalidOperation
                parsed_date = _parse_date(cell(raw_row, mapping["date_column"]), date_format)
                tx_type = _infer_type(cell(raw_row, mapping["type_column"]) or None, negative)
                rows.append(
                    ParsedRow(row_number, parsed_date, description, amount, tx_type)
                )
            except (InvalidOperation, ValueError):
                rows.append(
                    ParsedRow(
                        row_number,
                        None,
                        description,
                        None,
                        None,
                        parse_error="Não foi possível interpretar data ou valor desta linha.",
                    )
                )

    return ParsedPreview(
        columns=columns,
        suggested_mapping=mapping,
        mapping_confident=confident,
        value_format=value_format,
        date_format=date_format,
        total_rows=len(data_rows),
        rows=rows,
    )


# ---------- duplicatas ----------


def _dedupe_hash(user_id: str, tx_date: str, amount: Decimal, description: str) -> str:
    normalized_desc = re.sub(r"\s+", " ", _normalize(description))
    payload = f"{user_id}|{tx_date}|{amount.quantize(TWO_PLACES)}|{normalized_desc}"
    return hashlib.md5(payload.encode()).hexdigest()


def detect_duplicates(db: Client, user_id: str, rows: list[ParsedRow]) -> None:
    """Marca is_duplicate em cada linha comparando com o que já existe no banco.

    Não bloqueia nada — a decisão de pular ou importar é do usuário.
    """
    valid = [r for r in rows if r.transaction_date and r.amount is not None]
    if not valid:
        return

    period_start = min(r.transaction_date for r in valid)
    period_end = max(r.transaction_date for r in valid)
    existing = (
        db.table("transactions")
        .select("transaction_date, amount, description")
        .eq("user_id", user_id)
        .gte("transaction_date", period_start.isoformat())
        .lte("transaction_date", period_end.isoformat())
        .execute()
    ).data

    existing_hashes = {
        _dedupe_hash(
            user_id,
            t["transaction_date"],
            Decimal(str(t["amount"])),
            t["description"] or "",
        )
        for t in existing
    }
    for row in valid:
        row_hash = _dedupe_hash(
            user_id, row.transaction_date.isoformat(), row.amount, row.description
        )
        row.is_duplicate = row_hash in existing_hashes


# ---------- criação em lote ----------


def bulk_create_transactions(
    db: Client, user_id: str, items: list
) -> tuple[int, list[tuple[int, str]]]:
    """Cria transações em lote. Retorna (criadas, [(índice, erro), ...]).

    Uma linha problemática não derruba a importação inteira: em caso de erro
    no lote, cai para inserção linha a linha e reporta cada falha.
    """
    owned_categories = {
        c["id"]
        for c in db.table("categories").select("id").eq("user_id", user_id).execute().data
    }

    rows: list[dict] = []
    row_indexes: list[int] = []
    errors: list[tuple[int, str]] = []

    for i, item in enumerate(items):
        if item.category_id is not None and str(item.category_id) not in owned_categories:
            errors.append((i, "category_id inválido para este usuário."))
            continue
        rows.append(
            {
                "user_id": user_id,
                "category_id": str(item.category_id) if item.category_id else None,
                "amount": str(item.amount),
                "type": item.type,
                "description": item.description or None,
                "transaction_date": item.transaction_date.isoformat(),
            }
        )
        row_indexes.append(i)

    created = 0
    if rows:
        try:
            db.table("transactions").insert(rows).execute()
            created = len(rows)
        except APIError:
            for original_index, row in zip(row_indexes, rows):
                try:
                    db.table("transactions").insert(row).execute()
                    created += 1
                except APIError as exc:
                    errors.append((original_index, exc.message or "erro ao inserir"))

    return created, errors
