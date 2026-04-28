# ─── Atlas Backend — Database ─────────────────────────────
# SQLAlchemy 2.x async-ready engine + session factory.
# Import `get_db` as a FastAPI dependency in any router.
# ──────────────────────────────────────────────────────────

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

# ─── Engine ───────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,      # Reconnects if DB connection dropped
    pool_size=10,
    max_overflow=20,
    echo=(settings.APP_ENV == "development"),  # SQL log in dev only
)

# ─── Session Factory ───────────────────────────────────────
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# ─── Declarative Base ─────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ─── FastAPI Dependency ────────────────────────────────────
def get_db():
    """
    Yields a DB session and ensures it is closed after each request.
    Usage:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
