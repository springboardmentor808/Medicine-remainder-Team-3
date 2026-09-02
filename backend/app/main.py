"""
PillSync — FastAPI Application Entrypoint.

Configures the FastAPI app with CORS middleware, API routers,
database lifecycle events (PostgreSQL, Redis, MongoDB), and health check endpoints.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.adherence import router as adherence_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.export import router as export_router
from app.api.v1.medicines import router as medicines_router
from app.api.v1.ocr import router as ocr_router
from app.api.v1.refill import router as refill_router
from app.api.v1.reminders import router as reminders_router
from app.api.v1.support import router as support_router
from app.api.v1.users import router as users_router
from app.core.config import settings
from app.core.database import engine, init_db
from app.core.mongodb import connect_mongodb, disconnect_mongodb
from app.core.redis import connect_redis, disconnect_redis


# ---------------------------------------------------------------------------
# Application Lifespan — Startup & Shutdown Events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application lifecycle:
    - Startup: Verify database connectivity (Postgres, Redis, MongoDB).
    - Shutdown: Dispose database connections gracefully.
    """
    # Startup
    print(f"[PillSync] [{settings.ENVIRONMENT}] Starting on port {settings.PORT}...")
    print(f"[PillSync] PostgreSQL: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print(f"[PillSync] JWT Algorithm: {settings.ALGORITHM}, Access TTL: {settings.ACCESS_TOKEN_EXPIRE_MINUTES}min")

    # Initialize DB tables / check connection
    try:
        await init_db()
    except Exception as db_err:
        print(f"[PillSync] DB initialization warning: {db_err}")

    # Connect Redis (with fallback for standalone dev)
    try:
        await connect_redis()
    except Exception as redis_err:
        print(f"[PillSync] Redis connection deferred: {redis_err}")

    # Connect MongoDB (with fallback for standalone dev)
    try:
        await connect_mongodb()
    except Exception as mongo_err:
        print(f"[PillSync] MongoDB connection deferred: {mongo_err}")

    yield  # Application runs here

    # Shutdown
    print("[PillSync] Shutting down... closing database connections.")
    await engine.dispose()
    try:
        await disconnect_redis()
    except Exception:
        pass
    try:
        await disconnect_mongodb()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Intelligent Medicine Reminder and Medication Tracking Platform. "
        "Manages medicine schedules, dosage adherence, refill predictions, "
        "and medication history with AI-powered tracking."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


import time
from fastapi import Request

# ---------------------------------------------------------------------------
# High-Precision Performance Monitoring Middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def performance_timing_middleware(request: Request, call_next):
    """Measures and logs exact HTTP pipeline duration; tags response with X-Process-Time."""
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000

    # Attach performance metric header
    response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"

    if duration_ms > 200:
        print(f"⚠️  [SLOW ENDPOINT] {request.method} {request.url.path} - {duration_ms:.2f}ms")
    elif settings.DEBUG:
        print(f"⚡ [PERF] {request.method} {request.url.path} - {duration_ms:.2f}ms")

    return response


# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# ---------------------------------------------------------------------------
# API Routers — All under /api/v1 prefix
# ---------------------------------------------------------------------------
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(ocr_router, prefix="/api/v1", tags=["OCR Scanner"])
app.include_router(refill_router, prefix="/api/v1", tags=["Refill AI"])
app.include_router(medicines_router, prefix="/api/v1")
app.include_router(adherence_router, prefix="/api/v1")
app.include_router(reminders_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(export_router, prefix="/api/v1")
app.include_router(support_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Root & Health Endpoints
# ---------------------------------------------------------------------------
@app.get(
    "/",
    tags=["Root"],
    summary="API Root",
)
async def root():
    """PillSync API root — returns basic app info."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health",
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check",
)
async def health_check():
    """
    Health check endpoint for Docker, load balancers, and CI.
    Returns 200 OK if the application is running.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
