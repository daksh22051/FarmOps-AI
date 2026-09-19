"""
Action Plans & Safety-Gated Human Approval Endpoints (/api/v1/action-plans and /api/v1/plans)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_plan_access,
)
from app.services.action_plan_service import ActionPlanService
from app.schemas.plan import (
    ActionPlanCreate,
    ActionPlanResponse,
    ActionPlanApprovalRequest,
)
from app.schemas.common import APIResponse

router = APIRouter(tags=["Action Plans & Human Approval"])


# 1. Create Action Plan
@router.post("/action-plans", response_model=APIResponse[ActionPlanResponse], status_code=status.HTTP_201_CREATED)
@router.post("/plans", response_model=APIResponse[ActionPlanResponse], status_code=status.HTTP_201_CREATED)
async def create_action_plan(
    payload: ActionPlanCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Creates an ActionPlan with deterministic safety guard evaluation.
    If safety decision is ALLOW, generates an executable Task immediately.
    If APPROVAL_REQUIRED, transitions to pending_approval.
    """
    if payload.farm_id:
        await check_farm_access(
            db,
            farm_id=payload.farm_id,
            user=user,
            allowed_roles=["owner", "manager", "agronomist", "operator"],
        )
    plan = await ActionPlanService.create_plan(db, data=payload, actor_id=user.id)
    return APIResponse(
        success=True,
        data=ActionPlanResponse.model_validate(plan),
        message="Action plan created successfully.",
    )


# 2. List Action Plans by Farm
@router.get("/farms/{farm_id}/action-plans", response_model=APIResponse[List[ActionPlanResponse]])
@router.get("/plans/{farm_id}", response_model=APIResponse[List[ActionPlanResponse]])
async def list_action_plans(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    policy_decision: Optional[str] = Query(None, description="Filter: ALLOW, APPROVAL_REQUIRED, ESCALATE, REJECT"),
    approval_state: Optional[str] = Query(None, description="Filter: draft, pending_approval, approved, rejected, executing, completed, cancelled"),
    status: Optional[str] = Query(None, description="Alias for approval_state"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lists action plans for a farm. Enforces farm-scoped authorization.
    """
    await check_farm_access(db, farm_id=farm_id, user=user)
    plans = await ActionPlanService.get_plans(
        session=db,
        farm_id=farm_id,
        zone_id=zone_id,
        policy_decision=policy_decision,
        approval_state=approval_state or status,
        limit=limit,
    )
    return APIResponse(
        success=True,
        data=[ActionPlanResponse.model_validate(p) for p in plans],
        message=f"Retrieved {len(plans)} action plans.",
    )


# 3. Retrieve Single Action Plan Details
@router.get("/action-plans/{action_plan_id}", response_model=APIResponse[ActionPlanResponse])
@router.get("/plans/detail/{plan_id}", response_model=APIResponse[ActionPlanResponse])
async def get_action_plan_detail(
    action_plan_id: Optional[str] = None,
    plan_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Retrieves action plan details. Verifies user has access to the owning farm.
    """
    target_id = action_plan_id or plan_id
    plan = await verify_plan_access(plan_id=target_id, db=db, user=user)
    return APIResponse(success=True, data=ActionPlanResponse.model_validate(plan))


# 4. Authoritatively Approve Action Plan
@router.post("/action-plans/{action_plan_id}/approve", response_model=APIResponse[ActionPlanResponse])
async def approve_action_plan(
    action_plan_id: str,
    payload: Optional[ActionPlanApprovalRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Authoritatively approves an action plan and instantiates an executable Task exactly once.
    Requires owner, manager, or agronomist role on the farm.
    """
    plan = await verify_plan_access(plan_id=action_plan_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=plan.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist"],
    )
    review_notes = payload.review_notes or payload.notes if payload else None
    approved = await ActionPlanService.approve_plan(
        session=db,
        plan_id=action_plan_id,
        reviewer_id=user.id,
        review_notes=review_notes,
    )
    return APIResponse(
        success=True,
        data=ActionPlanResponse.model_validate(approved),
        message="Action plan approved and task created successfully.",
    )


# 5. Authoritatively Reject Action Plan
@router.post("/action-plans/{action_plan_id}/reject", response_model=APIResponse[ActionPlanResponse])
async def reject_action_plan(
    action_plan_id: str,
    payload: Optional[ActionPlanApprovalRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Rejects an action plan and prevents executable task creation.
    Requires owner, manager, or agronomist role on the farm.
    """
    plan = await verify_plan_access(plan_id=action_plan_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=plan.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist"],
    )
    review_notes = payload.review_notes or payload.notes if payload else None
    rejected = await ActionPlanService.reject_plan(
        session=db,
        plan_id=action_plan_id,
        reviewer_id=user.id,
        review_notes=review_notes,
    )
    return APIResponse(
        success=True,
        data=ActionPlanResponse.model_validate(rejected),
        message="Action plan rejected successfully.",
    )


# 6. Legacy /plans/{plan_id}/review Endpoint for Backward Compatibility
@router.post("/plans/{plan_id}/review", response_model=APIResponse[ActionPlanResponse])
async def review_action_plan_legacy(
    plan_id: str,
    payload: ActionPlanApprovalRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Legacy human-in-the-loop review endpoint.
    """
    plan = await verify_plan_access(plan_id=plan_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=plan.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist"],
    )
    decision = payload.decision or "approved"
    notes = payload.review_notes or payload.notes
    if decision == "approved":
        result = await ActionPlanService.approve_plan(
            session=db,
            plan_id=plan_id,
            reviewer_id=user.id,
            review_notes=notes,
        )
    else:
        result = await ActionPlanService.reject_plan(
            session=db,
            plan_id=plan_id,
            reviewer_id=user.id,
            review_notes=notes,
        )
    return APIResponse(
        success=True,
        data=ActionPlanResponse.model_validate(result),
        message=f"Plan status updated to '{decision}'.",
    )
