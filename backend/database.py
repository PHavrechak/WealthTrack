import os
from functools import lru_cache

from fastapi import HTTPException, status
from supabase import Client, create_client


@lru_cache
def get_supabase() -> Client:
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_secret_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not supabase_url or not supabase_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL or SUPABASE_SECRET_KEY is not configured on the backend.",
        )
    return create_client(supabase_url, supabase_secret_key)
