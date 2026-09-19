"""
Test Suite for Task 10: End-to-End FarmOps Demo Pipeline + Integration Hardening
Verifies the complete autonomous pipeline across all scenarios, safety decisions, and integration flows.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_01_complete_deterministic_demo_pipeline_succeeds(client: AsyncClient, auth_headers: dict):
    """
    Test complete end-to-end water stress demo pipeline via POST /api/v1/demo/run.
    Validates Telemetry -> Risk -> AI -> Safety Gating -> ActionPlan -> Task Execution -> Reassessment.
    """
    payload = {
        "scenario": "water_stress",
        "auto_approve": True,
    }
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["success"] is True
    assert data["scenario"] == "water_stress"
    assert data["farm_id"] is not None
    assert data["zone_id"] is not None
    assert data["device_id"] is not None
    assert data["telemetry_event_id"] is not None
    assert data["risk_id"] is not None
    assert data["risk_type"] == "water_stress"
    assert data["safety_decision"] in ["ALLOW", "APPROVAL_REQUIRED"]
    assert data["action_plan_id"] is not None
    assert data["approval_state"] == "completed"
    assert data["task_id"] is not None
    assert data["task_status"] == "completed"
    assert data["reassessment_requested"] is True
    assert len(data["audit_event_ids"]) >= 5
    assert len(data["execution_log"]) >= 6


@pytest.mark.asyncio
async def test_02_demo_pipeline_is_repeatable_and_idempotent(client: AsyncClient, auth_headers: dict):
    """
    Test that running the demo pipeline multiple times sequentially reuses infrastructure,
    increments telemetry sequences, and succeeds without database unique constraint crashes.
    """
    payload = {"scenario": "water_stress", "auto_approve": True}

    # Run 1
    res1 = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res1.status_code == 200
    data1 = res1.json()["data"]
    assert data1["success"] is True

    # Run 2
    res2 = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res2.status_code == 200
    data2 = res2.json()["data"]
    assert data2["success"] is True

    # Same farm and device reused
    assert data1["farm_id"] == data2["farm_id"]
    assert data1["device_id"] == data2["device_id"]
    # Distinct telemetry events
    assert data1["telemetry_event_id"] != data2["telemetry_event_id"]


@pytest.mark.asyncio
async def test_03_low_soil_moisture_triggers_water_stress_through_real_risk_engine(
    client: AsyncClient, auth_headers: dict
):
    """
    Test that critical low moisture (16.5%) in the demo pipeline triggers
    the real deterministic RiskDetectionService and produces a water_stress risk.
    """
    payload = {"scenario": "water_stress"}
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["risk_type"] == "water_stress"
    assert data["risk_severity"] in ["high", "critical"]
    assert data["risk_score"] >= 0.70


@pytest.mark.asyncio
async def test_04_ai_proposal_generated_via_provider(client: AsyncClient, auth_headers: dict):
    """
    Test that the AI proposal contains valid structured fields (recommendation, confidence, uncertainty).
    """
    payload = {"scenario": "water_stress"}
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    data = res.json()["data"]

    proposal = data["ai_proposal"]
    assert proposal is not None
    assert proposal["agent_type"] in ["water_stress_agent", "WATER_AGENT"]
    assert "recommendation" in proposal
    assert 0.0 <= proposal["confidence"] <= 1.0
    assert "uncertainty" in proposal


@pytest.mark.asyncio
async def test_05_chemical_approval_scenario_halts_before_task_creation(client: AsyncClient, auth_headers: dict):
    """
    Test APPROVAL_REQUIRED scenario without auto_approve:
    Halts at PENDING_APPROVAL and does NOT create a task.
    """
    payload = {
        "scenario": "chemical_approval",
        "auto_approve": False,
    }
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["success"] is True
    assert data["safety_decision"] in ["APPROVAL_REQUIRED", "ESCALATE"]
    assert data["approval_state"] == "pending_approval"
    assert data["task_id"] is None
    assert data["task_status"] is None


@pytest.mark.asyncio
async def test_06_chemical_approval_scenario_with_auto_approve_completes_task(
    client: AsyncClient, auth_headers: dict
):
    """
    Test APPROVAL_REQUIRED scenario with auto_approve:
    Successfully triggers human approval and completes task lifecycle.
    """
    payload = {
        "scenario": "chemical_approval",
        "auto_approve": True,
    }
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["success"] is True
    assert data["safety_decision"] in ["APPROVAL_REQUIRED", "ESCALATE"]
    assert data["approval_state"] == "completed"
    assert data["task_id"] is not None
    assert data["task_status"] == "completed"


@pytest.mark.asyncio
async def test_07_prohibited_actuator_scenario_rejected_by_safety_guard(
    client: AsyncClient, auth_headers: dict
):
    """
    Test REJECT safety scenario: Prohibited hardware override is rejected by policy,
    ActionPlan is rejected, and zero tasks are created.
    """
    payload = {"scenario": "prohibited_actuator"}
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["success"] is True
    assert data["safety_decision"] == "REJECT"
    assert data["approval_state"] == "rejected"
    assert data["task_id"] is None


@pytest.mark.asyncio
async def test_08_pest_disease_scenario_succeeds(client: AsyncClient, auth_headers: dict):
    """
    Test pest & disease scenario: Elevated humidity triggers PEST_DISEASE_RISK
    and executes field scouting protocol.
    """
    payload = {"scenario": "pest_disease", "auto_approve": True}
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["success"] is True
    assert data["risk_type"] == "pest_disease"
    assert data["safety_decision"] in ["ALLOW", "APPROVAL_REQUIRED"]
    assert data["task_id"] is not None
    assert data["task_status"] == "completed"


@pytest.mark.asyncio
async def test_09_nutrient_deficiency_scenario_succeeds(client: AsyncClient, auth_headers: dict):
    """
    Test nutrient deficiency scenario: Low N/P/K and low pH trigger NUTRIENT_DEFICIENCY
    and execute calibrated soil sampling.
    """
    payload = {"scenario": "nutrient_deficiency", "auto_approve": True}
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["success"] is True
    assert data["risk_type"] == "nutrient_deficiency"
    assert data["task_id"] is not None
    assert data["task_status"] == "completed"


@pytest.mark.asyncio
async def test_10_audit_trail_and_reassessment_signal_verified(client: AsyncClient, auth_headers: dict):
    """
    Test that audit events and risk reassessment signals are logged during demo runs.
    """
    payload = {"scenario": "water_stress", "auto_approve": True}
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    data = res.json()["data"]
    farm_id = data["farm_id"]
    risk_id = data["risk_id"]

    audit_res = await client.get(f"/api/v1/audit/events?farm_id={farm_id}", headers=auth_headers)
    assert audit_res.status_code == 200
    events = audit_res.json()["data"]
    event_types = [e["event_type"] for e in events]

    assert "risk_reassessment_requested" in event_types
    assert "task_completed" in event_types
    assert "action_plan_created" in event_types


@pytest.mark.asyncio
async def test_11_demo_never_exposes_secrets(client: AsyncClient, auth_headers: dict):
    """
    Test that the demo result object, execution log, and audit records never leak credentials.
    """
    payload = {"scenario": "water_stress"}
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    data_str = str(res.json())

    sensitive_patterns = ["Bearer ", "AIzaSy", "password", "jwt_secret", "secret_key"]
    for pattern in sensitive_patterns:
        assert pattern not in data_str


@pytest.mark.asyncio
async def test_12_demo_endpoint_requires_auth(client: AsyncClient):
    """
    Test that unauthenticated requests to POST /api/v1/demo/run are rejected with 401.
    """
    res = await client.post("/api/v1/demo/run", json={"scenario": "water_stress"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_13_demo_status_endpoint(client: AsyncClient):
    """
    Test that GET /api/v1/demo/status returns operational readiness and scenario list.
    """
    res = await client.get("/api/v1/demo/status")
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["status"] == "ready"
    assert "water_stress" in data["available_scenarios"]
    assert "pest_disease" in data["available_scenarios"]
    assert "nutrient_deficiency" in data["available_scenarios"]
    assert "chemical_approval" in data["available_scenarios"]
    assert "prohibited_actuator" in data["available_scenarios"]
