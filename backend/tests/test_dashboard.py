"""Operational dashboard regressions, using only the isolated test database."""
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from app.models.device import Device
from app.models.sensor_event import SensorEvent
from app.models.risk import RiskAssessment
from app.models.task import Task
from app.services.risk_detection_service import RiskDetectionService


async def setup_farm(client, headers):
    farm = (await client.post("/api/v1/farms", headers=headers, json={"name": "Dashboard test farm"})).json()["data"]
    zones = []
    for name in ["Zone A", "Zone B"]:
        zones.append((await client.post(f"/api/v1/farms/{farm['id']}/zones", headers=headers,
            json={"name": name, "crop": "Wheat"})).json()["data"])
    return farm, zones


@pytest.mark.asyncio
async def test_snapshot_never_claims_health_without_data(client, auth_headers):
    farm, zones = await setup_farm(client, auth_headers)
    response = await client.get(f"/api/v1/farms/{farm['id']}/dashboard", headers=auth_headers)
    assert response.status_code == 200
    snapshot = response.json()["data"]
    assert snapshot["monitoring"]["status"] == "offline"
    assert snapshot["monitoring"]["has_data"] is False
    assert snapshot["monitoring"]["last_reading_at"] is None
    # A zone with no telemetry reports offline freshness and no readings at all.
    assert all(z["telemetry_status"] == "offline" for z in snapshot["zones"])
    assert all(z["readings"] == {} for z in snapshot["zones"])
    assert snapshot["counts"]["risks"] == 0
    assert snapshot["plans"] == []
    assert (await client.get(f"/api/v1/farms/{farm['id']}/dashboard")).status_code == 401


