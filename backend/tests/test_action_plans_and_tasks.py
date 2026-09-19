"""
Test Suite for Task 9: Action Planning + Safety-Gated Execution Workflow
Covers ActionPlan lifecycle, deterministic safety gating, human approval, task execution,
idempotency, cross-farm access control, alerts, and audit trail.
"""

import pytest
import jwt
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.config import settings


def make_auth_headers(user_id: str, email: str = "user@example.com") -> dict:
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
        "user_metadata": {"name": f"User {user_id}"},
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.SUPABASE_JWT_ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_01_allow_workflow_auto_creates_task(client: AsyncClient, auth_headers: dict):
    """
    Test ALLOW workflow: Safe routine advisory evaluates to ALLOW,
    auto-approves the ActionPlan, and immediately generates an executable Task.
    """
    # 1. Create farm & zone
    farm_res = await client.post("/api/v1/farms", json={"name": "Alpha Safety Farm"}, headers=auth_headers)
    assert farm_res.status_code == 201
    farm_id = farm_res.json()["data"]["id"]

    zone_res = await client.post(f"/api/v1/farms/{farm_id}/zones", json={"name": "Zone A"}, headers=auth_headers)
    assert zone_res.status_code == 201
    zone_id = zone_res.json()["data"]["id"]

    # 2. Create an action plan with safe routine parameters
    plan_payload = {
        "farm_id": farm_id,
        "zone_id": zone_id,
        "title": "Routine Irrigation Line Inspection",
        "action_type": "inspect_irrigation",
        "action_summary": "Inspect drip emitters and pressure regulators for zone A.",
        "priority": "medium",
        "confidence": 0.95,
        "estimated_cost": 50.0,
        "steps": [
            {"step_number": 1, "title": "Check line pressure", "description": "Ensure pressure is between 1.5-2.0 bar"},
            {"step_number": 2, "title": "Flush sub-main lines", "description": "Clear sediment build-up"},
        ],
    }
    create_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    assert create_res.status_code == 201
    plan_data = create_res.json()["data"]
    
    assert plan_data["policy_decision"] == "ALLOW"
    assert plan_data["approval_state"] == "approved"
    assert plan_data["requires_human_approval"] is False

    plan_id = plan_data["id"]

    # 3. Verify executable task was automatically created
    tasks_res = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()["data"]
    matching_tasks = [t for t in tasks if t["plan_id"] == plan_id]
    assert len(matching_tasks) == 1
    task = matching_tasks[0]
    assert task["status"] == "pending"
    assert len(task["checklist"]) == 2


