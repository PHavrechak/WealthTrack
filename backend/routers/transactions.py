from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from auth import get_current_user_id
from database import get_supabase
from schemas import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    if (month is None) != (year is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Informe 'month' e 'year' juntos para filtrar por período.",
        )

    query = db.table("transactions").select("*").eq("user_id", user_id)

    if month is not None and year is not None:
        period_start = date(year, month, 1)
        period_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        query = query.gte("transaction_date", period_start.isoformat()).lt(
            "transaction_date", period_end.isoformat()
        )

    result = query.order("transaction_date", desc=True).execute()
    return result.data


@router.post(
    "", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED
)
def create_transaction(
    payload: TransactionCreate,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    if payload.category_id is not None:
        owned_category = (
            db.table("categories")
            .select("id")
            .eq("id", str(payload.category_id))
            .eq("user_id", user_id)
            .execute()
        )
        if not owned_category.data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="category_id inválido para este usuário.",
            )

    row = {**payload.model_dump(mode="json"), "user_id": user_id}
    result = db.table("transactions").insert(row).execute()
    return result.data[0]


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
) -> None:
    result = (
        db.table("transactions")
        .delete()
        .eq("id", str(transaction_id))
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"
        )
