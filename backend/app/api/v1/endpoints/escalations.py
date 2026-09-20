"""
Escalation & Expert Review Endpoints with Farm-Scoped Authorization
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_escalation_access,
    get_accessible_farm_ids,
)
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
    """Opens an escalation for expert agronomist review. Verifies farm access."""
    await check_farm_access(db, farm_id=payload.farm_id, user=user)
    esc = await EscalationService.create_escalation(db, data=payload)
    return APIResponse(success=True, data=EscalationResponse.model_validate(esc), message="Escalation opened")


@router.get("", response_model=APIResponse[List[EscalationResponse]])
async def list_all_escalations(
    farm_id: Optional[str] = Query(None, description="Restrict to one farm"),
    status: Optional[str] = Query(None, description="Filter: open, in_review, resolved, rejected"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Escalation queue for the signed-in expert or owner.

    Returns only cases on farms the caller belongs to; it is never a global list.
    """
    allowed = None
    if farm_id:
        await check_farm_access(db, farm_id=farm_id, user=user)
    else:
        allowed = await get_accessible_farm_ids(db, user)

    items = await EscalationService.get_escalations(
        db, farm_id=farm_id, status=status, limit=limit, allowed_farm_ids=allowed
    )
    return APIResponse(
        success=True,
        data=[EscalationResponse.model_validate(e) for e in items],
        message=f"Retrieved {len(items)} escalation case(s).",
        meta={"count": len(items), "limit": limit},
    )


@router.get("/{farm_id}", response_model=APIResponse[List[EscalationResponse]])
async def list_escalations(
    farm_id: str,
    status: Optional[str] = Query(None, description="Filter: open, in_review, resolved, rejected"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists escalations for a farm. Verifies farm membership."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    escalations = await EscalationService.get_escalations(db, farm_id=farm_id, status=status, limit=limit)
    return APIResponse(success=True, data=[EscalationResponse.model_validate(e) for e in escalations])


@router.post("/{escalation_id}/review", response_model=APIResponse[EscalationResponse])
async def submit_escalation_review(
    escalation_id: str,
    payload: EscalationReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Submits expert agronomist review for an escalation.
    Requires agronomist, manager, or owner role.
    """
    esc = await verify_escalation_access(escalation_id=escalation_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=esc.farm_id,
        user=user,
        allowed_roles=["agronomist", "manager", "owner"],
    )
    reviewed = await EscalationService.review_escalation(
        db, escalation_id=escalation_id, reviewer_id=user.id, data=payload
    )
    return APIResponse(success=True, data=EscalationResponse.model_validate(reviewed), message="Escalation review recorded")
