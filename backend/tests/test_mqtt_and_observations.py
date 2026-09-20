"""
Task 6: MQTT Telemetry Ingestion + External Observation Pipeline Comprehensive Test Suite
"""

import pytest
import json
import asyncio
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.device import Device
from app.models.farm import Farm, Zone
from app.models.sensor_event import SensorEvent
from app.models.external_observation import ExternalObservation
from app.models.audit import AuditEvent
from app.mqtt.handlers import parse_topic, extract_measurements, handle_telemetry_message
from app.mqtt.client import MQTTWorker, mqtt_worker


# ==============================================================================
# 1. MQTT INGESTION TESTS
# ==============================================================================

def test_01_mqtt_disabled_does_not_start_consumer():
    worker = MQTTWorker()
    with patch.object(settings, "MQTT_ENABLED", False):
        asyncio.run(worker.start())
        assert worker.is_running is False
        assert worker.task is None


def test_02_mqtt_configuration_loads_correctly():
    assert hasattr(settings, "MQTT_BROKER_HOST")
    assert hasattr(settings, "MQTT_BROKER_PORT")
    assert hasattr(settings, "MQTT_CLIENT_ID")
    assert hasattr(settings, "MQTT_TOPIC_PREFIX")
    assert settings.MQTT_TOPIC_PREFIX == "farmops"


def test_03_topic_parsing_multi_patterns():
    # farmops/{farm_id}/{device_id}/telemetry
    res1 = parse_topic("farmops/farm-123/dev-456/telemetry")
    assert res1 == ("farm-123", "dev-456")

    # farmops/{farm_id}/devices/{device_id}/telemetry
    res2 = parse_topic("farmops/farm-123/devices/dev-456/telemetry")
    assert res2 == ("farm-123", "dev-456")

    # farmops/{farm_id}/nodes/{device_id}/telemetry
    res3 = parse_topic("farmops/farm-123/nodes/dev-456/telemetry")
    assert res3 == ("farm-123", "dev-456")

    # farmops/devices/{device_id}/telemetry
    res4 = parse_topic("farmops/devices/dev-456/telemetry")
    assert res4 == (None, "dev-456")

    # farmops/{device_id}/telemetry
    res5 = parse_topic("farmops/dev-456/telemetry")
    assert res5 == (None, "dev-456")

    # Invalid topics
    assert parse_topic("invalid/topic") is None
    assert parse_topic("") is None


def test_03_extract_measurements_nested_and_flat():
    # Nested
    m1 = extract_measurements({"measurements": {"soil_moisture": 30.0, "temp": 22.5}})
    assert m1 == {"soil_moisture": 30.0, "temp": 22.5}

    # Flat recognized
    m2 = extract_measurements({"device_id": "d1", "sequence": 1, "soil_moisture": 35.0, "humidity": 70.0, "random_key": "abc"})
    assert "soil_moisture" in m2
    assert "humidity" in m2
    assert "random_key" not in m2


@pytest.mark.asyncio
async def test_04_mqtt_telemetry_persisted_to_database(db_session: AsyncSession):
    # Setup farm and device
    farm = Farm(name="MQTT Farm", owner_id="owner-mqtt-1")
    db_session.add(farm)
    await db_session.commit()

    device = Device(farm_id=farm.id, device_type="soil_probe", credential_reference="SN-MQTT-001")
    db_session.add(device)
    await db_session.commit()

    # MQTT message payload
    topic = f"farmops/{farm.id}/{device.id}/telemetry"
    payload = {
        "sequence": 10,
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "measurements": {
            "soil_moisture": 33.4,
            "temp": 25.6,
            "humidity": 68.2,
        },
        "metadata": {"rssi": -65},
    }
    raw_bytes = json.dumps(payload).encode("utf-8")

    success = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert success is True

    # Verify SensorEvent persisted
    q = select(SensorEvent).where(SensorEvent.device_id == device.id, SensorEvent.sequence == 10)
    res = await db_session.execute(q)
    event = res.scalar_one_or_none()
    assert event is not None
    assert event.source == "mqtt"
    assert event.measurements["soil_moisture"] == 33.4
    assert event.measurements["temperature"] == 25.6
    assert event.measurements["humidity"] == 68.2

    # Verify device last_seen_at updated
    await db_session.refresh(device)
    assert device.last_seen_at is not None


