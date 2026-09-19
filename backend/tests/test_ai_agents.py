"""
Task 8: AI Agents & Gemini Integration Comprehensive Test Suite
Validates structured AI proposals, Gemini provider isolation, domain agents (Water, Pest, Nutrient, Market),
context builder sanitization, SafetyGuard enforcement, farm-scoped RBAC, audit trails, and OpenAPI docs.
"""

import pytest
import json
import jwt
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.farm import Farm, Zone
from app.models.device import Device
from app.models.risk import RiskAssessment
from app.models.audit import AuditEvent
from app.schemas.ai import AIProposal, AgentType, AIEvaluationResponse
from app.ai.agents.water_stress import WaterStressAgent
from app.ai.agents.pest_disease import PestDiseaseAgent
from app.ai.agents.nutrient import NutrientAgent
from app.ai.agents.market_context import MarketContextAgent
from app.ai.safety_guard import SafetyGuard, PolicyDecision
from app.ai.provider import MockAIProvider, GeminiProvider
from app.integrations.gemini_client import GeminiClient
from app.services.ai_context_service import AIContextService
from app.services.risk_detection_service import RiskDetectionService
from app.core.exceptions import AIProviderException


def create_test_token(user_id: str, role: str = "authenticated") -> str:
    payload = {
        "sub": user_id,
        "email": f"{user_id}@example.com",
        "role": role,
        "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.SUPABASE_JWT_ALGORITHM)


# ==============================================================================
# 1. SPECIALIZED DOMAIN AGENTS STRUCTURED PROPOSALS
# ==============================================================================

@pytest.mark.asyncio
async def test_01_water_stress_agent_returns_valid_structured_proposal():
    agent = WaterStressAgent(MockAIProvider())
    context = {
        "farm": {"name": "Green Valley"},
        "zone": {"name": "Sector 1", "crop": "Almonds"},
        "risk": {"risk_type": "water_stress", "severity": "high", "score": 0.85},
        "telemetry": {"soil_moisture": 17.5, "air_temperature": 33.0},
        "telemetry_history": [],
        "observations": [],
    }
    proposal = await agent.evaluate(context)
    assert isinstance(proposal, AIProposal)
    assert proposal.agent_type == AgentType.WATER_AGENT
    assert proposal.risk_type == "water_stress"
    assert "irrigation" in proposal.recommendation.lower()
    assert 0.0 <= proposal.confidence <= 1.0
    assert proposal.urgency in ["low", "medium", "high", "critical"]
    assert "soil_moisture" in proposal.evidence_refs


@pytest.mark.asyncio
async def test_02_pest_disease_agent_returns_valid_structured_proposal():
    agent = PestDiseaseAgent(MockAIProvider())
    context = {
        "farm": {"name": "Delta Farm"},
        "zone": {"name": "Vineyard A", "crop": "Grapes"},
        "risk": {"risk_type": "pest_disease", "severity": "medium", "score": 0.60},
        "telemetry": {"air_humidity": 88.0, "air_temperature": 24.0},
        "telemetry_history": [],
        "observations": [],
    }
    proposal = await agent.evaluate(context)
    assert isinstance(proposal, AIProposal)
    assert proposal.agent_type == AgentType.PEST_DISEASE_AGENT
    assert proposal.risk_type == "pest_disease"
    assert "scout" in proposal.recommendation.lower() or "inspection" in proposal.recommendation.lower()
    assert 0.0 <= proposal.confidence <= 1.0


@pytest.mark.asyncio
async def test_03_nutrient_agent_returns_valid_structured_proposal():
    agent = NutrientAgent(MockAIProvider())
    context = {
        "farm": {"name": "Orchard Farm"},
        "zone": {"name": "Block 3", "crop": "Citrus"},
        "risk": {"risk_type": "nutrient_deficiency", "severity": "medium", "score": 0.65},
        "telemetry": {"nitrogen": 12.0, "soil_ph": 5.2},
        "telemetry_history": [],
        "observations": [],
    }
    proposal = await agent.evaluate(context)
    assert isinstance(proposal, AIProposal)
    assert proposal.agent_type == AgentType.NUTRIENT_AGENT
    assert proposal.risk_type == "nutrient_deficiency"
    assert "soil" in proposal.recommendation.lower() or "test" in proposal.recommendation.lower()
    assert 0.0 <= proposal.confidence <= 1.0


# ==============================================================================
# 2. MALFORMED JSON, SCHEMA VALIDATION & PROVIDER RESILIENCE
# ==============================================================================

@pytest.mark.asyncio
async def test_04_malformed_gemini_json_handled_safely():
    mock_provider = AsyncMock()
    # Return broken JSON text
    mock_provider.generate_json.side_effect = Exception("JSON Decode Error")
    mock_provider.generate_response.return_value = "Irrigate the almonds soon because soil is dry."

    agent = WaterStressAgent(mock_provider)
    context = {"risk": {"risk_type": "water_stress"}, "telemetry": {"soil_moisture": 18.0}}
    proposal = await agent.evaluate(context)
    assert isinstance(proposal, AIProposal)
    assert proposal.agent_type == AgentType.WATER_AGENT
    assert proposal.confidence == 0.65
    assert proposal.requires_human_review is True


@pytest.mark.asyncio
async def test_05_invalid_ai_schema_handled_safely():
    # Test Pydantic validation rejects invalid confidence > 1.0 or invalid urgency
    with pytest.raises(ValueError):
        AIProposal(
            agent_type="WATER_AGENT",
            risk_type="water_stress",
            recommendation="Water",
            rationale="Dry",
            confidence=1.5,  # Invalid: > 1.0
            urgency="extreme_danger",  # Invalid urgency
        )


@pytest.mark.asyncio
async def test_06_missing_gemini_key_handled_safely():
    client = GeminiClient(api_key="")
    assert client.is_configured is False
    with pytest.raises(AIProviderException) as exc_info:
        await client.generate_text("Test prompt")
    assert "missing gemini_api_key" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_07_gemini_timeout_handled_safely():
    client = GeminiClient(api_key="test_api_key_12345", timeout=0.01, max_retries=1)
    with patch.object(client, "_genai_client") as mock_genai:
        def slow_call(*args, **kwargs):
            import time
            time.sleep(0.05)
            mock_resp = AsyncMock()
            mock_resp.text = "{}"
            return mock_resp
        mock_genai.models.generate_content.side_effect = slow_call

        with pytest.raises(AIProviderException) as exc_info:
            await client.generate_text("Test prompt")
        assert "timed out" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_08_provider_failure_handled_safely():
    mock_provider = AsyncMock()
    mock_provider.generate_json.side_effect = AIProviderException("Gemini server error 500")
    mock_provider.generate_response.side_effect = AIProviderException("Gemini server error 500")

    agent = WaterStressAgent(mock_provider)
    with pytest.raises(AIProviderException):
        await agent.evaluate({"risk": {}})


@pytest.mark.asyncio
async def test_09_confidence_clamped_and_validated():
    proposal = AIProposal(
        agent_type="WATER_AGENT",
        risk_type="water_stress",
        recommendation="Review irrigation schedule.",
        rationale="Low root-zone moisture.",
        confidence=0.8765,
        urgency="high",
    )
    assert proposal.confidence == 0.88  # Rounded to 2 decimal places


# ==============================================================================
# 3. RBAC, CONTEXT SANITIZATION & FARM ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_10_ai_cannot_access_another_farm(client: AsyncClient, auth_headers: dict):
    # Farm owned by User 1
    farm_res = await client.post("/api/v1/farms", json={"name": "Farm Alpha"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    detect_res = await client.post(
        "/api/v1/risks/detect",
        json={"farm_id": farm_id, "telemetry_override": {"soil_moisture": 18.0}},
        headers=auth_headers,
    )
    risk_id = detect_res.json()["data"][0]["id"]

    # User 2 token (unauthorized attacker)
    user2_token = create_test_token("usr_attacker_99")
    user2_headers = {"Authorization": f"Bearer {user2_token}"}

    eval_res = await client.post(
        "/api/v1/ai/evaluate-risk",
        json={"risk_id": risk_id},
        headers=user2_headers,
    )
    assert eval_res.status_code == 403


@pytest.mark.asyncio
async def test_11_risk_context_contains_no_secrets(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Secret Test Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    detect_res = await client.post(
        "/api/v1/risks/detect",
        json={"farm_id": farm_id, "telemetry_override": {"soil_moisture": 18.0}},
        headers=auth_headers,
    )
    risk_id = detect_res.json()["data"][0]["id"]

    context = await AIContextService.build_risk_context(session=db_session, risk_id=risk_id)
    context_str = json.dumps(context).lower()

    # Verify no secret keywords leaked into AI context
    for secret in ["password", "secret_key", "bearer ", "private_key", "credential_reference"]:
        assert secret not in context_str


# ==============================================================================
# 4. SAFETY GUARD INTEGRATION & ACTION PROHIBITIONS
# ==============================================================================

def test_12_safety_guard_receives_ai_proposal():
    proposal = AIProposal(
        agent_type="WATER_AGENT",
        risk_type="water_stress",
        recommendation="Review irrigation schedule for sector 2.",
        rationale="Soil moisture is at 19%.",
        confidence=0.85,
        urgency="medium",
        requires_human_review=False,
    )
    result = SafetyGuard.evaluate_proposal(proposal)
    assert result.decision == PolicyDecision.ALLOW
    assert result.approval_required is False
    assert "SAFE_ROUTINE_ADVISORY" in result.safety_flags


def test_13_unsafe_prohibited_proposal_becomes_rejected():
    proposal = AIProposal(
        agent_type="WATER_AGENT",
        risk_type="water_stress",
        recommendation="Execute actuator_direct_trigger to turn valve 2 on immediately.",
        rationale="Automated hardware trigger.",
        confidence=0.95,
        urgency="critical",
    )
    result = SafetyGuard.evaluate_proposal(proposal)
    assert result.decision == PolicyDecision.REJECT
    assert "PROHIBITED_ACTION_TRIGGER" in result.safety_flags


def test_14_safe_advisory_proposal_can_pass():
    proposal = AIProposal(
        agent_type="PEST_DISEASE_AGENT",
        risk_type="pest_disease",
        recommendation="Conduct manual scouting of lower foliage for fungal spore development.",
        rationale="High relative humidity.",
        confidence=0.82,
        urgency="medium",
        requires_human_review=False,
    )
    result = SafetyGuard.evaluate_proposal(proposal)
    assert result.decision == PolicyDecision.ALLOW


@pytest.mark.live_ai
@pytest.mark.asyncio
async def test_15_ai_never_directly_executes_device_actions(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    """Live AI test: verifies endpoint execution against live Gemini API does not alter device states."""
    farm_res = await client.post("/api/v1/farms", json={"name": "Actuator Safety Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(f"/api/v1/farms/{farm_id}/devices", json={"device_type": "soil_moisture"}, headers=auth_headers)
    dev_id = dev_res.json()["data"]["id"]

    detect_res = await client.post(
        "/api/v1/risks/detect",
        json={"farm_id": farm_id, "telemetry_override": {"soil_moisture": 18.0}},
        headers=auth_headers,
    )
    risk_id = detect_res.json()["data"][0]["id"]

    # Trigger AI evaluation
    eval_res = await client.post(
        "/api/v1/ai/evaluate-risk",
        json={"risk_id": risk_id},
        headers=auth_headers,
    )
    assert eval_res.status_code == 200

    # Verify device state remains completely unmodified (enabled=True, no actuator state changes)
    dev_query = select(Device).where(Device.id == dev_id)
    dev = (await db_session.execute(dev_query)).scalar_one()
    assert dev.enabled is True


# ==============================================================================
# 5. AGRONOMIC CONSTRAINTS & ADVISORY INTEGRITY
# ==============================================================================

@pytest.mark.asyncio
async def test_16_no_fertilizer_dosage_invented():
    agent = NutrientAgent(MockAIProvider())
    context = {"risk": {"risk_type": "nutrient_deficiency"}, "telemetry": {"nitrogen": 12.0}}
    proposal = await agent.evaluate(context)

    rec = proposal.recommendation.lower()
    # Proposal must not invent arbitrary kg/ha chemical dosing orders
    assert "kg/ha" not in rec
    assert "50 kg" not in rec
    assert "dosing order" not in rec
    assert "sample" in rec or "test" in rec or "review" in rec


@pytest.mark.asyncio
async def test_17_no_definitive_disease_diagnosis_from_weak_evidence():
    agent = PestDiseaseAgent(MockAIProvider())
    context = {"risk": {"risk_type": "pest_disease"}, "telemetry": {"air_humidity": 82.0}}
    proposal = await agent.evaluate(context)

    # Must distinguish risk from diagnosis
    assert "definitely diagnosed" not in proposal.recommendation.lower()
    assert "definitely has" not in proposal.recommendation.lower()
    assert "risk" in proposal.recommendation.lower() or "scouting" in proposal.recommendation.lower()


@pytest.mark.asyncio
async def test_18_market_context_unavailable_does_not_fabricate_prices():
    agent = MarketContextAgent(MockAIProvider())
    context = {"risk": {"risk_type": "market_exposure"}, "telemetry": {}, "observations": []}
    proposal = await agent.evaluate(context)

    assert "unavailable" in proposal.recommendation.lower() or "monitor" in proposal.recommendation.lower()
    assert proposal.confidence <= 0.75


# ==============================================================================
# 6. AUDIT TRAILS & OPENAPI DOCUMENTATION
# ==============================================================================

@pytest.mark.live_ai
@pytest.mark.asyncio
async def test_19_audit_event_generated_on_ai_evaluation(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    """Live AI test: verifies audit event creation after live Gemini evaluation."""
    farm_res = await client.post("/api/v1/farms", json={"name": "AI Audit Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    detect_res = await client.post(
        "/api/v1/risks/detect",
        json={"farm_id": farm_id, "telemetry_override": {"soil_moisture": 17.5}},
        headers=auth_headers,
    )
    risk_id = detect_res.json()["data"][0]["id"]

    eval_res = await client.post(
        "/api/v1/ai/evaluate-risk",
        json={"risk_id": risk_id},
        headers=auth_headers,
    )
    assert eval_res.status_code == 200

    # Verify audit event in database
    audit_res = await db_session.execute(
        select(AuditEvent).where(
            AuditEvent.farm_id == farm_id,
            AuditEvent.entity_id == risk_id,
            AuditEvent.event_type == "ai_proposal_generated",
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None
    assert audit.source == "ai_agent"
    assert audit.after_state["agent_type"] == "WATER_AGENT"


@pytest.mark.asyncio
async def test_20_openapi_documentation_exists(client: AsyncClient):
    res = await client.get(f"{settings.API_V1_STR}/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    paths = schema.get("paths", {})

    assert "/api/v1/ai/evaluate-risk" in paths
    assert "post" in paths["/api/v1/ai/evaluate-risk"]
