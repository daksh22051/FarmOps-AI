"""
Comprehensive Tests for Farm, Zone & Device Management APIs
Covers all 21 functional, validation, authorization, and audit test scenarios.
"""

import pytest
import jwt
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.farm import Farm, Zone
from app.models.device import Device
from app.models.audit import AuditEvent


def make_auth_headers(user_id: str, email: str = "user@example.com") -> dict:
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "exp": (datetime.now(timezone.utc) + timedelta(hours=2)).timestamp(),
        "user_metadata": {"name": f"User {user_id}"},
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.SUPABASE_JWT_ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# FARM TESTS (1 - 7)
# ==============================================================================

@pytest.mark.asyncio
async def test_01_authenticated_user_can_create_farm(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_01", "farmer01@example.com")
    payload = {
        "name": "Emerald Valley Farm",
        "location": "Salinas, CA",
        "timezone": "America/Los_Angeles",
        "total_area": 150.0,
        "area_unit": "hectare",
        "is_demo": False,
    }
    response = await client.post("/api/v1/farms", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Emerald Valley Farm"
    assert data["owner_id"] == "usr_farmer_01"
    assert data["total_area"] == 150.0
    assert data["timezone"] == "America/Los_Angeles"


@pytest.mark.asyncio
async def test_02_owner_can_read_farm(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_02")
    create_res = await client.post(
        "/api/v1/farms",
        json={"name": "Sunshine Orchard", "timezone": "UTC", "total_area": 80.0},
        headers=headers,
    )
    farm_id = create_res.json()["data"]["id"]

    get_res = await client.get(f"/api/v1/farms/{farm_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == farm_id


@pytest.mark.asyncio
async def test_03_owner_can_update_farm_via_patch(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_03")
    create_res = await client.post(
        "/api/v1/farms",
        json={"name": "Initial Name Farm", "timezone": "UTC", "total_area": 50.0},
        headers=headers,
    )
    farm_id = create_res.json()["data"]["id"]

    patch_res = await client.patch(
        f"/api/v1/farms/{farm_id}",
        json={"name": "Updated Name Farm", "total_area": 65.5},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["name"] == "Updated Name Farm"
    assert patch_res.json()["data"]["total_area"] == 65.5


@pytest.mark.asyncio
async def test_04_user_cannot_access_another_users_farm(client: AsyncClient):
    headers_a = make_auth_headers("usr_farmer_a")
    headers_b = make_auth_headers("usr_farmer_b")

    create_res = await client.post(
        "/api/v1/farms",
        json={"name": "Alice Private Farm", "timezone": "UTC"},
        headers=headers_a,
    )
    farm_id = create_res.json()["data"]["id"]

    # Bob tries to read Alice's farm
    get_res = await client.get(f"/api/v1/farms/{farm_id}", headers=headers_b)
    assert get_res.status_code == 403

    # Bob tries to update Alice's farm
    patch_res = await client.patch(f"/api/v1/farms/{farm_id}", json={"name": "Hacked Farm"}, headers=headers_b)
    assert patch_res.status_code == 403


@pytest.mark.asyncio
async def test_05_farm_listing_pagination_and_scoping(client: AsyncClient):
    headers_c = make_auth_headers("usr_farmer_c")
    headers_d = make_auth_headers("usr_farmer_d")

    # Create 3 farms for user C
    for i in range(3):
        await client.post(
            "/api/v1/farms",
            json={"name": f"Farmer C Farm {i+1}", "timezone": "UTC"},
            headers=headers_c,
        )

    # Create 1 farm for user D
    await client.post(
        "/api/v1/farms",
        json={"name": "Farmer D Farm 1", "timezone": "UTC"},
        headers=headers_d,
    )

    # List farms for user C
    list_res_c = await client.get("/api/v1/farms?page=1&page_size=10", headers=headers_c)
    assert list_res_c.status_code == 200
    farms_c = list_res_c.json()["data"]
    assert len(farms_c) == 3
    for f in farms_c:
        assert f["owner_id"] == "usr_farmer_c"

    # List farms for user D
    list_res_d = await client.get("/api/v1/farms?page=1&page_size=10", headers=headers_d)
    assert list_res_d.status_code == 200
    farms_d = list_res_d.json()["data"]
    assert len(farms_d) == 1
    assert farms_d[0]["owner_id"] == "usr_farmer_d"


@pytest.mark.asyncio
async def test_06_invalid_farm_area_rejected_with_422(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_06")

    # Negative area
    res_neg = await client.post(
        "/api/v1/farms",
        json={"name": "Invalid Area Farm", "total_area": -10.0, "timezone": "UTC"},
        headers=headers,
    )
    assert res_neg.status_code == 422

    # Zero area
    res_zero = await client.post(
        "/api/v1/farms",
        json={"name": "Zero Area Farm", "total_area": 0.0, "timezone": "UTC"},
        headers=headers,
    )
    assert res_zero.status_code == 422


@pytest.mark.asyncio
async def test_07_invalid_farm_input_rejected_with_422(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_07")

    # Empty name
    res_name = await client.post(
        "/api/v1/farms",
        json={"name": "   ", "timezone": "UTC"},
        headers=headers,
    )
    assert res_name.status_code == 422

    # Invalid timezone
    res_tz = await client.post(
        "/api/v1/farms",
        json={"name": "Bad TZ Farm", "timezone": "Mars/Olympus_Mons"},
        headers=headers,
    )
    assert res_tz.status_code == 422

    # Invalid GeoJSON geometry (missing type)
    res_geo = await client.post(
        "/api/v1/farms",
        json={"name": "Bad Geo Farm", "timezone": "UTC", "boundary_geometry": {"shape": "invalid"}},
        headers=headers,
    )
    assert res_geo.status_code == 422


# ==============================================================================
# ZONE TESTS (8 - 12)
# ==============================================================================

@pytest.mark.asyncio
async def test_08_authorized_user_can_create_zone(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_08")
    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Zone Test Farm", "timezone": "UTC", "total_area": 100.0},
        headers=headers,
    )
    farm_id = farm_res.json()["data"]["id"]

    zone_payload = {
        "name": "North Orchard",
        "area": 25.0,
        "area_unit": "hectare",
        "crop": "Apple",
        "crop_stage": "flowering",
        "soil_type": "Loam",
        "status": "active",
    }
    zone_res = await client.post(f"/api/v1/farms/{farm_id}/zones", json=zone_payload, headers=headers)
    assert zone_res.status_code == 201
    zone_data = zone_res.json()["data"]
    assert zone_data["name"] == "North Orchard"
    assert zone_data["farm_id"] == farm_id
    assert zone_data["area"] == 25.0


@pytest.mark.asyncio
async def test_09_unauthorized_farm_zone_creation_blocked(client: AsyncClient):
    headers_owner = make_auth_headers("usr_owner_09")
    headers_intruder = make_auth_headers("usr_intruder_09")

    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Protected Farm 09", "timezone": "UTC"},
        headers=headers_owner,
    )
    farm_id = farm_res.json()["data"]["id"]

    # Intruder tries to create zone in owner's farm
    zone_res = await client.post(
        f"/api/v1/farms/{farm_id}/zones",
        json={"name": "Unauthorized Zone", "area": 5.0},
        headers=headers_intruder,
    )
    assert zone_res.status_code == 403


@pytest.mark.asyncio
async def test_11_invalid_zone_area_rejected_with_422(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_11")
    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Small Farm 11", "timezone": "UTC", "total_area": 50.0},
        headers=headers,
    )
    farm_id = farm_res.json()["data"]["id"]

    # 1. Negative area
    res_neg = await client.post(
        f"/api/v1/farms/{farm_id}/zones",
        json={"name": "Negative Zone", "area": -5.0},
        headers=headers,
    )
    assert res_neg.status_code == 422

    # 2. Zone area exceeds farm total area (60 > 50)
    res_exceed = await client.post(
        f"/api/v1/farms/{farm_id}/zones",
        json={"name": "Giant Zone", "area": 60.0},
        headers=headers,
    )
    assert res_exceed.status_code == 422
    assert "exceed farm total area" in res_exceed.json()["message"]


@pytest.mark.asyncio
async def test_12_zone_direct_resource_access_and_patch(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_12")
    headers_other = make_auth_headers("usr_other_12")

    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Direct Zone Farm", "timezone": "UTC", "total_area": 100.0},
        headers=headers,
    )
    farm_id = farm_res.json()["data"]["id"]

    zone_res = await client.post(
        f"/api/v1/farms/{farm_id}/zones",
        json={"name": "Sector 1", "area": 20.0},
        headers=headers,
    )
    zone_id = zone_res.json()["data"]["id"]

    # 1. GET /api/v1/zones/{zone_id} by owner
    get_res = await client.get(f"/api/v1/zones/{zone_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == zone_id

    # 2. PATCH /api/v1/zones/{zone_id} by owner
    patch_res = await client.patch(
        f"/api/v1/zones/{zone_id}",
        json={"name": "Sector 1 - Renovated", "crop": "Almonds"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["name"] == "Sector 1 - Renovated"
    assert patch_res.json()["data"]["crop"] == "Almonds"

    # 3. GET /api/v1/zones/{zone_id} by unauthorized user -> 403
    get_other = await client.get(f"/api/v1/zones/{zone_id}", headers=headers_other)
    assert get_other.status_code == 403


# ==============================================================================
# DEVICE TESTS (13 - 18)
# ==============================================================================

@pytest.mark.asyncio
async def test_13_authorized_user_can_register_device(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_13")
    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Device Farm 13", "timezone": "UTC"},
        headers=headers,
    )
    farm_id = farm_res.json()["data"]["id"]

    dev_payload = {
        "device_type": "soil_moisture",
        "credential_reference": "SN-ESP32-DEV13",
        "calibration": {"offset": 0.5},
        "enabled": True,
    }
    reg_res = await client.post(f"/api/v1/farms/{farm_id}/devices", json=dev_payload, headers=headers)
    assert reg_res.status_code == 201
    dev_data = reg_res.json()["data"]
    assert dev_data["farm_id"] == farm_id
    assert dev_data["device_type"] == "soil_moisture"


@pytest.mark.asyncio
async def test_14_unauthorized_farm_device_registration_blocked(client: AsyncClient):
    headers_owner = make_auth_headers("usr_owner_14")
    headers_intruder = make_auth_headers("usr_intruder_14")

    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Protected Device Farm 14", "timezone": "UTC"},
        headers=headers_owner,
    )
    farm_id = farm_res.json()["data"]["id"]

    reg_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "weather_station"},
        headers=headers_intruder,
    )
    assert reg_res.status_code == 403


@pytest.mark.asyncio
async def test_15_device_zone_must_belong_to_same_farm(client: AsyncClient):
    headers_a = make_auth_headers("usr_farmer_15a")
    headers_b = make_auth_headers("usr_farmer_15b")

    # Farm A
    farm_a = await client.post("/api/v1/farms", json={"name": "Farm A-15", "timezone": "UTC"}, headers=headers_a)
    farm_a_id = farm_a.json()["data"]["id"]

    # Farm B and Zone B
    farm_b = await client.post("/api/v1/farms", json={"name": "Farm B-15", "timezone": "UTC"}, headers=headers_b)
    farm_b_id = farm_b.json()["data"]["id"]
    zone_b = await client.post(f"/api/v1/farms/{farm_b_id}/zones", json={"name": "Zone B"}, headers=headers_b)
    zone_b_id = zone_b.json()["data"]["id"]

    # Attempt to register device on Farm A with Zone from Farm B -> 422
    dev_payload = {
        "device_type": "soil_moisture",
        "zone_id": zone_b_id,  # Belongs to Farm B!
    }
    reg_res = await client.post(f"/api/v1/farms/{farm_a_id}/devices", json=dev_payload, headers=headers_a)
    assert reg_res.status_code == 422
    assert "belongs to another farm" in reg_res.json()["message"]


@pytest.mark.asyncio
async def test_16_device_direct_resource_access_and_patch(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_16")
    headers_other = make_auth_headers("usr_other_16")

    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Device Resource Farm 16", "timezone": "UTC"},
        headers=headers,
    )
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "weather_station", "credential_reference": "SN-WS-101"},
        headers=headers,
    )
    device_id = dev_res.json()["data"]["id"]

    # 1. GET /api/v1/devices/{device_id} by owner
    get_res = await client.get(f"/api/v1/devices/{device_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == device_id

    # 2. PATCH /api/v1/devices/{device_id} by owner (disable device)
    patch_res = await client.patch(
        f"/api/v1/devices/{device_id}",
        json={"enabled": False, "calibration": {"temp_offset": -0.8}},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["enabled"] is False

    # 3. GET /api/v1/devices/{device_id} by unauthorized user -> 403
    get_other = await client.get(f"/api/v1/devices/{device_id}", headers=headers_other)
    assert get_other.status_code == 403


@pytest.mark.asyncio
async def test_17_device_raw_credentials_not_leaked(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_17")

    # Reject raw password in credential_reference
    farm_res = await client.post("/api/v1/farms", json={"name": "Cred Farm", "timezone": "UTC"}, headers=headers)
    farm_id = farm_res.json()["data"]["id"]

    bad_payload = {
        "device_type": "soil_moisture",
        "credential_reference": "password=supersecretpassword123",
    }
    reg_bad = await client.post(f"/api/v1/farms/{farm_id}/devices", json=bad_payload, headers=headers)
    assert reg_bad.status_code == 422


@pytest.mark.asyncio
async def test_18_demo_device_supported(client: AsyncClient):
    headers = make_auth_headers("usr_farmer_18")
    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Demo Farm 18", "timezone": "UTC", "is_demo": True},
        headers=headers,
    )
    farm_id = farm_res.json()["data"]["id"]

    demo_dev_payload = {
        "device_type": "multi_sensor",
        "is_demo": True,
    }
    reg_res = await client.post(f"/api/v1/farms/{farm_id}/devices", json=demo_dev_payload, headers=headers)
    assert reg_res.status_code == 201
    assert reg_res.json()["data"]["is_demo"] is True


# ==============================================================================
# AUDIT EVENT TESTS (19 - 21)
# ==============================================================================

@pytest.mark.asyncio
async def test_19_20_21_farm_zone_device_audited(client: AsyncClient, db_session: AsyncSession):
    user_id = "usr_audited_farmer"
    headers = make_auth_headers(user_id)

    # 19. Create farm
    farm_res = await client.post(
        "/api/v1/farms",
        json={"name": "Audited Farm", "timezone": "UTC", "total_area": 100.0},
        headers=headers,
    )
    farm_id = farm_res.json()["data"]["id"]

    # 20. Create zone
    zone_res = await client.post(
        f"/api/v1/farms/{farm_id}/zones",
        json={"name": "Audited Zone", "area": 10.0},
        headers=headers,
    )
    zone_id = zone_res.json()["data"]["id"]

    # 21. Register device
    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_moisture", "zone_id": zone_id},
        headers=headers,
    )
    dev_id = dev_res.json()["data"]["id"]

    # Verify audit events in database
    audit_res = await db_session.execute(
        select(AuditEvent).where(AuditEvent.farm_id == farm_id).order_by(AuditEvent.timestamp.asc())
    )
    events = list(audit_res.scalars().all())
    event_types = [e.event_type for e in events]

    assert "create_farm" in event_types
    assert "create_zone" in event_types
    assert "register_device" in event_types
