"""
Test Suite: Frontend API Contract & OpenAPI Specification Tests
Verifies that all frontend dashboard endpoints, schemas, authentication requirements,
farm isolation scoping, standard envelopes, and OpenAPI integrity remain locked and compliant.
"""

import pytest
import json
from unittest.mock import patch
from httpx import AsyncClient
from app.main import app
from app.config import settings
from app.ai.provider import MockAIProvider


@pytest.fixture(autouse=True)
def use_mock_ai_for_contract_tests():
    with patch("app.demo.runner.get_ai_provider", return_value=MockAIProvider()):
        yield


@pytest.mark.asyncio
async def test_openapi_loads_successfully_and_contains_no_secrets():
    """
    Validates that FastAPI generates OpenAPI 3.1 schema without errors
    and that absolutely no backend secrets or database credentials leak.
    """
    openapi_schema = app.openapi()
    assert openapi_schema is not None
    assert "openapi" in openapi_schema
    assert openapi_schema["info"]["title"] == "FarmOps AI Backend"
    assert "paths" in openapi_schema
    assert len(openapi_schema["paths"]) >= 25

    # Check for leaked secrets in the schema
    schema_dump = json.dumps(openapi_schema).lower()
    forbidden_tokens = [
        "postgresql://",
        "postgres://",
        "supabase_secret_key",
        "service_role",
        "supabase_jwt_secret",
        "secret=",
        "password=",
    ]
    for token in forbidden_tokens:
        assert token not in schema_dump, f"Security violation: found token '{token}' in OpenAPI specification!"


@pytest.mark.asyncio
async def test_critical_dashboard_endpoint_paths_exist():
    """
    Ensures every endpoint path required by the Frontend Dashboard contract exists in OpenAPI.
    """
    paths = app.openapi()["paths"]

    critical_paths = [
        # Health & Root
        "/api/v1/health",
        "/api/v1/health/db",
        # Auth
        "/api/v1/auth/me",
        # Farms
        "/api/v1/farms",
        "/api/v1/farms/{farm_id}",
        "/api/v1/farms/{farm_id}/zones",
        "/api/v1/farms/{farm_id}/devices",
        "/api/v1/farms/{farm_id}/members",
        "/api/v1/farms/{farm_id}/risks",
        # Direct Zones & Devices
        "/api/v1/zones/{zone_id}",
        "/api/v1/devices/{device_id}",
        # Telemetry & Observations
        "/api/v1/telemetry/events",
        "/api/v1/telemetry/{farm_id}/events",
        "/api/v1/observations",
        "/api/v1/observations/farm/{farm_id}",
        # Risks & AI
        "/api/v1/risks/detect",
        "/api/v1/risks/detail/{risk_id}",
        "/api/v1/ai/evaluate-risk",
        # Action Plans
        "/api/v1/action-plans",
        "/api/v1/farms/{farm_id}/action-plans",
        "/api/v1/action-plans/{action_plan_id}",
        "/api/v1/action-plans/{action_plan_id}/approve",
        "/api/v1/action-plans/{action_plan_id}/reject",
        # Field Tasks
        "/api/v1/tasks",
        "/api/v1/farms/{farm_id}/tasks",
        "/api/v1/tasks/detail/{task_id}",
        "/api/v1/tasks/{task_id}/start",
        "/api/v1/tasks/{task_id}/complete",
        "/api/v1/tasks/{task_id}/cancel",
        # Alerts & Escalations
        "/api/v1/alerts/{farm_id}",
        "/api/v1/alerts/{alert_id}/acknowledge",
        "/api/v1/escalations",
        "/api/v1/escalations/{farm_id}",
        "/api/v1/escalations/{escalation_id}/review",
        # Audit & Demo
        "/api/v1/audit",
        "/api/v1/demo/run",
        "/api/v1/demo/status",
    ]

    for expected_path in critical_paths:
        assert expected_path in paths, f"Missing critical contract path in OpenAPI: {expected_path}"


