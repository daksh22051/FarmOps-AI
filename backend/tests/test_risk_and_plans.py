"""
Tests for Multi-Agent Risk Assessment, ActionPlans, and Human Review Workflow
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_risk_evaluation_safety_and_approval_flow(client: AsyncClient, auth_headers: dict):
    # 1. Create farm & zone
    farm_res = await client.post("/api/v1/farms", json={"name": "Autonomous Intelligence Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    zone_res = await client.post(f"/api/v1/farms/{farm_id}/zones", json={"name": "Sector B - Crops"}, headers=auth_headers)
    zone_id = zone_res.json()["data"]["id"]

    # 2. Trigger Multi-Agent Evaluation Loop with critical low moisture & high humidity
    eval_payload = {
        "farm_id": farm_id,
        "zone_id": zone_id,
        "telemetry_override": {
            "soil_moisture": 18.5,    # Triggers critical Water Stress
            "air_humidity": 86.0,     # Triggers high Pest & Disease risk
            "air_temperature": 26.0,
            "soil_ph": 5.2,           # Triggers Nutrient alert
        },
    }
    eval_res = await client.post("/api/v1/risks/evaluate", json=eval_payload, headers=auth_headers)
    assert eval_res.status_code == 200
    res_data = eval_res.json()["data"]
    assert res_data["risks_detected"] == 4
    assert res_data["plans_generated"] == 4
    assert res_data["alerts_fired"] >= 1

    # 3. List Risks
    risks_res = await client.get(f"/api/v1/risks/{farm_id}", headers=auth_headers)
    assert risks_res.status_code == 200
    risks = risks_res.json()["data"]
    risk_types = [r["risk_type"] for r in risks]
    assert "water_stress" in risk_types
    assert "pest_disease" in risk_types
    assert "nutrient_deficiency" in risk_types
    assert "market_exposure" in risk_types

    # 4. List Plans
    plans_res = await client.get(f"/api/v1/plans/{farm_id}", headers=auth_headers)
    assert plans_res.status_code == 200
    plans = plans_res.json()["data"]
    assert len(plans) == 4

    # 5. Human Review of Plan: Approve an action plan requiring review
    target_plan = plans[0]
    plan_id = target_plan["id"]

    review_payload = {
        "decision": "approved",
        "review_notes": "Agronomist verified field telemetry. Drip cycle approved.",
    }
    review_res = await client.post(f"/api/v1/plans/{plan_id}/review", json=review_payload, headers=auth_headers)
    assert review_res.status_code == 200
    assert review_res.json()["data"]["approval_state"] == "approved"

    # 6. Verify Task was created
    tasks_res = await client.get(f"/api/v1/tasks/{farm_id}", headers=auth_headers)
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()["data"]
    assert len(tasks) >= 1

    # 7. Verify Alerts were logged
    alerts_res = await client.get(f"/api/v1/alerts/{farm_id}", headers=auth_headers)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()["data"]
    assert len(alerts) >= 1
    alert_id = alerts[0]["id"]

    # 8. Acknowledge Alert
    ack_res = await client.post(f"/api/v1/alerts/{alert_id}/acknowledge", json={}, headers=auth_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["data"]["acknowledged_at"] is not None
