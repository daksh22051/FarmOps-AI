"""
Action Plan Management and Human Review Service
Delegates to ActionPlanService for standardized deterministic safety gating and task generation.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.plan import ActionPlan
from app.schemas.plan import ActionPlanApprovalRequest
from app.services.action_plan_service import ActionPlanService


class PlanService:
    @staticmethod
    async def get_plans(
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        policy_decision: Optional[str] = None,
        approval_state: Optional[str] = None,
        limit: int = 50,
    ) -> List[ActionPlan]:
        return await ActionPlanService.get_plans(
            session=session,
            farm_id=farm_id,
            zone_id=zone_id,
            policy_decision=policy_decision,
            approval_state=approval_state,
            limit=limit,
        )

    @staticmethod
    async def get_plan(session: AsyncSession, plan_id: str) -> ActionPlan:
        return await ActionPlanService.get_plan(session=session, plan_id=plan_id)

    @staticmethod
    async def review_plan(
        session: AsyncSession,
        plan_id: str,
        reviewer_id: str,
        data: ActionPlanApprovalRequest,
    ) -> ActionPlan:
        decision = data.decision or "approved"
        notes = data.review_notes or data.notes
        if decision == "approved":
            return await ActionPlanService.approve_plan(
                session=session,
                plan_id=plan_id,
                reviewer_id=reviewer_id,
                review_notes=notes,
            )
        else:
            return await ActionPlanService.reject_plan(
                session=session,
                plan_id=plan_id,
                reviewer_id=reviewer_id,
                review_notes=notes,
            )
