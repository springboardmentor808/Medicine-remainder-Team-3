"""
PillSync — FastAPI Application Entrypoint.

Configures the FastAPI app with CORS middleware, API routers,
database lifecycle events, and health check endpoints.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.ocr import router as ocr_router
from app.api.v1.refill import router as refill_router
from app.api.v1.medicines import router as medicines_router


# ---------------------------------------------------------------------------
# Application Lifespan — Startup & Shutdown Events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application lifecycle:
    - Startup: Verify database connectivity.
    - Shutdown: Dispose database engine connections.
    """
    # Startup
    print(f"[PillSync] [{settings.ENVIRONMENT}] Starting on port {settings.PORT}...")
    print(f"[PillSync] Database: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print(f"[PillSync] JWT Algorithm: {settings.ALGORITHM}, Access TTL: {settings.ACCESS_TOKEN_EXPIRE_MINUTES}min")

    yield  # Application runs here

    # Shutdown
    print("[PillSync] Shutting down... closing database connections.")
    await engine.dispose()


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


# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API Routers — All under /api/v1 prefix
# ---------------------------------------------------------------------------
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(ocr_router, prefix="/api/v1/ocr", tags=["OCR Scanner"])
app.include_router(refill_router, prefix="/api/v1/refill", tags=["Refill AI"])
app.include_router(medicines_router, prefix="/api/v1")


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
