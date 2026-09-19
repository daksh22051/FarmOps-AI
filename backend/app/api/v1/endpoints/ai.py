"""
AI Evaluation Endpoints with Farm-Scoped Authorization
Enables structured LLM reasoning over detected risks with deterministic SafetyGuard validation.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, AuthUser, verify_risk_access
from app.services.ai_context_service import AIContextService
from app.services.audit_service import AuditService
from app.ai.provider import get_ai_provider
from app.ai.agents.water_stress import WaterStressAgent
from app.ai.agents.pest_disease import PestDiseaseAgent
from app.ai.agents.nutrient import NutrientAgent
from app.ai.agents.market_context import MarketContextAgent
from app.ai.safety_guard import SafetyGuard
from app.schemas.ai import AIEvaluationRequest, AIEvaluationResponse, AISafetyDecision, AIProposal
from app.schemas.common import APIResponse

router = APIRouter(prefix="/ai", tags=["AI Agents & Reasoning"])


def _select_agent_for_risk(risk_type: str, provider=None):
    clean_type = (risk_type or "").strip().lower()
    if clean_type in ["water_stress", "irrigation"]:
        return WaterStressAgent(provider)
    elif clean_type in ["pest_disease", "pest", "disease", "pathogen"]:
        return PestDiseaseAgent(provider)
    elif clean_type in ["nutrient_deficiency", "nutrient", "soil_health"]:
        return NutrientAgent(provider)
    elif clean_type in ["market_exposure", "market"]:
        return MarketContextAgent(provider)
    return WaterStressAgent(provider)


@router.post("/evaluate-risk", response_model=APIResponse[AIEvaluationResponse], status_code=status.HTTP_200_OK)
async def evaluate_risk_with_ai(
    payload: AIEvaluationRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Evaluates a specific RiskAssessment using the appropriate specialized AI agent.
    Routes candidate proposal through the deterministic SafetyGuard before returning.
    Enforces strict farm-scoped authorization.
    """
    # 1. Authorize user for the risk's owning farm
    risk = await verify_risk_access(risk_id=payload.risk_id, db=db, user=user)

    # 2. Build aggregated, secret-free agronomic context
    context = await AIContextService.build_risk_context(session=db, risk_id=payload.risk_id)

    # 3. Select appropriate domain agent
    provider = get_ai_provider()
    agent = _select_agent_for_risk(risk.risk_type, provider=provider)

    # 4. Generate structured AI proposal
    proposal: AIProposal = await agent.evaluate(context)

    # 5. Evaluate proposal through authoritative deterministic SafetyGuard
    safety_eval = SafetyGuard.evaluate_proposal(proposal=proposal, context=context)

    safety_decision = AISafetyDecision(
        decision=safety_eval.decision.value.lower(),
        approval_required=safety_eval.approval_required,
        safety_flags=safety_eval.safety_flags,
        rationale=safety_eval.rationale,
        requires_escalation=safety_eval.requires_escalation,
    )

    # 6. Audit AI proposal generation
    await AuditService.log_event(
        session=db,
        event_type="ai_proposal_generated",
        entity_type="risk_assessment",
        farm_id=risk.farm_id,
        entity_id=risk.id,
        actor_id=user.id,
        after_state={
            "agent_type": proposal.agent_type,
            "risk_type": proposal.risk_type,
            "recommendation": proposal.recommendation,
            "confidence": proposal.confidence,
            "safety_decision": safety_decision.decision,
            "safety_flags": safety_decision.safety_flags,
        },
        source="ai_agent",
        model_version=agent.version,
    )

    response_data = AIEvaluationResponse(
        risk=context["risk"],
        proposal=proposal,
        safety=safety_decision,
    )

    return APIResponse(
        success=True,
        data=response_data,
        message=f"AI evaluation complete by {agent.agent_type}. Safety policy: {safety_decision.decision.upper()}.",
    )


from pydantic import BaseModel
from app.services.vision_service import VisionService, FarmVisionInspectionResult

class FarmPhotoInspectionRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"

@router.post("/inspect-farm-photo", response_model=APIResponse[FarmVisionInspectionResult], status_code=status.HTTP_200_OK)
async def inspect_farm_photo_endpoint(
    payload: FarmPhotoInspectionRequest,
):
    """
    Inspects an uploaded farm photo using Gemini Computer Vision.
    Validates if the image is a genuine farm/crop/soil photograph.
    Rejects code screenshots, documents, selfies, and software UIs with actionable reasons.
    """
    result = await VisionService.inspect_farm_photo(
        image_base64=payload.image_base64,
        mime_type=payload.mime_type or "image/jpeg"
    )
    
    status_msg = "Farm photo verified successfully." if result.is_valid_farm else f"Invalid farm photo: {result.rejection_reason}"
    
    return APIResponse(
        success=result.is_valid_farm,
        data=result,
        message=status_msg
    )

