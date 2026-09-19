"""
Action Plans & Human Review Endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
from app.services.plan_service import PlanService
from app.schemas.plan import ActionPlanResponse, ActionPlanApprovalRequest
from app.schemas.common import APIResponse

router = APIRouter(prefix="/plans", tags=["Action Plans & Human Approval"])


@router.get("/{farm_id}", response_model=APIResponse[List[ActionPlanResponse]])
async def list_plans(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    policy_decision: Optional[str] = Query(None, description="Filter: ALLOW, APPROVAL_REQUIRED, ESCALATE, REJECT"),
    approval_state: Optional[str] = Query(None, description="Filter: pending, approved, rejected, auto_approved"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    plans = await PlanService.get_plans(
        db, farm_id=farm_id, zone_id=zone_id, policy_decision=policy_decision, approval_state=approval_state, limit=limit
    )
    return APIResponse(success=True, data=[ActionPlanResponse.model_validate(p) for p in plans])


@router.get("/detail/{plan_id}", response_model=APIResponse[ActionPlanResponse])
async def get_plan_detail(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    plan = await PlanService.get_plan(db, plan_id=plan_id)
    return APIResponse(success=True, data=ActionPlanResponse.model_validate(plan))


@router.post("/{plan_id}/review", response_model=APIResponse[ActionPlanResponse])
async def review_action_plan(
    plan_id: str,
    payload: ActionPlanApprovalRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Human-in-the-loop review endpoint. Approving a plan automatically instantiates a Task.
    """
    plan = await PlanService.review_plan(
        session=db,
        plan_id=plan_id,
        reviewer_id=user.id,
        data=payload,
    )
    return APIResponse(
        success=True,
        data=ActionPlanResponse.model_validate(plan),
        message=f"Plan status updated to '{payload.decision}'.",
    )
