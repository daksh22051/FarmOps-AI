"""
Escalation & Expert Review Endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
from app.services.escalation_service import EscalationService
from app.schemas.escalation import EscalationCreate, EscalationReviewRequest, EscalationResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/escalations", tags=["Escalations & Expert Review"])


@router.post("", response_model=APIResponse[EscalationResponse], status_code=status.HTTP_201_CREATED)
async def create_escalation(
    payload: EscalationCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    esc = await EscalationService.create_escalation(db, data=payload)
    return APIResponse(success=True, data=EscalationResponse.model_validate(esc), message="Escalation opened")


@router.get("/{farm_id}", response_model=APIResponse[List[EscalationResponse]])
async def list_escalations(
    farm_id: str,
    status: Optional[str] = Query(None, description="Filter: open, in_review, resolved, rejected"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    escalations = await EscalationService.get_escalations(db, farm_id=farm_id, status=status, limit=limit)
    return APIResponse(success=True, data=[EscalationResponse.model_validate(e) for e in escalations])


@router.post("/{escalation_id}/review", response_model=APIResponse[EscalationResponse])
async def submit_escalation_review(
    escalation_id: str,
    payload: EscalationReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    esc = await EscalationService.review_escalation(db, escalation_id=escalation_id, reviewer_id=user.id, data=payload)
    return APIResponse(success=True, data=EscalationResponse.model_validate(esc), message="Escalation review recorded")
