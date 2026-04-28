# ─── Router: Auth (mock) ──────────────────────────────────
# POST /api/auth/login   → issue JWT
# POST /api/auth/logout  → client-side only
# GET  /api/auth/me      → return current user
# ──────────────────────────────────────────────────────────

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import require_auth
from app.mock_data import MOCK_USERS

router = APIRouter(prefix="/auth", tags=["Auth"])


# ─── Schemas ──────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class MeResponse(BaseModel):
    id: str
    username: str
    role: str
    avatar_url: str | None = None


# ─── Helpers ──────────────────────────────────────────────
def _create_token(username: str, role: str) -> str:
    from jose import jwt
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    payload = {"sub": username, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ─── Routes ───────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = MOCK_USERS.get(form_data.username)
    if not user or user["password"] != form_data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = _create_token(user["username"], user["role"])
    return TokenResponse(access_token=token, role=user["role"], username=user["username"])


@router.post("/logout")
def logout(current_user: dict = Depends(require_auth)):
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=MeResponse)
def get_me(current_user: dict = Depends(require_auth)):
    user = MOCK_USERS.get(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return MeResponse(id=user["id"], username=user["username"], role=user["role"], avatar_url=user["avatar_url"])
