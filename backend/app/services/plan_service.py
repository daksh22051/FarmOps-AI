"""
Action Plan Management and Human Review Service
"""

from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.plan import ActionPlan
from app.models.task import Task
from app.models.audit import AuditEvent
from app.schemas.plan import ActionPlanApprovalRequest
from app.core.exceptions import EntityNotFoundException


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
        query = select(ActionPlan).where(ActionPlan.farm_id == farm_id)
        if zone_id:
            query = query.where(ActionPlan.zone_id == zone_id)
        if policy_decision:
            query = query.where(ActionPlan.policy_decision == policy_decision)
        if approval_state:
            query = query.where(ActionPlan.approval_state == approval_state)

        query = query.order_by(desc(ActionPlan.created_at)).limit(limit)
        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def get_plan(session: AsyncSession, plan_id: str) -> ActionPlan:
        query = select(ActionPlan).where(ActionPlan.id == plan_id)
        res = await session.execute(query)
        plan = res.scalar_one_or_none()
        if not plan:
            raise EntityNotFoundException("ActionPlan", plan_id)
        return plan

    @staticmethod
    async def review_plan(
        session: AsyncSession,
        plan_id: str,
        reviewer_id: str,
        data: ActionPlanApprovalRequest,
    ) -> ActionPlan:
        plan = await PlanService.get_plan(session, plan_id)
        plan.approval_state = data.decision
        if data.review_notes:
            plan.rationale = f"{plan.rationale or ''}\nReviewer Note: {data.review_notes}"

        # If user explicitly approved the plan, instantiate Task
        if data.decision == "approved":
            task = Task(
                farm_id=plan.farm_id,
                zone_id=plan.zone_id,
                plan_id=plan.id,
                status="pending",
                notes=f"Approved action plan: {plan.action_summary}",
                checklist=[{"item": f"Execute {plan.action_type}", "done": False}],
            )
            session.add(task)

        # Audit plan review
        session.add(
            AuditEvent(
                farm_id=plan.farm_id,
                entity_type="action_plan",
                entity_id=plan.id,
                actor_id=reviewer_id,
                event_type="plan_reviewed",
                after_state={"approval_state": plan.approval_state, "reviewer_id": reviewer_id},
                source="user",
            )
        )

        await session.commit()
        await session.refresh(plan)
        return plan
