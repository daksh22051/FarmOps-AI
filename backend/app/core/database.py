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
                    # Supabase closes idle server-side connections; recycling below that
                    # window stops the pool handing out sockets the server already dropped.
                    "pool_recycle": settings.DB_POOL_RECYCLE,
                }
            )

            # Supabase's transaction pooler (PgBouncer, port 6543) cannot serve the
            # prepared statements asyncpg caches by default. Detect it and disable the
            # caches, otherwise every second query fails with a DuplicatePreparedStatement.
            connect_args: dict = {
                # Server-side safety net: if a session is ever abandoned mid-transaction
                # (crashed worker, killed process), Postgres reclaims the slot instead of
                # holding it "idle in transaction" until the project runs out of slots.
                "server_settings": {
                    "idle_in_transaction_session_timeout": str(settings.DB_IDLE_TX_TIMEOUT_MS),
                    "application_name": "farmops-backend",
                },
            }
            if ":6543" in settings.DATABASE_URL or "pooler.supabase.com" in settings.DATABASE_URL:
                connect_args["statement_cache_size"] = 0
                connect_args["prepared_statement_cache_size"] = 0
                logger.info("Transaction pooler detected: asyncpg statement caching disabled.")
            engine_kwargs["connect_args"] = connect_args

        _engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
        logger.info(
            "Supabase PostgreSQL async engine initialized "
            f"(pool_size={settings.DB_POOL_SIZE}, max_overflow={settings.DB_MAX_OVERFLOW})."
        )

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
        rolled_back = False
        try:
            yield session
        except Exception as exc:
            await session.rollback()
            rolled_back = True
            logger.error(f"Database session rollback due to error: {exc}")
            raise
        finally:
            # A read-only request never commits, so without this rollback the
            # connection returns to the pool still inside an open transaction and
            # Postgres reports it as "idle in transaction" until the pool recycles
            # it. Enough of those and the project runs out of connection slots.
            if not rolled_back:
                try:
                    await session.rollback()
                except Exception:
                    logger.debug("Session rollback on teardown failed; closing anyway.")
            await session.close()
