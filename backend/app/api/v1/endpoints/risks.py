"""
Risk Assessment & AI Evaluation Endpoints with Farm-Scoped Authorization
Supports direct risk retrieval, multi-agent orchestrations, and deterministic risk evaluations.
"""

from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_risk_access,
)
from app.models.risk import RiskAssessment
from app.models.farm import Farm
from app.services.risk_service import RiskService
from app.services.risk_detection_service import RiskDetectionService
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
    Triggers multi-agent risk assessment & action plan synthesis. Verifies user has access to target farm.
    """
    await check_farm_access(db, farm_id=payload.farm_id, user=user)
    result = await orchestrator.evaluate_and_orchestrate(
        session=db,
        farm_id=payload.farm_id,
        zone_id=payload.zone_id,
        telemetry=payload.telemetry_override or {},
        actor_id=user.id,
    )
    return APIResponse(success=True, data=result, message="Risk evaluation and plan synthesis complete")


@router.post("/detect", response_model=APIResponse[List[RiskAssessmentResponse]])
async def detect_deterministic_risks(
    payload: RiskAssessmentEvaluateRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Triggers deterministic risk detection engine on latest sensor telemetry & observations.
    """
    await check_farm_access(db, farm_id=payload.farm_id, user=user)
    if payload.zone_id:
        risks = await RiskDetectionService.evaluate_zone(
            session=db,
            farm_id=payload.farm_id,
            zone_id=payload.zone_id,
            telemetry_override=payload.telemetry_override,
            actor_id=user.id,
        )
    else:
        risks = await RiskDetectionService.evaluate_farm(
            session=db,
            farm_id=payload.farm_id,
            telemetry_override=payload.telemetry_override,
            actor_id=user.id,
        )
    return APIResponse(
        success=True,
        data=[RiskAssessmentResponse.model_validate(r) for r in risks],
        message=f"Deterministic risk evaluation complete. {len(risks)} active risks assessed.",
    )


@router.get("", response_model=APIResponse[List[RiskAssessmentResponse]])
async def list_risks(
    farm_id: str = Query(..., description="Farm to list risks for"),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    risk_type: Optional[str] = Query(None, description="Filter by risk type"),
    severity: Optional[str] = Query(None, description="Filter: low, medium, high, critical"),
    status: Optional[str] = Query(None, description="Filter: open, acknowledged, resolved, dismissed"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Risk feed for a farm with status/type/severity filters and pagination.

    This is the PRD's documented collection surface (`GET /risks?farm_id=...`).
    """
    await check_farm_access(db, farm_id=farm_id, user=user)
    risks = await RiskService.get_risks(
        db,
        farm_id=farm_id,
        zone_id=zone_id,
        risk_type=risk_type,
        severity=severity,
        status=status,
        limit=limit,
        offset=offset,
    )
    return APIResponse(
        success=True,
        data=[RiskAssessmentResponse.model_validate(r) for r in risks],
        message=f"Retrieved {len(risks)} risk candidates.",
        meta={"limit": limit, "offset": offset, "count": len(risks)},
    )


@router.get("/detail/{risk_id}", response_model=APIResponse[RiskAssessmentResponse])
async def get_risk_detail(
    risk_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves single risk details by ID. Verifies user has access to owning farm."""
    risk = await verify_risk_access(risk_id=risk_id, db=db, user=user)
    return APIResponse(success=True, data=RiskAssessmentResponse.model_validate(risk))


@router.get("/{risk_id}", response_model=APIResponse[Union[RiskAssessmentResponse, List[RiskAssessmentResponse]]])
async def get_risk_or_farm_risks(
    risk_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID (when querying farm)"),
    risk_type: Optional[str] = Query(None, description="Filter by risk type"),
    severity: Optional[str] = Query(None, description="Filter by severity: low, medium, high, critical"),
    status: Optional[str] = Query(None, description="Filter by status: open, acknowledged, resolved, dismissed"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Retrieves a single risk assessment by its risk ID (GET /risks/{risk_id}),
    or lists risks for a farm if a farm ID is supplied (GET /risks/{farm_id}).
    Enforces strict farm-scoped authorization.
    """
    # 1. Check if risk_id refers to an existing RiskAssessment
    risk_query = select(RiskAssessment).where(RiskAssessment.id == risk_id)
    risk_res = await db.execute(risk_query)
    risk = risk_res.scalar_one_or_none()

    if risk:
        await check_farm_access(db, farm_id=risk.farm_id, user=user)
        return APIResponse(success=True, data=RiskAssessmentResponse.model_validate(risk))

    # 2. Check if risk_id is a farm_id (backward compatibility)
    farm_query = select(Farm).where(Farm.id == risk_id)
    farm_res = await db.execute(farm_query)
    farm = farm_res.scalar_one_or_none()

    if farm:
        await check_farm_access(db, farm_id=farm.id, user=user)
        risks = await RiskService.get_risks(
            db,
            farm_id=farm.id,
            zone_id=zone_id,
            risk_type=risk_type,
            severity=severity,
            status=status,
            limit=limit,
        )
        return APIResponse(success=True, data=[RiskAssessmentResponse.model_validate(r) for r in risks])

    # 3. Neither risk nor farm found -> trigger standard not found via verify_risk_access
    await verify_risk_access(risk_id=risk_id, db=db, user=user)
    return APIResponse(success=False, message="Not found")
