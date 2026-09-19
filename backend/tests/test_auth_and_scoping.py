"""
Supabase Authentication, Role-Based Access Control, and Farm-Scoped Authorization Tests
Verifies all 17 security and cross-farm protection requirements.
"""

import pytest
import jwt
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.config import settings
from app.models.enums import UserRole
from app.models.farm import Farm, FarmMembership, Zone
from app.models.device import Device
from app.models.profile import Profile
from app.core.database import get_db


def create_test_token(user_id: str, email: str = "test@example.com", role: str = "farmer", expired: bool = False) -> str:
    """Generates a signed JWT token using test secret."""
    exp_time = (
        datetime.now(timezone.utc) - timedelta(hours=1)
        if expired
        else datetime.now(timezone.utc) + timedelta(hours=2)
    )
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "exp": exp_time.timestamp(),
        "user_metadata": {"role": role, "name": f"User {user_id}"},
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.SUPABASE_JWT_ALGORITHM)


# --- 1. Missing Authorization Header -> 401 ---
@pytest.mark.asyncio
async def test_missing_auth_header_returns_401(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert "Valid authentication is required" in data["error"]["message"]


# --- 2. Malformed / Tampered Token -> 401 ---
@pytest.mark.asyncio
async def test_malformed_token_returns_401(client: AsyncClient):
    # Bad signature
    tampered_token = jwt.encode(
        {"sub": "bad_user"},
        "wrong-secret-key-that-does-not-match-settings",
        algorithm="HS256",
    )
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered_token}"})
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_REQUIRED"

    # Completely invalid string
    response_garbage = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-jwt-token"})
    assert response_garbage.status_code == 401


# --- 3. Expired Token -> 401 ---
@pytest.mark.asyncio
async def test_expired_token_returns_401(client: AsyncClient):
    expired_token = create_test_token("user_expired", expired=True)
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_REQUIRED"


# --- 4. Valid Token -> Authenticated User ---
@pytest.mark.asyncio
async def test_valid_token_authenticates_user(client: AsyncClient):
    token = create_test_token("usr_valid_123", email="valid@example.com", role="farmer")
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["id"] == "usr_valid_123"
    assert data["email"] == "valid@example.com"


# --- 5. Missing Profile Handling (Safe Fallback, No Auto-Admin) ---
@pytest.mark.asyncio
async def test_missing_profile_handled_safely(client: AsyncClient, db_session: AsyncSession):
    user_id = "usr_new_unregistered_999"
    # Even if client token claims 'admin' in user_metadata, it should NOT grant system admin
    token = create_test_token(user_id, email="unregistered@example.com", role="admin")
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["id"] == user_id
    assert data["role"] != UserRole.ADMIN.value  # Safe downgrade to viewer