@pytest.mark.asyncio
async def test_05_malformed_json_rejected_safely(db_session: AsyncSession):
    topic = "farmops/farm-1/dev-1/telemetry"
    bad_bytes = b"not_a_valid_json_string{["
    success = await handle_telemetry_message(db_session, topic, bad_bytes)
    assert success is False


@pytest.mark.asyncio
async def test_06_missing_sequence_rejected_safely(db_session: AsyncSession):
    farm = Farm(name="MQTT Farm Seq", owner_id="owner-mqtt-2")
    db_session.add(farm)
    await db_session.commit()

    device = Device(farm_id=farm.id, device_type="soil_probe")
    db_session.add(device)
    await db_session.commit()

    topic = f"farmops/{farm.id}/{device.id}/telemetry"
    payload = {"measurements": {"soil_moisture": 30.0}}
    raw_bytes = json.dumps(payload).encode("utf-8")

    success = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert success is False


@pytest.mark.asyncio
async def test_07_missing_measurements_rejected_safely(db_session: AsyncSession):
    farm = Farm(name="MQTT Farm Empty", owner_id="owner-mqtt-3")
    db_session.add(farm)
    await db_session.commit()

    device = Device(farm_id=farm.id, device_type="soil_probe")
    db_session.add(device)
    await db_session.commit()

    topic = f"farmops/{farm.id}/{device.id}/telemetry"
    payload = {"sequence": 1, "measurements": {}}
    raw_bytes = json.dumps(payload).encode("utf-8")

    success = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert success is False


@pytest.mark.asyncio
async def test_08_unknown_device_handled_safely(db_session: AsyncSession):
    topic = "farmops/unknown-farm/00000000-0000-0000-0000-000000000099/telemetry"
    payload = {"sequence": 1, "measurements": {"soil_moisture": 30.0}}
    raw_bytes = json.dumps(payload).encode("utf-8")

    success = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert success is False


@pytest.mark.asyncio
async def test_09_disabled_device_handled_safely(db_session: AsyncSession):
    farm = Farm(name="MQTT Farm Disabled", owner_id="owner-mqtt-4")
    db_session.add(farm)
    await db_session.commit()

    device = Device(farm_id=farm.id, device_type="soil_probe", enabled=False)
    db_session.add(device)
    await db_session.commit()

    topic = f"farmops/{farm.id}/{device.id}/telemetry"
    payload = {"sequence": 1, "measurements": {"soil_moisture": 30.0}}
    raw_bytes = json.dumps(payload).encode("utf-8")

    success = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert success is False


@pytest.mark.asyncio
async def test_10_invalid_measurements_handled_safely(db_session: AsyncSession):
    farm = Farm(name="MQTT Farm Bounds", owner_id="owner-mqtt-5")
    db_session.add(farm)
    await db_session.commit()

    device = Device(farm_id=farm.id, device_type="soil_probe")
    db_session.add(device)
    await db_session.commit()

    topic = f"farmops/{farm.id}/{device.id}/telemetry"
    payload = {"sequence": 1, "measurements": {"ph": 99.0}}
    raw_bytes = json.dumps(payload).encode("utf-8")

    success = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert success is False


@pytest.mark.asyncio
async def test_11_duplicate_telemetry_remains_idempotent(db_session: AsyncSession):
    farm = Farm(name="MQTT Farm Dedupe", owner_id="owner-mqtt-6")
    db_session.add(farm)
    await db_session.commit()

    device = Device(farm_id=farm.id, device_type="soil_probe")
    db_session.add(device)
    await db_session.commit()

    topic = f"farmops/{farm.id}/{device.id}/telemetry"
    payload = {"sequence": 42, "measurements": {"soil_moisture": 31.0}}
    raw_bytes = json.dumps(payload).encode("utf-8")

    # First delivery
    res1 = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert res1 is True

    # Duplicate delivery
    res2 = await handle_telemetry_message(db_session, topic, raw_bytes)
    assert res2 is True

    # Ensure only 1 row exists
    q = select(SensorEvent).where(SensorEvent.device_id == device.id, SensorEvent.sequence == 42)
    res = await db_session.execute(q)
    events = res.scalars().all()
    assert len(events) == 1


@pytest.mark.asyncio
async def test_12_database_error_handled_resiliently():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.execute.side_effect = RuntimeError("Simulated DB connection failure")

    topic = "farmops/farm-1/dev-1/telemetry"
    payload = {"sequence": 1, "measurements": {"soil_moisture": 30.0}}
    raw_bytes = json.dumps(payload).encode("utf-8")

    # Does not crash, returns False safely
    success = await handle_telemetry_message(mock_session, topic, raw_bytes)
    assert success is False
    mock_session.rollback.assert_awaited()


