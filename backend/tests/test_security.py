"""
Tests for Supabase Auth, Security Dependencies, and AuditEvent Logging
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_enforcement_and_profile(client: AsyncClient, auth_headers: dict, test_user_id: str):
    # 1. Unauthenticated request to protected endpoint -> 401 Unauthorized
    unauth_res = await client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401
    assert unauth_res.json()["success"] is False

    # 2. Invalid Bearer token -> 401 Unauthorized
    bad_token_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.fake.token"},
    )
    assert bad_token_res.status_code == 401

    # 3. Valid Supabase JWT token -> 200 OK with user profile
    valid_res = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert valid_res.status_code == 200
    user_data = valid_res.json()["data"]
    assert user_data["id"] == test_user_id
    assert user_data["email"] == "farmer@example.com"


@pytest.mark.asyncio
async def test_audit_event_recording(client: AsyncClient, auth_headers: dict):
    # Create farm triggers an AuditEvent
    farm_res = await client.post("/api/v1/farms", json={"name": "Audit Test Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Retrieve audit events
    audit_res = await client.get(f"/api/v1/audit/events?farm_id={farm_id}", headers=auth_headers)
    assert audit_res.status_code == 200
    events = audit_res.json()["data"]
    assert len(events) >= 1
    assert events[0]["event_type"] == "create_farm"
    assert events[0]["entity_type"] == "farm"