@pytest.mark.asyncio
async def test_schemas_present_in_components():
    """
    Verifies that critical request/response Pydantic models are registered in OpenAPI schemas.
    """
    schemas = app.openapi()["components"]["schemas"]

    expected_schemas = [
        "FarmCreate",
        "FarmResponse",
        "ZoneCreate",
        "ZoneResponse",
        "DeviceCreate",
        "DeviceResponse",
        "TelemetryEventCreate",
        "TelemetryEventResponse",
        "ExternalObservationCreate",
        "ExternalObservationResponse",
        "RiskAssessmentResponse",
        "AIEvaluationRequest",
        "AIEvaluationResponse",
        "AIProposal",
        "AISafetyDecision",
        "ActionPlanCreate",
        "ActionPlanResponse",
        "TaskCreate",
        "TaskResponse",
        "AlertResponse",
        "EscalationResponse",
        "AuditEventResponse",
        "DemoRunRequest",
        "DemoRunResult",
        "DemoStatusResponse",
    ]

    for schema_name in expected_schemas:
        assert schema_name in schemas, f"Missing schema '{schema_name}' in OpenAPI components"


@pytest.mark.asyncio
async def test_unauthenticated_request_enforces_auth_error_envelope(client: AsyncClient):
    """
    Calling a protected endpoint without authentication must return 401 with standard error format.
    """
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401
    body = res.json()
    assert body["success"] is False
    assert body["data"] is None
    assert "error" in body
    assert body["error"]["code"] in ["AUTHENTICATION_REQUIRED", "UNAUTHORIZED", "ERROR"]


@pytest.mark.asyncio
async def test_authenticated_user_profile_contract(client: AsyncClient, auth_headers: dict):
    """
    Validates GET /api/v1/auth/me response structure with authentication.
    """
    res = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "data" in body
    assert "id" in body["data"]
    assert "email" in body["data"]
    assert body["data"]["email"] == "farmer@example.com"


@pytest.mark.asyncio
async def test_farm_scoping_enforced_in_contract(client: AsyncClient, auth_headers: dict):
    """
    Accessing a non-existent or inaccessible farm ID must return 404/403 with standard envelope.
    """
    res = await client.get("/api/v1/farms/farm_non_existent_99999", headers=auth_headers)
    assert res.status_code in [403, 404]
    body = res.json()
    assert body["success"] is False
    assert body["data"] is None
    assert "error" in body


@pytest.mark.asyncio
async def test_public_demo_status_contract(client: AsyncClient):
    """
    GET /api/v1/demo/status must be publicly callable and return valid DemoStatusResponse envelope.
    """
    res = await client.get("/api/v1/demo/status")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ready"
    assert "water_stress" in body["data"]["available_scenarios"]
    assert body["data"]["deterministic_mode"] is True


@pytest.mark.asyncio
async def test_demo_run_pipeline_contract(client: AsyncClient, auth_headers: dict):
    """
    POST /api/v1/demo/run must return a complete DemoRunResult envelope with all pipeline fields.
    """
    payload = {
        "scenario": "water_stress",
        "auto_approve": True,
        "farm_name": "Contract Test Demo Farm",
    }
    res = await client.post("/api/v1/demo/run", json=payload, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]

    # Verify all critical contract properties exist
    assert "demo_run_id" in data
    assert "farm_id" in data
    assert "zone_id" in data
    assert "device_id" in data
    assert "telemetry_event_id" in data
    assert "risk_id" in data
    assert "safety_decision" in data
    assert "action_plan_id" in data
    assert "task_id" in data
    assert "audit_event_ids" in data
    assert "alert_ids" in data
    assert "execution_log" in data
    assert isinstance(data["execution_log"], list)
    assert len(data["execution_log"]) >= 5


@pytest.mark.asyncio
async def test_cors_configuration_allows_local_origins():
    """
    Verifies that default local development origins (Vite 5173, Next 3000) are configured.
    """
    origins = settings.CORS_ORIGINS
    if isinstance(origins, str):
        origins = [o.strip() for o in origins.split(",")]

    assert "http://localhost:3000" in origins or "*" in origins
    assert "http://localhost:5173" in origins or "*" in origins