@pytest.mark.asyncio
async def test_02_approval_required_workflow_does_not_create_task_until_approved(
    client: AsyncClient, auth_headers: dict
):
    """
    Test APPROVAL_REQUIRED workflow: High-risk or sensitive chemical action plan
    evaluates to APPROVAL_REQUIRED, sets pending_approval, and does NOT auto-create a task.
    """
    farm_res = await client.post("/api/v1/farms", json={"name": "Beta Sensitive Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    plan_payload = {
        "farm_id": farm_id,
        "title": "Targeted Fungicide Spray Advisory",
        "action_type": "chemical_treatment",
        "action_summary": "Apply chemical_spray fungicide for powdery mildew containment.",
        "priority": "high",
        "confidence": 0.88,
        "estimated_cost": 320.0,
    }
    create_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    assert create_res.status_code == 201
    plan_data = create_res.json()["data"]

    assert plan_data["policy_decision"] == "APPROVAL_REQUIRED"
    assert plan_data["approval_state"] == "pending_approval"
    assert plan_data["requires_human_approval"] is True
    plan_id = plan_data["id"]

    # Verify NO task is created yet
    tasks_res = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    tasks = tasks_res.json()["data"]
    matching_tasks = [t for t in tasks if t["plan_id"] == plan_id]
    assert len(matching_tasks) == 0

    # Verify Alert was generated for approval required
    alerts_res = await client.get(f"/api/v1/alerts/{farm_id}", headers=auth_headers)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()["data"]
    approval_alerts = [a for a in alerts if "requires" in a["message"].lower() or "approval" in a["message"].lower()]
    assert len(approval_alerts) >= 1


@pytest.mark.asyncio
async def test_03_authoritative_approval_transitions_and_creates_task_exactly_once(
    client: AsyncClient, auth_headers: dict
):
    """
    Test approval endpoint: Transitions pending_approval -> approved and creates task exactly once.
    """
    farm_res = await client.post("/api/v1/farms", json={"name": "Gamma Approval Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Create plan requiring approval (low confidence)
    plan_payload = {
        "farm_id": farm_id,
        "title": "Soil Core Sampling Verification",
        "action_type": "sample_soil",
        "action_summary": "Take 5 grid core samples to verify suspected nitrogen deficiency.",
        "priority": "medium",
        "confidence": 0.65,  # < 0.70 triggers APPROVAL_REQUIRED / ESCALATE
    }
    create_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    plan_id = create_res.json()["data"]["id"]
    assert create_res.json()["data"]["approval_state"] == "pending_approval"

    # Approve the action plan
    approve_res = await client.post(
        f"/api/v1/action-plans/{plan_id}/approve",
        json={"notes": "Agronomist verified field sensor logs and approved sampling."},
        headers=auth_headers,
    )
    assert approve_res.status_code == 200
    approved_data = approve_res.json()["data"]
    assert approved_data["approval_state"] == "approved"

    # Verify Task is now created
    tasks_res = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    tasks = [t for t in tasks_res.json()["data"] if t["plan_id"] == plan_id]
    assert len(tasks) == 1
    assert tasks[0]["status"] == "pending"

    # IDEMPOTENCY CHECK: Call approve again
    approve_again_res = await client.post(
        f"/api/v1/action-plans/{plan_id}/approve",
        json={"notes": "Duplicate approve call"},
        headers=auth_headers,
    )
    assert approve_again_res.status_code == 200
    tasks_res_after = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    tasks_after = [t for t in tasks_res_after.json()["data"] if t["plan_id"] == plan_id]
    assert len(tasks_after) == 1  # Still exactly 1 task!


@pytest.mark.asyncio
async def test_04_rejection_workflow_transitions_and_prevents_task_creation(
    client: AsyncClient, auth_headers: dict
):
    """
    Test rejection endpoint: Transitions pending_approval -> rejected and prevents task creation.
    """
    farm_res = await client.post("/api/v1/farms", json={"name": "Delta Rejection Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    plan_payload = {
        "farm_id": farm_id,
        "title": "Herbicide Application",
        "action_type": "apply_herbicide",
        "action_summary": "Apply synthetic herbicide across Sector 4.",
        "priority": "high",
        "confidence": 0.85,
    }
    create_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    plan_id = create_res.json()["data"]["id"]
    assert create_res.json()["data"]["approval_state"] == "pending_approval"

    # Reject the action plan
    reject_res = await client.post(
        f"/api/v1/action-plans/{plan_id}/reject",
        json={"notes": "Rejected due to organic farming certification restrictions."},
        headers=auth_headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["data"]["approval_state"] == "rejected"

    # Verify NO task is created
    tasks_res = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    tasks = [t for t in tasks_res.json()["data"] if t["plan_id"] == plan_id]
    assert len(tasks) == 0

    # Cannot approve an already rejected plan
    re_approve_res = await client.post(f"/api/v1/action-plans/{plan_id}/approve", json={}, headers=auth_headers)
    assert re_approve_res.status_code == 400


@pytest.mark.asyncio
async def test_05_prohibited_actuator_override_rejected_by_safety_guard(
    client: AsyncClient, auth_headers: dict
):
    """
    Test that unsafe physical actuator commands or direct controls are rejected
    with PolicyDecision.REJECT and cannot be approved.
    """
    farm_res = await client.post("/api/v1/farms", json={"name": "Epsilon Actuator Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    plan_payload = {
        "farm_id": farm_id,
        "title": "Direct Actuator Override",
        "action_type": "actuator_direct_trigger",
        "action_summary": "turn valve 4 and autonomous_pump_start immediately without human",
        "priority": "urgent",
        "confidence": 0.99,
    }
    create_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    assert create_res.status_code == 201
    plan_data = create_res.json()["data"]

    assert plan_data["policy_decision"] == "REJECT"
    assert plan_data["approval_state"] == "rejected"
    plan_id = plan_data["id"]

    # Verify no task created
    tasks_res = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    assert len([t for t in tasks_res.json()["data"] if t["plan_id"] == plan_id]) == 0

    # Attempt to approve rejected plan -> 400 Bad Request
    approve_res = await client.post(f"/api/v1/action-plans/{plan_id}/approve", json={}, headers=auth_headers)
    assert approve_res.status_code == 400


@pytest.mark.asyncio
async def test_06_task_execution_lifecycle_and_risk_reassessment_trigger(
    client: AsyncClient, auth_headers: dict
):
    """
    Test complete task lifecycle: pending -> in_progress -> completed.
    Validates timestamps, ActionPlan status sync, and risk reassessment audit signal.
    """
    # 1. Create farm & risk assessment
    farm_res = await client.post("/api/v1/farms", json={"name": "Zeta Lifecycle Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Trigger risk detection to get a real RiskAssessment ID
    eval_res = await client.post(
        "/api/v1/risks/detect",
        json={"farm_id": farm_id, "telemetry_override": {"soil_moisture": 16.0}},
        headers=auth_headers,
    )
    assert eval_res.status_code == 200
    risks_res = await client.get(f"/api/v1/risks/{farm_id}", headers=auth_headers)
    risk_id = risks_res.json()["data"][0]["id"]

    # 2. Create ActionPlan linked to the RiskAssessment
    plan_payload = {
        "farm_id": farm_id,
        "risk_id": risk_id,
        "title": "Irrigation Adjustment",
        "action_type": "adjust_irrigation",
        "action_summary": "Increase drip cycle duration by 20 minutes.",
        "priority": "high",
        "confidence": 0.92,
    }
    plan_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    plan_id = plan_res.json()["data"]["id"]

    # 3. Retrieve automatically created Task
    tasks_res = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    matching_tasks = [t for t in tasks_res.json()["data"] if t["plan_id"] == plan_id]
    assert len(matching_tasks) == 1
    task_id = matching_tasks[0]["id"]
    assert matching_tasks[0]["status"] == "pending"

    # 4. Start Task
    start_res = await client.post(
        f"/api/v1/tasks/{task_id}/start",
        json={"notes": "Field worker started drip valve calibration."},
        headers=auth_headers,
    )
    assert start_res.status_code == 200
    started_task = start_res.json()["data"]
    assert started_task["status"] == "in_progress"
    assert started_task["started_at"] is not None

    # Check that ActionPlan status transitioned to executing
    plan_detail_res = await client.get(f"/api/v1/action-plans/{plan_id}", headers=auth_headers)
    assert plan_detail_res.json()["data"]["approval_state"] in ["executing", "approved"]

    # 5. Complete Task
    complete_res = await client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={"completion_notes": "Valves calibrated and flow meter verified at 12 L/min.", "completed_by": "worker_john"},
        headers=auth_headers,
    )
    assert complete_res.status_code == 200
    completed_task = complete_res.json()["data"]
    assert completed_task["status"] == "completed"
    assert completed_task["completed_at"] is not None

    # Check that ActionPlan status transitioned to completed
    plan_after_complete = await client.get(f"/api/v1/action-plans/{plan_id}", headers=auth_headers)
    assert plan_after_complete.json()["data"]["approval_state"] == "completed"

    # 6. IDEMPOTENCY: Calling complete again returns 200 safely
    complete_again_res = await client.post(f"/api/v1/tasks/{task_id}/complete", json={}, headers=auth_headers)
    assert complete_again_res.status_code == 200
    assert complete_again_res.json()["data"]["status"] == "completed"

    # 7. Verify Audit Trail contains risk_reassessment_requested
    audit_res = await client.get(f"/api/v1/audit/events?farm_id={farm_id}", headers=auth_headers)
    assert audit_res.status_code == 200
    events = audit_res.json()["data"]
    reassess_events = [e for e in events if e["event_type"] == "risk_reassessment_requested"]
    assert len(reassess_events) >= 1
    assert reassess_events[0]["entity_id"] == risk_id


@pytest.mark.asyncio
async def test_07_task_cancellation_workflow(client: AsyncClient, auth_headers: dict):
    """
    Test task cancellation: pending -> cancelled updates both task and action plan.
    """
    farm_res = await client.post("/api/v1/farms", json={"name": "Eta Cancellation Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    plan_payload = {
        "farm_id": farm_id,
        "title": "Soil Salinity Testing",
        "action_type": "sample_soil",
        "action_summary": "Test salinity levels in quadrant 3.",
        "priority": "low",
        "confidence": 0.90,
    }
    plan_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    plan_id = plan_res.json()["data"]["id"]

    tasks_res = await client.get(f"/api/v1/farms/{farm_id}/tasks", headers=auth_headers)
    task_id = [t for t in tasks_res.json()["data"] if t["plan_id"] == plan_id][0]["id"]

    # Cancel task
    cancel_res = await client.post(
        f"/api/v1/tasks/{task_id}/cancel",
        json={"reason": "Inclement weather made sampling unsafe."},
        headers=auth_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["data"]["status"] == "cancelled"

    # Cannot complete a cancelled task
    complete_res = await client.post(f"/api/v1/tasks/{task_id}/complete", json={}, headers=auth_headers)
    assert complete_res.status_code == 400


@pytest.mark.asyncio
async def test_08_cross_farm_isolation_for_plans_and_tasks(
    client: AsyncClient, auth_headers: dict
):
    """
    Test that users from Farm A cannot view or modify ActionPlans and Tasks belonging to Farm B.
    """
    # Farm A created by User A (owner)
    farm_a_res = await client.post("/api/v1/farms", json={"name": "Farm A Isolation"}, headers=auth_headers)
    farm_a_id = farm_a_res.json()["data"]["id"]

    plan_payload = {
        "farm_id": farm_a_id,
        "title": "Private Farm A Action",
        "action_type": "scout_field",
        "action_summary": "Inspect North Field for pests.",
        "priority": "medium",
        "confidence": 0.95,
    }
    plan_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    plan_id = plan_res.json()["data"]["id"]

    tasks_res = await client.get(f"/api/v1/farms/{farm_a_id}/tasks", headers=auth_headers)
    task_id = tasks_res.json()["data"][0]["id"]

    # User B (different user without membership in Farm A) attempts cross-farm access
    user_b_headers = make_auth_headers(user_id="usr_b_unauthorized_999", email="user_b@example.com")

    # 1. Listing plans of Farm A
    cross_plans_res = await client.get(f"/api/v1/farms/{farm_a_id}/action-plans", headers=user_b_headers)
    assert cross_plans_res.status_code == 403

    # 2. Viewing specific plan detail
    cross_plan_detail = await client.get(f"/api/v1/action-plans/{plan_id}", headers=user_b_headers)
    assert cross_plan_detail.status_code == 403

    # 3. Listing tasks of Farm A
    cross_tasks_res = await client.get(f"/api/v1/farms/{farm_a_id}/tasks", headers=user_b_headers)
    assert cross_tasks_res.status_code == 403

    # 4. Starting a task on Farm A
    cross_start_res = await client.post(f"/api/v1/tasks/{task_id}/start", json={}, headers=user_b_headers)
    assert cross_start_res.status_code == 403


@pytest.mark.asyncio
async def test_09_unauthorized_role_cannot_approve_action_plans(
    client: AsyncClient, auth_headers: dict
):
    """
    Test RBAC: A user with 'viewer' membership in the farm cannot approve/reject plans.
    """
    # 1. Owner creates farm
    farm_res = await client.post("/api/v1/farms", json={"name": "RBAC Protection Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # 2. Add viewer user to farm
    viewer_user_id = "usr_viewer_target_123"
    await client.post(
        f"/api/v1/farms/{farm_id}/members",
        json={"user_id": viewer_user_id, "role": "viewer"},
        headers=auth_headers,
    )

    # 3. Create plan requiring approval
    plan_payload = {
        "farm_id": farm_id,
        "title": "Nutrient Spray",
        "action_type": "chemical_treatment",
        "action_summary": "Apply chemical_spray potassium nitrate.",
        "priority": "high",
        "confidence": 0.85,
    }
    plan_res = await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)
    plan_id = plan_res.json()["data"]["id"]

    # 4. Viewer attempts to approve -> 403 Forbidden
    viewer_headers = make_auth_headers(user_id=viewer_user_id, email="viewer@example.com")
    approve_res = await client.post(
        f"/api/v1/action-plans/{plan_id}/approve",
        json={"notes": "Unauthorized approval attempt"},
        headers=viewer_headers,
    )
    assert approve_res.status_code == 403


@pytest.mark.asyncio
async def test_10_audit_events_do_not_leak_secrets(client: AsyncClient, auth_headers: dict):
    """
    Test that audit events and state captures never leak API keys, tokens, or credentials.
    """
    farm_res = await client.post("/api/v1/farms", json={"name": "Audit Security Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    plan_payload = {
        "farm_id": farm_id,
        "title": "Routine Inspection",
        "action_type": "inspect",
        "action_summary": "Routine sensor inspection.",
        "priority": "low",
        "confidence": 0.95,
    }
    await client.post("/api/v1/action-plans", json=plan_payload, headers=auth_headers)

    audit_res = await client.get(f"/api/v1/audit/events?farm_id={farm_id}", headers=auth_headers)
    assert audit_res.status_code == 200
    events = audit_res.json()["data"]

    sensitive_patterns = ["Bearer ", "AIzaSy", "password", "jwt_secret", "secret_key"]
    for event in events:
        event_str = str(event)
        for pattern in sensitive_patterns:
            assert pattern not in event_str


@pytest.mark.asyncio
async def test_11_openapi_documentation_exposes_task9_endpoints(client: AsyncClient):
    """
    Test that OpenAPI schema properly registers all Task 9 endpoints.
    """
    openapi_res = await client.get("/api/v1/openapi.json")
    assert openapi_res.status_code == 200
    paths = openapi_res.json()["paths"]

    assert "/api/v1/action-plans" in paths
    assert "/api/v1/farms/{farm_id}/action-plans" in paths
    assert "/api/v1/action-plans/{action_plan_id}/approve" in paths
    assert "/api/v1/action-plans/{action_plan_id}/reject" in paths
    assert "/api/v1/farms/{farm_id}/tasks" in paths
    assert "/api/v1/tasks/{task_id}/start" in paths
    assert "/api/v1/tasks/{task_id}/complete" in paths
    assert "/api/v1/tasks/{task_id}/cancel" in paths
