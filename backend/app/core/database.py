import os
from typing import AsyncGenerator
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ---------------------------------------------------------------------------
# Declarative Base — All models inherit from this
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy ORM models.
    Alembic auto-discovers models through this base.
    """
    pass


# ---------------------------------------------------------------------------
# SQLite Foreign Key Enforcement
# ---------------------------------------------------------------------------
def _enable_sqlite_fk(dbapi_conn, connection_record):
    """Enable foreign key constraint enforcement and WAL mode on SQLite."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


# ---------------------------------------------------------------------------
# Async Engine Creation (with fallback for standalone dev without Docker)
# ---------------------------------------------------------------------------
db_url = settings.POSTGRES_URL

if "sqlite" in db_url:
    engine = create_async_engine(
        db_url,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    event.listen(engine.sync_engine, "connect", _enable_sqlite_fk)
else:
    try:
        engine = create_async_engine(
            db_url,
            echo=settings.DEBUG,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
    except Exception:
        fallback_url = "sqlite+aiosqlite:///./pillsync_dev.db"
        print(f"[PillSync DB] PostgreSQL unavailable at {db_url}. Falling back to local SQLite: {fallback_url}")
        engine = create_async_engine(
            fallback_url,
            echo=settings.DEBUG,
            connect_args={"check_same_thread": False},
        )
        event.listen(engine.sync_engine, "connect", _enable_sqlite_fk)

# ---------------------------------------------------------------------------
# Async Session Factory
# ---------------------------------------------------------------------------
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# Database Initialization Helper
# ---------------------------------------------------------------------------
async def init_db():
    """Verify DB connection and create all tables if missing."""
    global engine, async_session_factory
    # Import all models to register with Base.metadata
    import app.models  # noqa: F401

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[PillSync DB] Database connection & tables verified successfully.")
    except Exception as err:
        print(f"[PillSync DB] Primary PostgreSQL connection failed ({err}). Initializing local SQLite fallback...")
        fallback_url = "sqlite+aiosqlite:///./pillsync_dev.db"
        engine = create_async_engine(fallback_url, echo=settings.DEBUG)
        async_session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[PillSync DB] Local SQLite fallback database initialized successfully.")


# ---------------------------------------------------------------------------
# FastAPI Dependency — Async DB Session
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields an async database session for FastAPI dependency injection.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

