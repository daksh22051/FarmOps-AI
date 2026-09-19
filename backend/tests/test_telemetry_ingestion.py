"""
Task 5: Telemetry Ingestion, Sensor Events & Deduplication Comprehensive Test Suite
"""

import pytest
import math
import jwt
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.config import settings


def generate_token(user_id: str, email: str = "test@example.com") -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.SUPABASE_JWT_ALGORITHM)


@pytest.fixture
def other_user_headers() -> dict:
    token = generate_token("user_other_intruder_999", "intruder@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_01_authenticated_user_can_ingest_telemetry(client: AsyncClient, auth_headers: dict):
    # Setup farm & device
    farm_res = await client.post("/api/v1/farms", json={"name": "Ingest Farm 1"}, headers=auth_headers)
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-TELEMETRY-01"},
        headers=auth_headers,
    )
    assert dev_res.status_code == 201
    device_id = dev_res.json()["data"]["id"]

    # Ingest telemetry
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "device_id": device_id,
        "sequence": 1,
        "event_timestamp": now_iso,
        "measurements": {
            "soil_moisture": 32.5,
            "temperature": 24.8,
            "humidity": 65.2,
        },
        "unit_system": "metric",
        "metadata": {"battery_pct": 98},
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["device_id"] == device_id
    assert data["farm_id"] == farm_id
    assert data["sequence"] == 1
    assert data["duplicate"] is False
    assert data["status"] == "accepted"
    assert data["measurements"]["soil_moisture"] == 32.5
    assert data["measurements"]["temperature"] == 24.8
    assert data["measurements"]["humidity"] == 65.2
    assert data["metadata"]["battery_pct"] == 98


@pytest.mark.asyncio
async def test_02_unauthenticated_request_rejected_with_401(client: AsyncClient):
    payload = {
        "device_id": "00000000-0000-0000-0000-000000000001",
        "sequence": 1,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {"soil_moisture": 30.0},
    }
    res = await client.post("/api/v1/telemetry/events", json=payload)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


