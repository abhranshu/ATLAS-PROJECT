# ─────────────────────────────────────────────────────────────────────────────
#  Atlas Backend — main.py
#  FastAPI application entry point.
#
#  Start the server:
#      uvicorn app.main:app --reload --port 8000
#
#  Docs (auto-generated):
#      Swagger  →  http://localhost:8000/docs
#      ReDoc    →  http://localhost:8000/redoc
# ─────────────────────────────────────────────────────────────────────────────

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

# ─── Logger setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("atlas")


# ─── Lifespan: startup / shutdown events ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on server startup (before the first request) and again on shutdown.
    Use this to pre-load heavy resources so they are ready for the first
    request rather than loading lazily on demand.
    """
    logger.info("━" * 60)
    logger.info("  🚀  Atlas Backend v%s starting up", settings.APP_VERSION)
    logger.info("  ENV: %s", settings.APP_ENV)
    logger.info("━" * 60)

    # ── 1. Verify DB connectivity ──────────────────────────
    try:
        from app.database import Base, SessionLocal, engine
        import app.models  # noqa: F401
        from app.services.bootstrap import seed_initial_data
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
        session = SessionLocal()
        try:
            seed_initial_data(session)
        finally:
            session.close()
        logger.info("  ✅  PostgreSQL connected")
    except Exception as exc:
        logger.warning("  ⚠️   PostgreSQL unavailable — %s", exc)

    # ── 2. Verify Redis connectivity ───────────────────────
    from app.utils.cache import get_redis
    get_redis()   # Initialises and pings — logs result internally

    # ── 3. Pre-load ML model and Explainer (optional warm-up) ────────────
    try:
        from app.services.anomaly_detector import _load_model
        _load_model()
        from app.services.shap_explainer import _load_explainer
        _load_explainer()
    except FileNotFoundError:
        logger.warning(
            "  ⚠️   Isolation Forest model not found — "
            "run  python scripts/train_model.py  to generate it."
        )
    except Exception as exc:
        logger.warning("  ⚠️   ML model load error — %s", exc)

    logger.info("  ✅  Ready to serve requests on port 8000")
    logger.info("━" * 60)

    yield  # Server is running — handle requests here

    logger.info("  👋  Atlas Backend shutting down")


# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Atlas IoT SOC Backend API",
    description=(
        "Backend API for the Atlas Security Operations Centre dashboard.\n\n"
        "Provides device management, trust scoring, anomaly detection "
        "(Isolation Forest + SHAP), incident tracking, and network topology."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ─── CORS Middleware ──────────────────────────────────────────────────────────
# Must be registered BEFORE routers so preflight OPTIONS requests are handled.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_ORIGIN,      # http://localhost:5173 (Vite dev server)
        "http://localhost:3000",        # Create-React-App fallback
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catches any unhandled exception and returns a clean JSON response
    instead of an HTML 500 page (which would confuse the React frontend).
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": str(type(exc).__name__)},
    )


# ─── Routers ──────────────────────────────────────────────────────────────────
# Each router is mounted under /api to match the frontend's API_BASE_URL.

from app.routers import auth, dashboard, devices, incidents, network, servers, trust, telemetry  # noqa: E402

app.include_router(auth.router,       prefix="/api")
app.include_router(dashboard.router,  prefix="/api")
app.include_router(devices.router,    prefix="/api")
app.include_router(incidents.router,  prefix="/api")
app.include_router(network.router,    prefix="/api")
app.include_router(servers.router,    prefix="/api")
app.include_router(trust.router,      prefix="/api")
app.include_router(telemetry.router,  prefix="/api")


# ─── Health Endpoints ─────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
def health_check():
    """
    Lightweight liveness probe.
    Returns 200 OK when the server is running.
    """
    return {
        "status":  "ok",
        "version": settings.APP_VERSION,
        "env":     settings.APP_ENV,
    }


@app.get("/api/health/deep", tags=["Health"])
def deep_health_check():
    """
    Deep health check — tests DB + Redis connectivity.
    Useful for readiness probes in Docker / Kubernetes.
    """
    from app.utils.cache import get_redis
    import sqlalchemy

    checks = {}

    # DB check
    try:
        from app.database import engine
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    # Redis check
    try:
        r = get_redis()
        if r:
            r.ping()
            checks["redis"] = "ok"
        else:
            checks["redis"] = "unavailable"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks, "version": settings.APP_VERSION}
