import os
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer()


def _supabase_url() -> str:
    supabase_url = os.environ.get("SUPABASE_URL")
    if not supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured on the backend.",
        )
    return supabase_url.rstrip("/")


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    jwks_url = f"{_supabase_url()}/auth/v1/.well-known/jwks.json"
    return jwt.PyJWKClient(jwks_url)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{_supabase_url()}/auth/v1",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc
    return payload


def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    return user["sub"]
