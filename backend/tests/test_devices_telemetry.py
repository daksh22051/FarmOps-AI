"""
Tests for Devices & Sensor Event Ingestion with Deduplication
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_device_and_sensor_event_deduplication(client: AsyncClient, auth_headers: dict):
    # 1. Create farm & zone
    farm_res = await client.post("/api/v1/farms", json={"name": "IoT Ops Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    zone_res = await client.post(f"/api/v1/farms/{farm_id}/zones", json={"name": "North Field"}, headers=auth_headers)
    zone_id = zone_res.json()["data"]["id"]

    # 2. Register Device
    device_payload = {
        "device_type": "soil_sensor",
        "zone_id": zone_id,
        "credential_reference": "SN-ESP32-DEV101",
        "calibration": {"moisture_offset": -1.5},
    }
    dev_res = await client.post(f"/api/v1/devices/{farm_id}", json=device_payload, headers=auth_headers)
    assert dev_res.status_code == 201
    device_id = dev_res.json()["data"]["id"]

    # 3. Ingest First Telemetry Event (sequence = 1)
    event_1 = {
        "device_id": device_id,
        "zone_id": zone_id,
        "metric": "soil_moisture",
        "value": 28.5,
        "unit": "%",
        "sequence": 1,
        "source": "device",
    }
    ingest_1 = await client.post(f"/api/v1/telemetry/{farm_id}/events", json=event_1)
    assert ingest_1.status_code == 201
    assert ingest_1.json()["data"]["is_duplicate"] is False
    assert ingest_1.json()["data"]["sequence"] == 1

    # 4. Ingest Duplicate Event (same device_id and same sequence = 1)
    ingest_dup = await client.post(f"/api/v1/telemetry/{farm_id}/events", json=event_1)
    assert ingest_dup.status_code == 201
    # Returns existing event without crashing or creating duplicate DB records
    assert ingest_dup.json()["data"]["id"] == ingest_1.json()["data"]["id"]

    # 5. Ingest Next Event (sequence = 2)
    event_2 = {
        "device_id": device_id,
        "zone_id": zone_id,
        "metric": "soil_moisture",
        "value": 31.0,
        "unit": "%",
        "sequence": 2,
    }
    ingest_2 = await client.post(f"/api/v1/telemetry/{farm_id}/events", json=event_2)
    assert ingest_2.status_code == 201
    assert ingest_2.json()["data"]["sequence"] == 2

    # 6. Query Events
    query_res = await client.get(f"/api/v1/telemetry/{farm_id}/events?device_id={device_id}")
    assert query_res.status_code == 200
    events = query_res.json()["data"]
    assert len(events) == 2  # Exactly 2 distinct sequence events
