from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError
from supabase import Client

from auth import get_current_user_id
from database import get_supabase
from schemas import CategoryCreate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    result = (
        db.table("categories")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return result.data


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
):
    row = {**payload.model_dump(mode="json"), "user_id": user_id}
    result = db.table("categories").insert(row).execute()
    return result.data[0]


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_supabase),
) -> None:
    try:
        result = (
            db.table("categories")
            .delete()
            .eq("id", str(category_id))
            .eq("user_id", user_id)
            .execute()
        )
    except APIError as exc:
        if exc.code == "23503":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Não é possível excluir: existem transações vinculadas a esta categoria.",
            ) from exc
        raise

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
