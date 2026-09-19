"""
Risk Assessment & AI Evaluation Endpoints
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
from app.services.risk_service import RiskService
from app.ai.orchestrator import PlanOrchestrator
from app.schemas.risk import RiskAssessmentResponse, RiskAssessmentEvaluateRequest
from app.schemas.common import APIResponse

router = APIRouter(prefix="/risks", tags=["Risk Assessments & AI Agents"])

orchestrator = PlanOrchestrator()


@router.post("/evaluate", response_model=APIResponse[Dict[str, Any]])
async def evaluate_risks(
    payload: RiskAssessmentEvaluateRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Triggers multi-agent risk assessment across Water Stress, Pest & Disease,
    Nutrient, and Market Context agents, applying Deterministic Safety Guard.
    """
    result = await orchestrator.evaluate_and_orchestrate(
        session=db,
        farm_id=payload.farm_id,
        zone_id=payload.zone_id,
        telemetry=payload.telemetry_override or {},
        actor_id=user.id,
    )
    return APIResponse(success=True, data=result, message="Risk evaluation and plan synthesis complete")


@router.get("/{farm_id}", response_model=APIResponse[List[RiskAssessmentResponse]])
async def list_risks(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    severity: Optional[str] = Query(None, description="Filter by severity: low, medium, high, critical"),
    status: Optional[str] = Query(None, description="Filter by status: open, mitigated, resolved"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    risks = await RiskService.get_risks(
        db, farm_id=farm_id, zone_id=zone_id, severity=severity, status=status, limit=limit
    )
    return APIResponse(success=True, data=[RiskAssessmentResponse.model_validate(r) for r in risks])