def test_13_reconnect_backoff_and_status():
    worker = MQTTWorker()
    assert worker._current_reconnect_interval == 2.0
    status_dict = worker.get_status()
    assert "enabled" in status_dict
    assert "connected" in status_dict
    assert "password" not in status_dict
    assert "MQTT_PASSWORD" not in status_dict


@pytest.mark.asyncio
async def test_14_shutdown_cleans_up_worker():
    worker = MQTTWorker()
    worker.is_running = True
    worker.task = asyncio.create_task(asyncio.sleep(10))
    await worker.stop()
    assert worker.is_running is False
    assert worker.task is None


# ==============================================================================
# 2. EXTERNAL OBSERVATIONS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_16_authorized_user_can_create_observation(client: AsyncClient, auth_headers: dict):
    # Setup farm
    farm_res = await client.post("/api/v1/farms", json={"name": "Observation Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    obs_payload = {
        "farm_id": farm_id,
        "source": "openmeteo",
        "observation_type": "weather_forecast",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "temperature_c": 28.5,
            "humidity_pct": 65.0,
            "precipitation_mm": 4.2,
            "wind_speed_kmh": 14.0,
        },
        "source_reference": "station-wx-001",
    }
    res = await client.post("/api/v1/observations", json=obs_payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["farm_id"] == farm_id
    assert data["source"] == "openmeteo"
    assert data["observation_type"] == "weather_forecast"
    assert data["payload"]["temperature_c"] == 28.5
    assert data["duplicate"] is False


@pytest.mark.asyncio
async def test_17_unauthenticated_observation_rejected_with_401(client: AsyncClient):
    obs_payload = {
        "farm_id": "00000000-0000-0000-0000-000000000001",
        "source": "weather",
        "observation_type": "rainfall",
        "payload": {"rain": 5.0},
    }
    res = await client.post("/api/v1/observations", json=obs_payload)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


@pytest.mark.asyncio
async def test_18_cross_farm_observation_rejected_with_403(client: AsyncClient, auth_headers: dict):
    # Primary user farm
    farm_res = await client.post("/api/v1/farms", json={"name": "Primary Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Other user token
    import jwt
    other_token = jwt.encode(
        {
            "sub": "intruder-user-777",
            "email": "intruder@example.com",
            "role": "authenticated",
            # Must carry `exp`: without it the token is rejected as malformed (401)
            # and the cross-tenant authorization path under test is never reached.
            "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
        },
        settings.SUPABASE_JWT_SECRET,
        algorithm=settings.SUPABASE_JWT_ALGORITHM,
    )
    other_headers = {"Authorization": f"Bearer {other_token}"}

    obs_payload = {
        "farm_id": farm_id,
        "source": "weather",
        "observation_type": "rainfall",
        "payload": {"rain": 5.0},
    }
    res = await client.post("/api/v1/observations", json=obs_payload, headers=other_headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_19_cross_farm_zone_rejected_with_422(client: AsyncClient, auth_headers: dict):
    # Farm 1
    farm1 = await client.post("/api/v1/farms", json={"name": "Farm 1"}, headers=auth_headers)
    farm1_id = farm1.json()["data"]["id"]

    # Farm 2 with Zone 2
    farm2 = await client.post("/api/v1/farms", json={"name": "Farm 2"}, headers=auth_headers)
    farm2_id = farm2.json()["data"]["id"]
    zone2 = await client.post(f"/api/v1/farms/{farm2_id}/zones", json={"name": "Zone 2"}, headers=auth_headers)
    zone2_id = zone2.json()["data"]["id"]

    # Attempt to link Farm 1 observation with Farm 2's Zone 2
    obs_payload = {
        "farm_id": farm1_id,
        "zone_id": zone2_id,
        "source": "sentinel_2",
        "observation_type": "satellite_ndvi",
        "payload": {"ndvi_mean": 0.72},
    }
    res = await client.post("/api/v1/observations", json=obs_payload, headers=auth_headers)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_ZONE_ASSOCIATION"


@pytest.mark.asyncio
async def test_20_valid_flexible_payload_persisted(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Satellite Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Complex NDVI satellite payload
    payload = {
        "ndvi_mean": 0.78,
        "ndvi_min": 0.45,
        "ndvi_max": 0.91,
        "cloud_coverage_pct": 2.1,
        "bands": {"B04_red": 0.08, "B08_nir": 0.52},
    }
    obs_payload = {
        "farm_id": farm_id,
        "source": "sentinel_2",
        "observation_type": "satellite_ndvi",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
        "source_reference": "S2B_MSIL2A_20260919",
    }
    res = await client.post("/api/v1/observations", json=obs_payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["data"]["payload"] == payload


@pytest.mark.asyncio
async def test_21_empty_payload_rejected_with_422(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Empty Payload Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    obs_payload = {
        "farm_id": farm_id,
        "source": "weather",
        "observation_type": "rainfall",
        "payload": {},
    }
    res = await client.post("/api/v1/observations", json=obs_payload, headers=auth_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_22_duplicate_source_observation_handled_deterministically(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Dedupe Obs Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    ts = datetime.now(timezone.utc).isoformat()
    obs_payload = {
        "farm_id": farm_id,
        "source": "usda_nass",
        "observation_type": "soil_survey",
        "observed_at": ts,
        "payload": {"soil_type": "clay_loam", "organic_matter_pct": 3.4},
        "source_reference": "SURVEY-2026-NASS-01",
    }

    # First submission
    res1 = await client.post("/api/v1/observations", json=obs_payload, headers=auth_headers)
    assert res1.status_code == 201
    data1 = res1.json()["data"]
    assert data1["duplicate"] is False
    obs_id1 = data1["id"]

    # Duplicate submission
    res2 = await client.post("/api/v1/observations", json=obs_payload, headers=auth_headers)
    assert res2.status_code == 201
    data2 = res2.json()["data"]
    assert data2["duplicate"] is True
    assert data2["id"] == obs_id1


@pytest.mark.asyncio
async def test_23_audit_event_recorded_for_observation(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Audit Obs Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    obs_payload = {
        "farm_id": farm_id,
        "source": "drone_multispec",
        "observation_type": "canopy_health",
        "payload": {"canopy_cover_pct": 88.5},
        "source_reference": "FLIGHT-2026-09-19",
    }
    res = await client.post("/api/v1/observations", json=obs_payload, headers=auth_headers)
    assert res.status_code == 201
    obs_id = res.json()["data"]["id"]

    # Check audit_events table
    audit_res = await client.get(f"/api/v1/audit/events?farm_id={farm_id}", headers=auth_headers)
    assert audit_res.status_code == 200
    events = audit_res.json()["data"]
    matching = [e for e in events if e.get("entity_type") == "external_observation" and e.get("entity_id") == obs_id]
    assert len(matching) >= 1



@pytest.mark.asyncio
async def test_24_list_farm_observations_with_filters(client: AsyncClient, auth_headers: dict):
    farm_res = await client.post("/api/v1/farms", json={"name": "Query Obs Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Ingest 2 observations from different sources
    await client.post(
        "/api/v1/observations",
        json={"farm_id": farm_id, "source": "openmeteo", "observation_type": "weather", "payload": {"temp": 25.0}},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/observations",
        json={"farm_id": farm_id, "source": "sentinel_2", "observation_type": "satellite_ndvi", "payload": {"ndvi": 0.8}},
        headers=auth_headers,
    )

    # Query all
    list_res = await client.get(f"/api/v1/observations/farm/{farm_id}", headers=auth_headers)
    assert list_res.status_code == 200
    assert list_res.json()["data"]["total"] >= 2

    # Query with filter source=sentinel_2
    filter_res = await client.get(f"/api/v1/observations/farm/{farm_id}?source=sentinel_2", headers=auth_headers)
    assert filter_res.status_code == 200
    items = filter_res.json()["data"]["items"]
    assert all(i["source"] == "sentinel_2" for i in items)


@pytest.mark.asyncio
async def test_25_openapi_documentation(client: AsyncClient):
    res = await client.get("/api/v1/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    assert "/api/v1/observations" in schema["paths"]
    assert "/api/v1/observations/farm/{farm_id}" in schema["paths"]
    post_op = schema["paths"]["/api/v1/observations"]["post"]
    assert post_op["summary"] == "Ingest External Observation"


@pytest.mark.asyncio
async def test_26_health_endpoint_includes_mqtt_status(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert "mqtt" in data
    assert data["mqtt"]["enabled"] == settings.MQTT_ENABLED
    assert data["mqtt"]["connected"] is False
    assert "password" not in data["mqtt"]
