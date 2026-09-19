"""
Tests for Health and Root endpoints
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock
from app.main import app
from app.core.database import get_db


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert "version" in data
    assert data["api_v1"] == "/api/v1"


@pytest.mark.asyncio
async def test_health_endpoint_healthy(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_database_health_endpoint_healthy(client: AsyncClient):
    response = await client.get("/api/v1/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok", "database": "connected"}


@pytest.mark.asyncio
async def test_database_health_endpoint_failure_returns_503():
    """Verifies that DB failure returns 503 and does NOT expose credentials."""
    async def failing_db():
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.execute.side_effect = ConnectionRefusedError("Simulated DB connection failure")
        yield mock_session

    app.dependency_overrides[get_db] = failing_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Test /health/db endpoint
            response_db = await ac.get("/api/v1/health/db")
            assert response_db.status_code == 503
            data_db = response_db.json()
            assert data_db == {"status": "error", "database": "disconnected"}
            # Ensure no credentials or URLs leaked
            assert "password" not in response_db.text.lower()
            assert "postgresql" not in response_db.text.lower()
            assert "supabase" not in response_db.text.lower()

            # 2. Test /health endpoint reports degraded
            response_health = await ac.get("/api/v1/health")
            assert response_health.status_code == 200
            data_health = response_health.json()
            assert data_health["status"] == "degraded"
            assert data_health["database"] == "disconnected"
    finally:
        app.dependency_overrides.clear()