# --- 6. Valid OWNER Access ---
@pytest.mark.asyncio
async def test_owner_full_farm_management(client: AsyncClient, db_session: AsyncSession):
    owner_id = "usr_farm_owner_1"
    token = create_test_token(owner_id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create farm
    create_res = await client.post(
        "/api/v1/farms",
        json={"name": "Owner Greenfield Farm", "timezone": "UTC", "area_unit": "hectares"},
        headers=headers,
    )
    assert create_res.status_code == 201
    farm_id = create_res.json()["data"]["id"]

    # 2. Update farm
    update_res = await client.put(
        f"/api/v1/farms/{farm_id}",
        json={"name": "Renamed Greenfield Farm"},
        headers=headers,
    )
    assert update_res.status_code == 200

    # 3. Add zone
    zone_res = await client.post(
        f"/api/v1/farms/{farm_id}/zones",
        json={"name": "Zone Alpha", "area": 10.0, "area_unit": "hectares"},
        headers=headers,
    )
    assert zone_res.status_code == 201


# --- 7. Valid MANAGER Access ---
@pytest.mark.asyncio
async def test_manager_access(client: AsyncClient, db_session: AsyncSession):
    owner_id = "usr_farm_owner_m"
    manager_id = "usr_farm_manager_m"

    # Setup farm and membership in DB
    farm = Farm(owner_id=owner_id, name="Manager Test Farm")
    db_session.add(farm)
    await db_session.commit()

    membership = FarmMembership(farm_id=farm.id, user_id=manager_id, role=UserRole.MANAGER.value)
    db_session.add(membership)
    await db_session.commit()

    manager_token = create_test_token(manager_id)
    headers = {"Authorization": f"Bearer {manager_token}"}

    # Manager can create zone
    zone_res = await client.post(
        f"/api/v1/farms/{farm.id}/zones",
        json={"name": "Manager Zone", "area": 5.0, "area_unit": "hectares"},
        headers=headers,
    )
    assert zone_res.status_code == 201

    # Manager cannot delete the farm (strictly owner)
    delete_res = await client.delete(f"/api/v1/farms/{farm.id}", headers=headers)
    assert delete_res.status_code == 403


# --- 8. Valid AGRONOMIST Access ---
@pytest.mark.asyncio
async def test_agronomist_access(client: AsyncClient, db_session: AsyncSession):
    owner_id = "usr_farm_owner_a"
    agronomist_id = "usr_agronomist_a"

    farm = Farm(owner_id=owner_id, name="Agronomist Farm")
    db_session.add(farm)
    await db_session.commit()

    membership = FarmMembership(farm_id=farm.id, user_id=agronomist_id, role=UserRole.AGRONOMIST.value)
    db_session.add(membership)
    await db_session.commit()

    token = create_test_token(agronomist_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Agronomist can view risks
    risk_res = await client.get(f"/api/v1/risks/{farm.id}", headers=headers)
    assert risk_res.status_code == 200

    # Agronomist cannot delete farm or add zone
    zone_res = await client.post(
        f"/api/v1/farms/{farm.id}/zones",
        json={"name": "Illegal Zone", "area": 2.0, "area_unit": "hectares"},
        headers=headers,
    )
    assert zone_res.status_code == 403


# --- 9. Valid OPERATOR Access ---
@pytest.mark.asyncio
async def test_operator_access(client: AsyncClient, db_session: AsyncSession):
    owner_id = "usr_farm_owner_op"
    operator_id = "usr_operator_op"

    farm = Farm(owner_id=owner_id, name="Operator Farm")
    db_session.add(farm)
    await db_session.commit()

    membership = FarmMembership(farm_id=farm.id, user_id=operator_id, role=UserRole.OPERATOR.value)
    db_session.add(membership)
    await db_session.commit()

    token = create_test_token(operator_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Operator can view tasks
    task_res = await client.get(f"/api/v1/tasks/{farm.id}", headers=headers)
    assert task_res.status_code == 200


# --- 10. Valid VIEWER Read-Only Access ---
@pytest.mark.asyncio
async def test_viewer_read_only_access(client: AsyncClient, db_session: AsyncSession):
    owner_id = "usr_farm_owner_v"
    viewer_id = "usr_viewer_v"

    farm = Farm(owner_id=owner_id, name="Viewer Farm")
    db_session.add(farm)
    await db_session.commit()

    membership = FarmMembership(farm_id=farm.id, user_id=viewer_id, role=UserRole.VIEWER.value)
    db_session.add(membership)
    await db_session.commit()

    token = create_test_token(viewer_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Viewer can read farm info
    get_res = await client.get(f"/api/v1/farms/{farm.id}", headers=headers)
    assert get_res.status_code == 200

    # Viewer CANNOT update farm
    put_res = await client.put(f"/api/v1/farms/{farm.id}", json={"name": "Hacked Name"}, headers=headers)
    assert put_res.status_code == 403


# --- 11. Invalid Role Requirement -> 403 ---
@pytest.mark.asyncio
async def test_forbidden_role_returns_403(client: AsyncClient, db_session: AsyncSession):
    owner_id = "usr_farm_owner_fb"
    unauthorized_id = "usr_unauthorized_user"

    farm = Farm(owner_id=owner_id, name="Forbidden Test Farm")
    db_session.add(farm)
    await db_session.commit()

    token = create_test_token(unauthorized_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Attempting to delete without owner permissions
    response = await client.delete(f"/api/v1/farms/{farm.id}", headers=headers)
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "FORBIDDEN"


# --- 12, 13, 14. Cross-Farm Protection: User A (Farm A) vs User B (Farm B) ---
@pytest.mark.asyncio
async def test_cross_farm_data_isolation(client: AsyncClient, db_session: AsyncSession):
    user_a = "usr_farmer_alice"
    user_b = "usr_farmer_bob"

    farm_a = Farm(owner_id=user_a, name="Farm Alpha")
    farm_b = Farm(owner_id=user_b, name="Farm Beta")
    db_session.add_all([farm_a, farm_b])
    await db_session.commit()

    token_a = create_test_token(user_a)
    token_b = create_test_token(user_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. User A can access Farm A
    res_a_a = await client.get(f"/api/v1/farms/{farm_a.id}", headers=headers_a)
    assert res_a_a.status_code == 200

    # 2. User A CANNOT access Farm B -> 403
    res_a_b = await client.get(f"/api/v1/farms/{farm_b.id}", headers=headers_a)
    assert res_a_b.status_code == 403
    assert res_a_b.json()["error"]["code"] == "FORBIDDEN"

    # 3. User B CANNOT access Farm A -> 403
    res_b_a = await client.get(f"/api/v1/farms/{farm_a.id}", headers=headers_b)
    assert res_b_a.status_code == 403
    assert res_b_a.json()["error"]["code"] == "FORBIDDEN"

    # 4. Cross-farm telemetry querying is blocked
    res_a_b_telemetry = await client.get(f"/api/v1/telemetry/{farm_b.id}/events", headers=headers_a)
    assert res_a_b_telemetry.status_code == 403

    # 5. Cross-farm risks is blocked
    res_a_b_risks = await client.get(f"/api/v1/risks/{farm_b.id}", headers=headers_a)
    assert res_a_b_risks.status_code == 403


# --- 15. Resource-Level Authorization (Zone/Device from Unauthorized Farm) ---
@pytest.mark.asyncio
async def test_resource_level_cross_farm_protection(client: AsyncClient, db_session: AsyncSession):
    user_a = "usr_res_alice"
    user_b = "usr_res_bob"

    farm_a = Farm(owner_id=user_a, name="Farm A Resources")
    farm_b = Farm(owner_id=user_b, name="Farm B Resources")
    db_session.add_all([farm_a, farm_b])
    await db_session.commit()

    zone_b = Zone(farm_id=farm_b.id, name="Zone on Farm B")
    device_b = Device(farm_id=farm_b.id, device_type="soil_probe")
    db_session.add_all([zone_b, device_b])
    await db_session.commit()

    token_a = create_test_token(user_a)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User A tries to directly access Zone B by zone_id -> 403
    res_zone = await client.get(f"/api/v1/farms/zones/{zone_b.id}", headers=headers_a)
    assert res_zone.status_code == 403

    # User A tries to directly access Device B by device_id -> 403
    res_device = await client.get(f"/api/v1/devices/{device_b.id}", headers=headers_a)
    assert res_device.status_code == 403


# --- 16. System ADMIN Cross-Farm Access ---
@pytest.mark.asyncio
async def test_admin_cross_farm_access(client: AsyncClient, db_session: AsyncSession):
    admin_id = "usr_system_admin"
    farmer_id = "usr_regular_farmer"

    # Register admin in profiles table
    admin_profile = Profile(id=admin_id, email="admin@farmops.ai", role=UserRole.ADMIN.value)
    db_session.add(admin_profile)

    farm = Farm(owner_id=farmer_id, name="Farmer Protected Farm")
    db_session.add(farm)
    await db_session.commit()

    admin_token = create_test_token(admin_id, email="admin@farmops.ai", role="admin")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin accesses farmer's farm -> 200 OK
    res = await client.get(f"/api/v1/farms/{farm.id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Farmer Protected Farm"


# --- 17. Token/Secret Values Never Appear in Error Responses ---
@pytest.mark.asyncio
async def test_token_and_secret_never_leaked_in_errors(client: AsyncClient):
    bad_token = "secret-token-attempt-xyz-12345"
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bad_token}"})
    assert response.status_code == 401
    content = response.text.lower()
    assert bad_token.lower() not in content
    assert "secret" not in content
    assert "jwt" not in content
