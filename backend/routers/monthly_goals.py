from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from auth import get_current_user_id
from database import get_supabase
from schemas import MonthlyGoalResponse, MonthlyGoalUpsert

router = APIRouter(prefix="/monthly-goals", tags=["monthly_goals"])


@router.get("", response_model=MonthlyGoalResponse)
def get_monthly_goal(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("monthly_goals")
        .select("*")
        .eq("user_id", user_id)
        .eq("month", month)
        .eq("year", year)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meta não encontrada para o período informado.",
        )
    return result.data[0]


@router.put("", response_model=MonthlyGoalResponse)
def upsert_monthly_goal(
    payload: MonthlyGoalUpsert,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    row = {
        **payload.model_dump(mode="json"),
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = (
        db.table("monthly_goals")
        .upsert(row, on_conflict="user_id,month,year")
        .execute()
    )
    return result.data[0]
