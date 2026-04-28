# ─── Atlas Backend — Settings ─────────────────────────────
# All values are loaded from the .env file automatically.
# ──────────────────────────────────────────────────────────

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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
    FRONTEND_ORIGIN: str = "http://localhost:5173"


# ─── Singleton instance used across the entire app ────────
settings = Settings()
