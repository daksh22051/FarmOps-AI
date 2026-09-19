"""
Tests for Farm, Zone, and FarmMembership Management
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_farm_zone_membership_lifecycle(client: AsyncClient, auth_headers: dict):
    # 1. Create Farm
    farm_payload = {
        "name": "Salinas Valley Test Farm",
        "location": "Salinas, CA",
        "address": "123 Farming Lane",
        "timezone": "America/Los_Angeles",
        "total_area": 150.0,
        "area_unit": "hectare",
        "crop_profile": {"primary_crop": "Tomato", "season": "Summer 2026"},
    }
    farm_res = await client.post("/api/v1/farms", json=farm_payload, headers=auth_headers)
    assert farm_res.status_code == 201
    farm_data = farm_res.json()["data"]
    farm_id = farm_data["id"]
    assert farm_data["name"] == farm_payload["name"]
    assert farm_data["timezone"] == "America/Los_Angeles"

    # 2. Add Zone
    zone_payload = {
        "name": "Zone A - Precision Drip",
        "area": 45.0,
        "area_unit": "hectare",
        "crop": "Tomato",
        "crop_stage": "flowering",
        "soil_type": "Clay Loam",
        "status": "active",
    }
    zone_res = await client.post(f"/api/v1/farms/{farm_id}/zones", json=zone_payload, headers=auth_headers)
    assert zone_res.status_code == 201
    zone_data = zone_res.json()["data"]
    zone_id = zone_data["id"]
    assert zone_data["crop_stage"] == "flowering"

    # 3. Add Farm Membership (e.g. Agronomist)
    member_payload = {
        "user_id": "usr_agronomist_99",
        "role": "agronomist",
    }
    member_res = await client.post(f"/api/v1/farms/{farm_id}/members", json=member_payload, headers=auth_headers)
    assert member_res.status_code == 201
    assert member_res.json()["data"]["role"] == "agronomist"

    # 4. List Farm Zones
    list_zones = await client.get(f"/api/v1/farms/{farm_id}/zones", headers=auth_headers)
    assert list_zones.status_code == 200
    assert len(list_zones.json()["data"]) >= 1

    # 5. List Farm Memberships
    list_members = await client.get(f"/api/v1/farms/{farm_id}/members", headers=auth_headers)
    assert list_members.status_code == 200
    assert len(list_members.json()["data"]) >= 2  # Owner + Agronomist
