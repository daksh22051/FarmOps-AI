"""
Database Configuration, Engine, Dependency, and Metadata Unit Tests
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import Settings
from app.core import database
from app.core.exceptions import FarmOpsException
from app.models import (
    Base,
    Profile,
    Farm,
    FarmMembership,
    Zone,
    Device,
    SensorEvent,
    ExternalObservation,
    RiskAssessment,
    ActionPlan,
    Task,
    Alert,
    Escalation,
    AuditEvent,
)


def test_database_settings_url_normalization():
    """Verifies that postgres:// and postgresql:// are normalized to postgresql+asyncpg://"""
    # 1. Standard postgresql prefix
    s1 = Settings(DATABASE_URL="postgresql://user:pass@db.supabase.co:5432/postgres")
    assert s1.DATABASE_URL == "postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres"

    # 2. Legacy postgres prefix
    s2 = Settings(DATABASE_URL="postgres://user:pass@db.supabase.co:5432/postgres")
    assert s2.DATABASE_URL == "postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres"

    # 3. Already asyncpg prefix
    s3 = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres")
    assert s3.DATABASE_URL == "postgresql+asyncpg://user:pass@db.supabase.co:5432/postgres"

    # 4. is_database_configured property
    assert s3.is_database_configured is True
    s_empty = Settings(DATABASE_URL="")
    assert s_empty.is_database_configured is False


def test_supabase_keys_resolution():
    """Verifies fallback resolution for Supabase keys."""
    s = Settings(
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY="",
        SUPABASE_SECRET_KEY="",
        SUPABASE_ANON_KEY="anon_key_123",
        SUPABASE_SERVICE_ROLE_KEY="service_role_key_456",
    )
    assert s.SUPABASE_PUBLISHABLE_KEY == "anon_key_123"
    assert s.SUPABASE_SECRET_KEY == "service_role_key_456"
    assert s.SUPABASE_JWT_SECRET == "service_role_key_456"


def test_get_engine_missing_database_url_raises_503():
    """Verifies that get_engine fails with a 503 FarmOpsException when DATABASE_URL is empty."""
    with patch.object(database, "_engine", None):
        with patch.object(database.settings, "DATABASE_URL", ""):
            with pytest.raises(FarmOpsException) as exc_info:
                database.get_engine()
            assert exc_info.value.status_code == 503
            assert "DATABASE_URL" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_db_session_lifecycle_and_cleanup():
    """Verifies get_db yields session and closes it on normal completion."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session_factory = MagicMock()
    mock_session_factory.return_value.__aenter__.return_value = mock_session
    mock_session_factory.return_value.__aexit__.return_value = None

    with patch.object(database, "get_session_factory", return_value=mock_session_factory):
        db_generator = database.get_db()
        session = await db_generator.asend(None)
        assert session == mock_session

        # Finish generator
        with pytest.raises(StopAsyncIteration):
            await db_generator.asend(None)

        mock_session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_db_session_rollback_on_error():
    """Verifies get_db triggers session rollback on unhandled error and re-raises."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session_factory = MagicMock()
    mock_session_factory.return_value.__aenter__.return_value = mock_session
    mock_session_factory.return_value.__aexit__.return_value = None

    with patch.object(database, "get_session_factory", return_value=mock_session_factory):
        db_generator = database.get_db()
        session = await db_generator.asend(None)
        assert session == mock_session

        with pytest.raises(RuntimeError, match="DB Operation Failed"):
            await db_generator.athrow(RuntimeError("DB Operation Failed"))

        mock_session.rollback.assert_awaited_once()
        mock_session.close.assert_awaited_once()


def test_all_13_domain_models_registered_in_metadata():
    """Verifies that all 13 core domain entities are registered in SQLAlchemy Base.metadata."""
    table_names = set(Base.metadata.tables.keys())
    required_tables = {
        "profiles",
        "farms",
        "farm_memberships",
        "zones",
        "devices",
        "sensor_events",
        "external_observations",
        "risk_assessments",
        "action_plans",
        "tasks",
        "alerts",
        "escalations",
        "audit_events",
    }
    missing_tables = required_tables - table_names
    assert not missing_tables, f"Missing domain tables in SQLAlchemy metadata: {missing_tables}"


def test_alembic_migration_defines_all_13_tables():
    """Verifies that the aligned Alembic migration script defines all 13 domain tables."""
    import importlib.util
    import os

    migration_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "alembic",
        "versions",
        "271fb424ed39_aligned_foundation_schema.py",
    )
    assert os.path.exists(migration_path), "Migration script not found"

    with open(migration_path, "r", encoding="utf-8") as f:
        content = f.read()

    required_tables = [
        "profiles",
        "farms",
        "farm_memberships",
        "zones",
        "devices",
        "sensor_events",
        "external_observations",
        "risk_assessments",
        "action_plans",
        "tasks",
        "alerts",
        "escalations",
        "audit_events",
    ]
    for tbl in required_tables:
        assert f"op.create_table('{tbl}'" in content or f'op.create_table("{tbl}"' in content, (
            f"Table '{tbl}' is not defined in Alembic migration {migration_path}"
        )
