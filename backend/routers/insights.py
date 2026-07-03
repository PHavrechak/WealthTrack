from fastapi import APIRouter, Depends, Query
from supabase import Client

from auth import get_current_user_id
from database import get_supabase
from schemas import InsightsResponse
from services.insight_rules import MIN_MONTHS_WITH_DATA, generate_insights
from services.trend_service import build_trend_data

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=InsightsResponse)
def list_insights(
    months: int = Query(6, ge=3, le=24),
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    trend = build_trend_data(db, user_id, months=months)
    sufficient = trend.months_with_data >= MIN_MONTHS_WITH_DATA
    insights = generate_insights(trend) if sufficient else []
    return {
        "months_analyzed": months,
        "months_with_data": trend.months_with_data,
        "sufficient_data": sufficient,
        "insights": insights,
    }