@pytest.mark.asyncio
async def test_scheduled_plan_carries_window_to_task(client, auth_headers):
    farm, _ = await setup_farm(client, auth_headers)
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    end = start + timedelta(hours=2)
    body = {"farm_id": farm["id"], "title": "Inspect drip line", "action_type": "inspect",
        "action_summary": "Inspect drip line", "confidence": 0.95,
        "earliest_at": start.isoformat(), "latest_at": end.isoformat()}
    response = await client.post("/api/v1/action-plans", headers=auth_headers, json=body)
    assert response.status_code == 201
    plan = response.json()["data"]
    if plan["approval_state"] == "pending_approval":
        assert (await client.post(f"/api/v1/action-plans/{plan['id']}/approve", headers=auth_headers, json={})).status_code == 200
    snapshot = (await client.get(f"/api/v1/farms/{farm['id']}/dashboard", headers=auth_headers)).json()["data"]
    task = next(t for t in snapshot["tasks"] if t["plan_id"] == plan["id"])
    assert datetime.fromisoformat(task["due_from"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc) == start
    assert datetime.fromisoformat(task["due_until"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc) == end
    response = await client.post("/api/v1/action-plans", headers=auth_headers, json={**body, "latest_at": (start - timedelta(hours=1)).isoformat()})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_snapshot_freshness_bad_readings_and_zone_isolation(client, auth_headers, db_session):
    farm, zones = await setup_farm(client, auth_headers)
    now = datetime.now(timezone.utc)
    for i, zone in enumerate(zones):
        device = Device(farm_id=farm["id"], zone_id=zone["id"], device_type="soil_sensor")
        db_session.add(device)
        await db_session.flush()
        db_session.add(SensorEvent(device_id=device.id, farm_id=farm["id"], zone_id=zone["id"],
            metric="soil_moisture", value=40, event_at=now - timedelta(hours=3 * i), sequence=1))
        if i == 1:
            db_session.add(SensorEvent(device_id=device.id, farm_id=farm["id"], zone_id=zone["id"],
                metric="soil_moisture", value=50, quality="bad", event_at=now, sequence=2))
    await db_session.commit()
    snapshot = (await client.get(f"/api/v1/farms/{farm['id']}/dashboard", headers=auth_headers)).json()["data"]
    assert snapshot["monitoring"]["status"] == "fresh"
    # Zone 0 reported just now; zone 1's newest good reading is 3h old.
    assert [z["telemetry_status"] for z in snapshot["zones"]] == ["fresh", "stale"]
    # `status` stays the zone's own lifecycle value, never the telemetry freshness.
    assert all(z["status"] not in {"fresh", "stale", "very_stale", "offline"} for z in snapshot["zones"])


@pytest.mark.asyncio
async def test_scan_does_not_duplicate_zone_risk_as_farm_risk_and_resolves_recovery(client, auth_headers, db_session):
    farm, zones = await setup_farm(client, auth_headers)
    device = (await client.post(f"/api/v1/farms/{farm['id']}/devices", headers=auth_headers,
        json={"zone_id": zones[0]["id"], "device_type": "soil_sensor"})).json()["data"]
    async def reading(sequence, moisture):
        result = await client.post("/api/v1/telemetry/events", headers=auth_headers, json={
            "device_id": device["id"], "sequence": sequence, "event_timestamp": datetime.now(timezone.utc).isoformat(),
            "measurements": {"soil_moisture": moisture}})
        assert result.status_code == 201
    await reading(1, 18)
    for _ in range(2):
        scan = await client.post("/api/v1/risks/detect", headers=auth_headers, json={"farm_id": farm["id"]})
        assert scan.status_code == 200
        assert len(scan.json()["data"]) == 1
        assert scan.json()["data"][0]["zone_id"] == zones[0]["id"]
    snapshot = (await client.get(f"/api/v1/farms/{farm['id']}/dashboard", headers=auth_headers)).json()["data"]
    assert snapshot["counts"]["risks"] == 1
    assert snapshot["zones"][1]["risk_ids"] == []
    await reading(2, 45)
    await client.post("/api/v1/risks/detect", headers=auth_headers, json={"farm_id": farm["id"]})
    snapshot = (await client.get(f"/api/v1/farms/{farm['id']}/dashboard", headers=auth_headers)).json()["data"]
    assert snapshot["counts"]["risks"] == 0


@pytest.mark.asyncio
async def test_snapshot_task_lifecycle_and_untruncated_counts(client, auth_headers, db_session):
    farm, _ = await setup_farm(client, auth_headers)
    result = await client.post("/api/v1/tasks", headers=auth_headers, json={"farm_id": farm["id"], "title": "Inspect field", "source": "user"})
    assert result.status_code == 201
    task = result.json()["data"]
    assert (await client.post(f"/api/v1/tasks/{task['id']}/start", headers=auth_headers, json={})).status_code == 200
    assert (await client.post(f"/api/v1/tasks/{task['id']}/complete", headers=auth_headers,
        json={"completion_notes": "Checked all rows"})).status_code == 200
    db_session.add_all([Task(farm_id=farm["id"], status="pending") for _ in range(55)])
    db_session.add(Task(farm_id=farm["id"], status="cancelled"))
    await db_session.commit()
    snapshot = (await client.get(f"/api/v1/farms/{farm['id']}/dashboard", headers=auth_headers)).json()["data"]
    assert snapshot["counts"]["open_tasks"] == 55
    assert len(snapshot["tasks"]) == 12
    assert snapshot["completed_tasks"][0]["completion_notes"] == "Checked all rows"


@pytest.mark.asyncio
async def test_snapshot_denies_other_farm_and_live_ai_refuses_mock(client, auth_headers, db_session, monkeypatch):
    from app.core.security import get_current_user, AuthUser
    from app.main import app
    from app.ai.provider import MockAIProvider
    from app.api.v1.endpoints import ai
    farm, _ = await setup_farm(client, auth_headers)
    risks = await RiskDetectionService.evaluate_zone(db_session, farm["id"], None, {"soil_moisture": 18})
    monkeypatch.setattr(ai, "get_ai_provider", lambda: MockAIProvider())
    response = await client.post("/api/v1/ai/evaluate-risk", headers=auth_headers,
        json={"risk_id": risks[0].id, "require_live": True})
    assert response.status_code == 503
    async def stranger():
        return AuthUser(id="unrelated-user", email="other@example.com", role="authenticated")
    app.dependency_overrides[get_current_user] = stranger
    try:
        response = await client.get(f"/api/v1/farms/{farm['id']}/dashboard", headers=auth_headers)
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
