from datetime import date

from fastapi import APIRouter, Depends, Query
from supabase import Client

from auth import get_current_user_id
from database import get_supabase
from schemas import AvailableToSpendResponse
from services.dashboard_service import compute_available_to_spend

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/available-to-spend", response_model=AvailableToSpendResponse)
def available_to_spend(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    today = date.today()
    result = compute_available_to_spend(
        db,
        user_id,
        month=month if month is not None else today.month,
        year=year if year is not None else today.year,
    )
    return result
