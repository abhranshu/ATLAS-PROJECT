# ─── Atlas Backend — Settings ─────────────────────────────
# All values are loaded from the .env file automatically.
# ──────────────────────────────────────────────────────────

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/atlas_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "atlas-dev-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 8

    # App meta
    APP_ENV: str = "development"
    APP_VERSION: str = "1.0.0"
    # CORS
    # Use comma-separated origins in production, for example:
    # CORS_ORIGINS=https://myapp.vercel.app,https://myapp.netlify.app
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex for dynamic preview URLs (e.g. Vercel/Netlify preview deployments)
    CORS_ORIGIN_REGEX: str | None = None
    CORS_ALLOW_CREDENTIALS: bool = True


# ─── Singleton instance used across the entire app ────────
settings = Settings()
