"""Regression tests for the PRD contract surface added on top of the original API.

Covers tenant scoping on unscoped collection endpoints, the task state machine,
the plan decision endpoint (including reschedule), zone readings, and the
production gating of simulator controls.
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.models.device import Device
from app.models.sensor_event import SensorEvent


def make_token(user_id: str, email: str = "other@example.com") -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "role": "authenticated",
            "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
        },
        settings.SUPABASE_JWT_SECRET,
        algorithm=settings.SUPABASE_JWT_ALGORITHM,
    )


async def make_farm(client, headers, name="Contract Farm"):
    return (await client.post("/api/v1/farms", headers=headers, json={"name": name})).json()["data"]


async def make_zone(client, headers, farm_id, name="Zone A"):
    return (
        await client.post(
            f"/api/v1/farms/{farm_id}/zones", headers=headers, json={"name": name, "crop": "Wheat"}
        )
    ).json()["data"]


# ==============================================================================
# Tenant scoping on collection endpoints that accept an OPTIONAL farm_id
# ==============================================================================


@pytest.mark.asyncio
async def test_audit_feed_without_farm_id_does_not_leak_other_tenants(client, auth_headers):
    """An unscoped audit query must not return another user's history."""
    mine = await make_farm(client, auth_headers, "My Farm")
    await make_zone(client, auth_headers, mine["id"])

    intruder = {"Authorization": f"Bearer {make_token('contract-intruder-1')}"}
    theirs = await make_farm(client, intruder, "Their Farm")
    await make_zone(client, intruder, theirs["id"])

    res = await client.get("/api/v1/audit", headers=auth_headers)
    assert res.status_code == 200
    farm_ids = {e["farm_id"] for e in res.json()["data"] if e["farm_id"]}
    assert theirs["id"] not in farm_ids
    assert farm_ids <= {mine["id"]}


