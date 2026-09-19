"""
Central SQLAlchemy 2.0 Async Engine and Session Management for Supabase PostgreSQL
"""

from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.config import settings
from app.core.exceptions import FarmOpsException
from app.core.logging import logger

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    """
    Returns the singleton AsyncEngine for Supabase PostgreSQL.
    Fails with a clear configuration error if DATABASE_URL is not configured.
    """
    global _engine
    if _engine is None:
        if not settings.DATABASE_URL:
            logger.error("DATABASE_URL is not configured in the environment.")
            raise FarmOpsException(
                status_code=503,
                detail="Database configuration is missing. Please set DATABASE_URL in environment.",
            )

        # Connection pooling configuration for PostgreSQL
        engine_kwargs = {
            "echo": settings.DB_ECHO,
            "future": True,
            "pool_pre_ping": True,
        }

        # If connecting to PostgreSQL (e.g. postgresql+asyncpg://)
        if not settings.DATABASE_URL.startswith("sqlite"):
            engine_kwargs.update(
                {
                    "pool_size": settings.DB_POOL_SIZE,
                    "max_overflow": settings.DB_MAX_OVERFLOW,
                    "pool_timeout": settings.DB_POOL_TIMEOUT,
                }
            )

        _engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
        logger.info("Supabase PostgreSQL async engine initialized.")

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Returns the singleton async session factory."""
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        _session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async database session per request.
    Rolls back automatically on unhandled error and ensures proper cleanup.
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception as exc:
            await session.rollback()
            logger.error(f"Database session rollback due to error: {exc}")
            raise
        finally:
            await session.close()