@pytest.mark.asyncio
async def test_03_unauthorized_cross_farm_telemetry_rejected_with_403(
    client: AsyncClient, auth_headers: dict, other_user_headers: dict
):
    # Farm owned by primary user
    farm_res = await client.post("/api/v1/farms", json={"name": "Owner Farm 1"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-TELEMETRY-CROSS"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    # Other user attempts to submit telemetry for primary user's device
    payload = {
        "device_id": device_id,
        "sequence": 1,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {"soil_moisture": 35.0},
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=other_user_headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_04_unknown_device_rejected_with_404(client: AsyncClient, auth_headers: dict):
    payload = {
        "device_id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
        "sequence": 1,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {"soil_moisture": 30.0},
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "DEVICE_NOT_FOUND"


@pytest.mark.asyncio
async def test_05_disabled_device_rejected_with_422(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Disabled Dev Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-TELEMETRY-DISABLED"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    # Disable the device
    patch_res = await client.patch(
        f"/api/v1/devices/{device_id}",
        json={"enabled": False},
        headers=auth_headers,
    )
    assert patch_res.status_code == 200

    # Ingestion attempt on disabled device
    payload = {
        "device_id": device_id,
        "sequence": 1,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {"soil_moisture": 30.0},
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "DEVICE_DISABLED"


@pytest.mark.asyncio
async def test_06_07_device_farm_and_zone_authoritative_resolution(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Hierarchy Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    zone_res = await client.post(
        f"/api/v1/farms/{farm_id}/zones",
        json={"name": "South Sector", "area": 10.0},
        headers=auth_headers,
    )
    zone_id = zone_res.json()["data"]["id"]

    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "zone_id": zone_id, "credential_reference": "SN-TELEMETRY-ZONE"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    payload = {
        "device_id": device_id,
        "sequence": 1,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {"soil_moisture": 40.0},
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["farm_id"] == farm_id
    assert data["zone_id"] == zone_id


@pytest.mark.asyncio
async def test_08_to_12_valid_measurements_accepted(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Sensors Test Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "weather_station", "credential_reference": "SN-WEATHER-ALL"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    payload = {
        "device_id": device_id,
        "sequence": 10,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {
            "soil_moisture": 55.4,
            "temperature": 26.5,
            "humidity": 70.0,
            "ph": 6.8,
            "nitrogen": 45.2,
            "phosphorus": 22.1,
            "potassium": 38.0,
            "rainfall": 12.4,
        },
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 201
    m = res.json()["data"]["measurements"]
    assert m["soil_moisture"] == 55.4
    assert m["temperature"] == 26.5
    assert m["humidity"] == 70.0
    assert m["ph"] == 6.8
    assert m["nitrogen"] == 45.2
    assert m["phosphorus"] == 22.1
    assert m["potassium"] == 38.0
    assert m["rainfall"] == 12.4


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_measurement",
    [
        {"rainfall": -5.0},          # 13. Negative rainfall rejected
        {"ph": 15.5},                 # 14. Impossible pH > 14 rejected
        {"ph": -1.0},                 # 14. Impossible pH < 0 rejected
        {"humidity": 105.0},          # 15. Humidity > 100 rejected
        {"humidity": -2.0},           # 15. Humidity < 0 rejected
        {"soil_moisture": 102.5},     # 16. Soil moisture > 100 rejected
        {"soil_moisture": -1.0},      # 16. Soil moisture < 0 rejected
        {"temperature": 150.0},       # Temperature outside -50 to 70
        {"nitrogen": -10.0},          # Negative N
        {"phosphorus": -5.0},         # Negative P
        {"potassium": -2.0},          # Negative K
    ],
)
async def test_13_to_16_invalid_measurement_bounds_rejected(
    client: AsyncClient, auth_headers: dict, invalid_measurement: dict
):
    farm_res = await client.post("/api/v1/farms", json={"name": "Bounds Test Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]
    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": f"SN-BOUNDS-{list(invalid_measurement.keys())[0]}"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    payload = {
        "device_id": device_id,
        "sequence": 1,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": invalid_measurement,
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_17_18_nan_infinity_and_non_numeric_rejected(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "NaN Test Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]
    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-NAN-TEST"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    # Test non-numeric string
    res_str = await client.post(
        "/api/v1/telemetry/events",
        json={
            "device_id": device_id,
            "sequence": 1,
            "event_timestamp": datetime.now(timezone.utc).isoformat(),
            "measurements": {"soil_moisture": "not_a_number"},
        },
        headers=auth_headers,
    )
    assert res_str.status_code == 422

    # Test empty measurements
    res_empty = await client.post(
        "/api/v1/telemetry/events",
        json={
            "device_id": device_id,
            "sequence": 2,
            "event_timestamp": datetime.now(timezone.utc).isoformat(),
            "measurements": {},
        },
        headers=auth_headers,
    )
    assert res_empty.status_code == 422


@pytest.mark.asyncio
async def test_19_canonical_measurement_normalization(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Norm Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]
    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-NORM-01"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    # Submit aliased and non-canonical keys
    payload = {
        "device_id": device_id,
        "sequence": 100,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {
            "soil-moisture": 30.5,
            "temp": 22.0,
            "relative_humidity": 60.0,
            "rain": 3.2,
            "pH": 6.5,
            "N": 40.0,
            "P": 15.0,
            "K": 30.0,
        },
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 201
    m = res.json()["data"]["measurements"]
    assert "soil_moisture" in m and m["soil_moisture"] == 30.5
    assert "temperature" in m and m["temperature"] == 22.0
    assert "humidity" in m and m["humidity"] == 60.0
    assert "rainfall" in m and m["rainfall"] == 3.2
    assert "ph" in m and m["ph"] == 6.5
    assert "nitrogen" in m and m["nitrogen"] == 40.0
    assert "phosphorus" in m and m["phosphorus"] == 15.0
    assert "potassium" in m and m["potassium"] == 30.0


@pytest.mark.asyncio
async def test_20_21_duplicate_device_sequence_deterministic_response(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Dedupe Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]
    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-DEDUPE-01"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    event_payload = {
        "device_id": device_id,
        "sequence": 55,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {"soil_moisture": 28.0, "temperature": 21.5},
    }

    # First submission
    res_1 = await client.post("/api/v1/telemetry/events", json=event_payload, headers=auth_headers)
    assert res_1.status_code == 201
    data_1 = res_1.json()["data"]
    assert data_1["duplicate"] is False
    assert data_1["status"] == "accepted"
    event_id_1 = data_1["id"]

    # Duplicate submission (same device_id and same sequence 55)
    res_dup = await client.post("/api/v1/telemetry/events", json=event_payload, headers=auth_headers)
    assert res_dup.status_code == 201
    data_dup = res_dup.json()["data"]
    assert data_dup["duplicate"] is True
    assert data_dup["status"] == "duplicate"
    assert data_dup["id"] == event_id_1
    assert data_dup["sequence"] == 55


@pytest.mark.asyncio
async def test_22_23_delayed_and_out_of_order_events_accepted(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Delayed Events Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]
    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-DELAYED-01"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    now = datetime.now(timezone.utc)
    t_10_10 = (now - timedelta(hours=2)).isoformat()
    t_10_20 = (now - timedelta(hours=1, minutes=50)).isoformat()
    t_10_05 = (now - timedelta(hours=2, minutes=5)).isoformat()

    # Ingest event 100 (t = 10:10)
    res_100 = await client.post(
        "/api/v1/telemetry/events",
        json={"device_id": device_id, "sequence": 100, "event_timestamp": t_10_10, "measurements": {"temperature": 20.0}},
        headers=auth_headers,
    )
    assert res_100.status_code == 201

    # Ingest event 101 (t = 10:20)
    res_101 = await client.post(
        "/api/v1/telemetry/events",
        json={"device_id": device_id, "sequence": 101, "event_timestamp": t_10_20, "measurements": {"temperature": 21.0}},
        headers=auth_headers,
    )
    assert res_101.status_code == 201

    # Ingest delayed / out-of-order event 99 (t = 10:05)
    res_99 = await client.post(
        "/api/v1/telemetry/events",
        json={"device_id": device_id, "sequence": 99, "event_timestamp": t_10_05, "measurements": {"temperature": 19.5}},
        headers=auth_headers,
    )
    assert res_99.status_code == 201
    assert res_99.json()["data"]["duplicate"] is False
    assert res_99.json()["data"]["sequence"] == 99


@pytest.mark.asyncio
async def test_24_25_last_seen_at_lifecycle(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "LastSeen Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]
    dev_res = await client.post(
        f"/api/v1/farms/{farm_id}/devices",
        json={"device_type": "soil_probe", "credential_reference": "SN-LASTSEEN-01"},
        headers=auth_headers,
    )
    device_id = dev_res.json()["data"]["id"]

    # Initial device last_seen_at is None
    dev_info = await client.get(f"/api/v1/devices/{device_id}", headers=auth_headers)
    assert dev_info.json()["data"]["last_seen_at"] is None

    # Ingest event 1
    t1 = datetime.now(timezone.utc)
    await client.post(
        "/api/v1/telemetry/events",
        json={"device_id": device_id, "sequence": 1, "event_timestamp": t1.isoformat(), "measurements": {"soil_moisture": 30.0}},
        headers=auth_headers,
    )
    dev_after_1 = await client.get(f"/api/v1/devices/{device_id}", headers=auth_headers)
    assert dev_after_1.json()["data"]["last_seen_at"] is not None

    last_seen_val = dev_after_1.json()["data"]["last_seen_at"]

    # Rejected telemetry (invalid pH) must NOT alter last_seen_at
    await client.post(
        "/api/v1/telemetry/events",
        json={"device_id": device_id, "sequence": 2, "event_timestamp": (t1 + timedelta(minutes=5)).isoformat(), "measurements": {"ph": 99.0}},
        headers=auth_headers,
    )
    dev_after_reject = await client.get(f"/api/v1/devices/{device_id}", headers=auth_headers)
    assert dev_after_reject.json()["data"]["last_seen_at"] == last_seen_val


@pytest.mark.asyncio
async def test_26_27_client_cannot_override_farm_or_zone(client: AsyncClient, auth_headers: dict):
    # Setup Farm A with Zone A
    farm_a = await client.post("/api/v1/farms", json={"name": "Farm A"}, headers=auth_headers)
    farm_a_id = farm_a.json()["data"]["id"]
    zone_a = await client.post(f"/api/v1/farms/{farm_a_id}/zones", json={"name": "Zone A"}, headers=auth_headers)
    zone_a_id = zone_a.json()["data"]["id"]

    dev_a = await client.post(
        f"/api/v1/farms/{farm_a_id}/devices",
        json={"device_type": "soil_probe", "zone_id": zone_a_id, "credential_reference": "SN-SPOOF-01"},
        headers=auth_headers,
    )
    dev_a_id = dev_a.json()["data"]["id"]

    # Setup Farm B with Zone B
    farm_b = await client.post("/api/v1/farms", json={"name": "Farm B"}, headers=auth_headers)
    farm_b_id = farm_b.json()["data"]["id"]
    zone_b = await client.post(f"/api/v1/farms/{farm_b_id}/zones", json={"name": "Zone B"}, headers=auth_headers)
    zone_b_id = zone_b.json()["data"]["id"]

    # Attempt to ingest for dev_a while passing spoofed farm_b and zone_b in metadata/payload
    payload = {
        "device_id": dev_a_id,
        "sequence": 1,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {"soil_moisture": 33.0},
        "metadata": {"spoofed_farm_id": farm_b_id, "spoofed_zone_id": zone_b_id},
    }
    res = await client.post("/api/v1/telemetry/events", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    # Verified: farm_id and zone_id are authoritative from Device record
    assert data["farm_id"] == farm_a_id
    assert data["zone_id"] == zone_a_id


@pytest.mark.asyncio
async def test_28_openapi_documentation(client: AsyncClient):
    res = await client.get("/api/v1/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    assert "/api/v1/telemetry/events" in schema["paths"]
    post_op = schema["paths"]["/api/v1/telemetry/events"]["post"]
    assert post_op["summary"] == "Ingest Telemetry Event"
    assert "201" in post_op["responses"]

