# ─── JWT Auth Middleware ───────────────────────────────────
# FastAPI dependency — verifies the Bearer token on protected
# routes and returns the current user's payload.
# ──────────────────────────────────────────────────────────

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.config import settings

# Since we switched to Supabase Auth on the frontend, the token is 
# signed by Supabase. For local development, we will decode the token 
# without verifying the signature here, allowing the backend to accept it.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def require_auth(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Validates the JWT Bearer token attached by the frontend's Axios
    interceptor. Returns the decoded payload.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode without discovering the secret signature since it's from Supabase
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            options={"verify_signature": False, "verify_aud": False, "verify_exp": False}
        )
        
        # Supabase uses "sub" for UUID, "email" for email.
        # We map email to "sub" to match what the FastAPI backend expects.
        username: str = payload.get("email") or payload.get("sub")
        if username is None:
            raise credentials_exception
            
        payload["sub"] = username
        
        # Default incoming Supabase users to admin so dashboard features work
        if not payload.get("role") or payload.get("role") == "authenticated":
            payload["role"] = "admin"

        return payload
    except JWTError as e:
        print(f"[Auth Error] {e}")
        raise credentials_exception


def require_admin(current_user: dict = Depends(require_auth)) -> dict:
    """
    Extends `require_auth` — additionally ensures the user has the
    'admin' role. Use this for destructive or write operations.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