@pytest.mark.asyncio
async def test_timeline_and_changes_are_scoped_and_paginated(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Timeline Farm")
    await make_zone(client, auth_headers, farm["id"])

    timeline = await client.get("/api/v1/timeline", params={"farm_id": farm["id"]}, headers=auth_headers)
    assert timeline.status_code == 200
    body = timeline.json()
    assert body["meta"]["total"] >= 1
    assert {"limit", "offset", "has_more"} <= body["meta"].keys()

    changes = await client.get("/api/v1/changes", params={"farm_id": farm["id"]}, headers=auth_headers)
    assert changes.status_code == 200
    payload = changes.json()
    assert payload["meta"]["next_cursor"]
    for event in payload["data"]:
        # The realtime envelope the PRD specifies.
        assert {"eventId", "eventType", "farmId", "entityId", "occurredAt"} <= event.keys()


@pytest.mark.asyncio
async def test_changes_since_cursor_excludes_already_seen_events(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Cursor Farm")
    first = await client.get("/api/v1/changes", params={"farm_id": farm["id"]}, headers=auth_headers)
    cursor = first.json()["meta"]["next_cursor"]

    second = await client.get(
        "/api/v1/changes", params={"farm_id": farm["id"], "since": cursor}, headers=auth_headers
    )
    assert second.status_code == 200
    assert second.json()["data"] == []

    await make_zone(client, auth_headers, farm["id"], "Zone Fresh")
    third = await client.get(
        "/api/v1/changes", params={"farm_id": farm["id"], "since": cursor}, headers=auth_headers
    )
    assert len(third.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_escalation_queue_is_scoped_to_caller(client, auth_headers):
    intruder = {"Authorization": f"Bearer {make_token('contract-intruder-2')}"}
    theirs = await make_farm(client, intruder, "Their Escalation Farm")

    res = await client.get("/api/v1/escalations", headers=auth_headers)
    assert res.status_code == 200
    assert all(e["farm_id"] != theirs["id"] for e in res.json()["data"])


# ==============================================================================
# Collection aliases required by the PRD
# ==============================================================================


@pytest.mark.asyncio
async def test_query_param_collection_aliases_exist(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Alias Farm")
    for path in ("/api/v1/dashboard", "/api/v1/risks", "/api/v1/tasks", "/api/v1/alerts", "/api/v1/plans"):
        res = await client.get(path, params={"farm_id": farm["id"]}, headers=auth_headers)
        assert res.status_code == 200, f"{path} -> {res.status_code} {res.text[:200]}"


@pytest.mark.asyncio
async def test_collection_aliases_reject_cross_tenant_access(client, auth_headers):
    intruder = {"Authorization": f"Bearer {make_token('contract-intruder-3')}"}
    theirs = await make_farm(client, intruder, "Private Farm")

    for path in ("/api/v1/dashboard", "/api/v1/risks", "/api/v1/tasks", "/api/v1/alerts"):
        res = await client.get(path, params={"farm_id": theirs["id"]}, headers=auth_headers)
        assert res.status_code == 403, f"{path} allowed cross-tenant read"


# ==============================================================================
# Zone readings
# ==============================================================================


@pytest.mark.asyncio
async def test_zone_readings_returns_empty_series_and_never_fabricates(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Readings Farm")
    zone = await make_zone(client, auth_headers, farm["id"])

    res = await client.get(f"/api/v1/zones/{zone['id']}/readings", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["data"] == []
    assert body["meta"]["freshness"] == "offline"
    assert body["meta"]["latest_event_at"] is None


@pytest.mark.asyncio
async def test_zone_readings_returns_provenance(client, auth_headers, db_session):
    farm = await make_farm(client, auth_headers, "Provenance Farm")
    zone = await make_zone(client, auth_headers, farm["id"])

    device = Device(farm_id=farm["id"], zone_id=zone["id"], device_type="soil_sensor")
    db_session.add(device)
    await db_session.flush()
    db_session.add(
        SensorEvent(
            device_id=device.id,
            farm_id=farm["id"],
            zone_id=zone["id"],
            metric="soil_moisture",
            value=21.5,
            unit="%",
            measurements={"soil_moisture": 21.5},
            event_at=datetime.now(timezone.utc) - timedelta(minutes=2),
            sequence=1,
            source="simulator",
        )
    )
    await db_session.commit()

    res = await client.get(f"/api/v1/zones/{zone['id']}/readings", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["meta"]["freshness"] == "fresh"
    point = body["data"][0]
    assert point["metric"] == "soil_moisture"
    assert point["source"] == "simulator"
    assert point["event_at"] and point["received_at"]


@pytest.mark.asyncio
async def test_zone_readings_denied_across_tenants(client, auth_headers):
    intruder = {"Authorization": f"Bearer {make_token('contract-intruder-4')}"}
    theirs = await make_farm(client, intruder, "Their Readings Farm")
    their_zone = await make_zone(client, intruder, theirs["id"])

    res = await client.get(f"/api/v1/zones/{their_zone['id']}/readings", headers=auth_headers)
    assert res.status_code in (403, 404)


@pytest.mark.asyncio
async def test_reading_query_never_generates_telemetry(client, auth_headers):
    """A GET must not write simulated measurements into an empty farm."""
    farm = await make_farm(client, auth_headers, "No Autogen Farm")
    await make_zone(client, auth_headers, farm["id"])

    first = await client.get(f"/api/v1/telemetry/{farm['id']}/events", headers=auth_headers)
    assert first.status_code == 200
    assert first.json()["data"] == []

    second = await client.get(f"/api/v1/telemetry/{farm['id']}/events", headers=auth_headers)
    assert second.json()["data"] == []


# ==============================================================================
# Task state machine
# ==============================================================================


async def make_task(client, headers, farm_id, zone_id=None):
    return (
        await client.post(
            "/api/v1/tasks",
            headers=headers,
            json={
                "farm_id": farm_id,
                "zone_id": zone_id,
                "title": "Inspect zone",
                "action_type": "inspect",
            },
        )
    ).json()["data"]


@pytest.mark.asyncio
async def test_task_can_be_blocked_and_resumed(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Task Farm")
    task = await make_task(client, auth_headers, farm["id"])

    blocked = await client.patch(
        f"/api/v1/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "blocked", "note": "Field flooded after rain"},
    )
    assert blocked.status_code == 200
    assert blocked.json()["data"]["status"] == "blocked"

    resumed = await client.patch(
        f"/api/v1/tasks/{task['id']}/status", headers=auth_headers, json={"status": "in_progress"}
    )
    assert resumed.status_code == 200
    assert resumed.json()["data"]["status"] == "in_progress"


@pytest.mark.asyncio
async def test_completed_task_cannot_be_reopened(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Terminal Farm")
    task = await make_task(client, auth_headers, farm["id"])

    await client.post(f"/api/v1/tasks/{task['id']}/start", headers=auth_headers, json={})
    await client.post(f"/api/v1/tasks/{task['id']}/complete", headers=auth_headers, json={})

    for route, payload in (
        (f"/api/v1/tasks/{task['id']}/status", {"status": "in_progress"}),
        (f"/api/v1/tasks/{task['id']}", {"status": "pending"}),
    ):
        method = client.patch
        res = await method(route, headers=auth_headers, json=payload)
        assert res.status_code == 409, f"{route} allowed reopening a completed task"
        assert res.json()["error"]["code"] == "ILLEGAL_TASK_TRANSITION"


@pytest.mark.asyncio
async def test_patch_cannot_bypass_the_state_machine(client, auth_headers):
    """PATCH /tasks/{id} is not a back door around legal transitions."""
    farm = await make_farm(client, auth_headers, "Bypass Farm")
    task = await make_task(client, auth_headers, farm["id"])

    await client.post(f"/api/v1/tasks/{task['id']}/cancel", headers=auth_headers, json={})
    res = await client.patch(
        f"/api/v1/tasks/{task['id']}", headers=auth_headers, json={"status": "in_progress"}
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_task_transition_records_audit_with_before_and_after(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Audit Task Farm")
    task = await make_task(client, auth_headers, farm["id"])

    await client.patch(
        f"/api/v1/tasks/{task['id']}/status",
        headers=auth_headers,
        json={"status": "blocked", "note": "Waiting on parts"},
    )

    events = (
        await client.get("/api/v1/timeline", params={"farm_id": farm["id"]}, headers=auth_headers)
    ).json()["data"]
    blocked = [e for e in events if e["event_type"] == "task_blocked"]
    assert blocked, "task_blocked audit event was not written"
    assert blocked[0]["before_state"]["status"] == "pending"
    assert blocked[0]["after_state"]["status"] == "blocked"
    assert blocked[0]["after_state"]["note"] == "Waiting on parts"


# ==============================================================================
# Plan decision endpoint
# ==============================================================================


async def make_plan(client, headers, farm_id, zone_id=None):
    return (
        await client.post(
            "/api/v1/action-plans",
            headers=headers,
            json={
                "farm_id": farm_id,
                "zone_id": zone_id,
                "action_type": "inspect",
                "action_summary": "Inspect zone moisture",
                "priority": "medium",
                "confidence": 0.7,
            },
        )
    ).json()["data"]


@pytest.mark.asyncio
async def test_plan_decision_supports_approve_and_reject(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Decision Farm")

    approved = await make_plan(client, auth_headers, farm["id"])
    res = await client.post(
        f"/api/v1/plans/{approved['id']}/decision",
        headers=auth_headers,
        json={"decision": "approve", "reason": "Conditions confirmed in field"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["approval_state"] == "approved"

    rejected = await make_plan(client, auth_headers, farm["id"])
    res = await client.post(
        f"/api/v1/plans/{rejected['id']}/decision",
        headers=auth_headers,
        json={"decision": "reject", "reason": "Already irrigated yesterday"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["approval_state"] == "rejected"


@pytest.mark.asyncio
async def test_plan_reschedule_moves_window_and_keeps_history(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Reschedule Farm")
    plan = await make_plan(client, auth_headers, farm["id"])

    new_start = datetime.now(timezone.utc) + timedelta(days=1)
    new_end = new_start + timedelta(hours=6)
    res = await client.post(
        f"/api/v1/plans/{plan['id']}/decision",
        headers=auth_headers,
        json={
            "decision": "reschedule",
            "reason": "Rain forecast today",
            "earliest_at": new_start.isoformat(),
            "latest_at": new_end.isoformat(),
        },
    )
    assert res.status_code == 200
    body = res.json()["data"]
    # A rescheduled plan returns for approval and bumps its version.
    assert body["approval_state"] == "pending_approval"
    assert body["version"] == plan["version"] + 1

    events = (
        await client.get("/api/v1/timeline", params={"farm_id": farm["id"]}, headers=auth_headers)
    ).json()["data"]
    rescheduled = [e for e in events if e["event_type"] == "action_plan_rescheduled"]
    assert rescheduled, "reschedule was not audited"
    assert rescheduled[0]["after_state"]["reason"] == "Rain forecast today"
    assert rescheduled[0]["before_state"]["version"] == plan["version"]


@pytest.mark.asyncio
async def test_reschedule_rejects_inverted_window(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Bad Window Farm")
    plan = await make_plan(client, auth_headers, farm["id"])

    start = datetime.now(timezone.utc) + timedelta(days=2)
    res = await client.post(
        f"/api/v1/plans/{plan['id']}/decision",
        headers=auth_headers,
        json={
            "decision": "reschedule",
            "earliest_at": start.isoformat(),
            "latest_at": (start - timedelta(hours=3)).isoformat(),
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_rejected_plan_cannot_be_rescheduled(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Rejected Plan Farm")
    plan = await make_plan(client, auth_headers, farm["id"])

    await client.post(
        f"/api/v1/plans/{plan['id']}/decision", headers=auth_headers, json={"decision": "reject"}
    )
    res = await client.post(
        f"/api/v1/plans/{plan['id']}/decision",
        headers=auth_headers,
        json={
            "decision": "reschedule",
            "earliest_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_plan_exposes_cost_as_unknown_when_not_costed(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Cost Farm")
    plan = await make_plan(client, auth_headers, farm["id"])
    assert plan["estimated_cost"] is None
    assert plan["estimated_cost_status"] == "unknown"
    assert plan["estimated_cost_currency"]


# ==============================================================================
# Simulator gating
# ==============================================================================


@pytest.mark.asyncio
async def test_simulator_refused_when_demo_disabled(client, auth_headers, monkeypatch):
    farm = await make_farm(client, auth_headers, "Gated Farm")
    monkeypatch.setattr(settings, "DEMO_ENDPOINTS_ENABLED", False)

    res = await client.post(
        "/api/v1/demo/simulator/emit", params={"farm_id": farm["id"]}, headers=auth_headers
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "DEMO_DISABLED"


@pytest.mark.asyncio
async def test_simulator_output_is_labelled_as_simulated(client, auth_headers):
    farm = await make_farm(client, auth_headers, "Sim Farm")
    await make_zone(client, auth_headers, farm["id"])

    res = await client.post(
        "/api/v1/demo/simulator/emit", params={"farm_id": farm["id"]}, headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["simulated"] is True

    readings = await client.get(f"/api/v1/telemetry/{farm['id']}/events", headers=auth_headers)
    assert all(e["source"] == "simulator" for e in readings.json()["data"])
