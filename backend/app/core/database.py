"""
PillSync Async Database Engine & Session Factory.

Uses SQLAlchemy 2.0 async ORM with asyncpg driver for high-performance
non-blocking PostgreSQL operations.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.core.config import settings


# ---------------------------------------------------------------------------
# Async Engine
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.POSTGRES_URL,
    echo=settings.DEBUG,          # Log SQL in development
    pool_size=20,                 # Connection pool size
    max_overflow=10,              # Extra connections under burst
    pool_pre_ping=True,           # Verify connections before checkout
    pool_recycle=3600,            # Recycle connections after 1 hour
)

# ---------------------------------------------------------------------------
# Async Session Factory
# ---------------------------------------------------------------------------
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,       # Prevent lazy-load issues in async context
    autocommit=False,
    autoflush=False,
)


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
# FastAPI Dependency — Async DB Session
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields an async database session for FastAPI dependency injection.

    Usage in endpoints:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
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
