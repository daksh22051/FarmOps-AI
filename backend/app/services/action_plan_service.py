"""
Action Plan Management & Deterministic Safety-Gated Execution Service
Converts Risk Assessments and AI Proposals into structured Action Plans,
enforces authoritative deterministic safety rules, and manages human approval workflow.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.plan import ActionPlan
from app.models.risk import RiskAssessment
from app.models.audit import AuditEvent
from app.schemas.ai import AIProposal
from app.schemas.plan import ActionPlanCreate, ActionPlanStep
from app.ai.safety_guard import SafetyGuard, PolicyDecision
from app.services.task_service import TaskService
from app.services.alert_service import AlertService
from app.core.exceptions import EntityNotFoundException, FarmOpsException


class ActionPlanService:
    @staticmethod
    async def create_plan_from_proposal(
        session: AsyncSession,
        farm_id: str,
        proposal: AIProposal,
        zone_id: Optional[str] = None,
        risk_id: Optional[str] = None,
        actor_id: Optional[str] = None,
    ) -> ActionPlan:
        """
        Builds an ActionPlan from a validated AIProposal and evaluates it through the Deterministic Safety Guard.
        """
        # 1. If risk_id is present, resolve and verify ownership
        if risk_id:
            risk_res = await session.execute(select(RiskAssessment).where(RiskAssessment.id == risk_id))
            risk = risk_res.scalars().first()
            if not risk:
                raise EntityNotFoundException("RiskAssessment", risk_id)
            if risk.farm_id != farm_id:
                raise FarmOpsException(status_code=403, detail="RiskAssessment does not belong to specified farm.")
            if not zone_id:
                zone_id = risk.zone_id

        # 2. Run Authoritative Deterministic Safety Guard
        safety_res = SafetyGuard.evaluate_proposal(proposal)

        # 3. Determine initial plan approval state based on safety decision
        if safety_res.decision == PolicyDecision.ALLOW:
            approval_state = "approved"
            approval_required = False
        elif safety_res.decision in [PolicyDecision.APPROVAL_REQUIRED, PolicyDecision.ESCALATE]:
            approval_state = "pending_approval"
            approval_required = True
        else:  # REJECT
            approval_state = "rejected"
            approval_required = False

        # 4. Assemble structured evidence and steps
        evidence: Dict[str, Any] = {
            "title": f"Advisory: {proposal.agent_type.upper()} - {proposal.risk_type}",
            "objective": proposal.recommendation,
            "steps": [
                {"step_number": i + 1, "title": s.strip(), "done": False}
                for i, s in enumerate(proposal.recommendation.split(". "))
                if s.strip()
            ] or [{"step_number": 1, "title": proposal.recommendation, "done": False}],
            "source": "ai_agent",
            "agent_type": proposal.agent_type,
            "uncertainty": proposal.uncertainty,
            "assumptions": proposal.assumptions,
            "evidence_refs": proposal.evidence_refs,
        }

        plan = ActionPlan(
            farm_id=farm_id,
            zone_id=zone_id,
            risk_id=risk_id,
            source_risk_ids=[risk_id] if risk_id else None,
            action_type=proposal.agent_type,
            action_summary=proposal.recommendation,
            priority=proposal.urgency,
            confidence=proposal.confidence,
            evidence=evidence,
            safety_flags=safety_res.safety_flags,
            approval_required=approval_required,
            approval_state=approval_state,
            policy_decision=safety_res.decision.value,
            rationale=f"{proposal.rationale}\nSafety Policy: {safety_res.rationale}".strip(),
            version=1,
        )
        session.add(plan)
        await session.flush()

        # 5. Audit Plan Creation
        session.add(
            AuditEvent(
                farm_id=farm_id,
                entity_type="action_plan",
                entity_id=plan.id,
                actor_id=actor_id or "system",
                event_type="action_plan_created",
                source="ai_agent",
                policy_version="deterministic_safety_guard_v1",
                after_state={
                    "policy_decision": plan.policy_decision,
                    "approval_state": plan.approval_state,
                    "approval_required": plan.approval_required,
                    "confidence": plan.confidence,
                },
            )
        )

        # 6. Apply Execution & Alert Branching
        if safety_res.decision == PolicyDecision.ALLOW:
            # Safe routine plan -> immediately instantiate executable task
            await TaskService.create_task_for_plan(session, plan, source="safety_guard_auto_approval", auto_commit=False)
        elif safety_res.decision in [PolicyDecision.APPROVAL_REQUIRED, PolicyDecision.ESCALATE]:
            # Log approval required audit event and create notification alert
            session.add(
                AuditEvent(
                    farm_id=farm_id,
                    entity_type="action_plan",
                    entity_id=plan.id,
                    actor_id=actor_id or "system",
                    event_type="action_plan_approval_required",
                    source="safety_guard",
                    after_state={"reasons": safety_res.safety_flags},
                )
            )
            await AlertService.create_alert(
                session=session,
                farm_id=farm_id,
                zone_id=zone_id,
                risk_id=risk_id,
                severity="warning",
                message=f"Action Plan requires agronomist approval: {plan.action_summary}",
                dedupe_key=f"action_plan_approval_required:{plan.id}",
            )
        elif safety_res.decision == PolicyDecision.REJECT:
            # Log rejection audit event and create rejection alert
            session.add(
                AuditEvent(
                    farm_id=farm_id,
                    entity_type="action_plan",
                    entity_id=plan.id,
                    actor_id=actor_id or "system",
                    event_type="action_plan_rejected",
                    source="safety_guard",
                    after_state={"reasons": safety_res.safety_flags, "rationale": safety_res.rationale},
                )
            )
            await AlertService.create_alert(
                session=session,
                farm_id=farm_id,
                zone_id=zone_id,
                risk_id=risk_id,
                severity="warning",
                message=f"Action Plan rejected by safety policy: {safety_res.rationale}",
                dedupe_key=f"action_plan_rejected:{plan.id}",
            )

        await session.commit()
        await session.refresh(plan)
        return plan

    @staticmethod
    async def create_plan(
        session: AsyncSession,
        data: ActionPlanCreate,
        actor_id: Optional[str] = None,
    ) -> ActionPlan:
        """
        Creates an ActionPlan from request schema, evaluating deterministic safety guard.
        """
        if data.ai_proposal:
            farm_id = data.farm_id or "unspecified"
            return await ActionPlanService.create_plan_from_proposal(
                session=session,
                farm_id=farm_id,
                proposal=data.ai_proposal,
                zone_id=data.zone_id,
                risk_id=data.risk_id,
                actor_id=actor_id,
            )

        if not data.farm_id:
            raise FarmOpsException(status_code=400, detail="farm_id is required to create an action plan.")

        # Evaluate deterministic safety rules for custom/manual plan
        action_type = data.action_type or data.title or "routine_operation"
        action_summary = data.action_summary or data.title or "Operational Action"
        safety_res = SafetyGuard.evaluate_plan(
            action_type=action_type,
            action_summary=action_summary,
            confidence=data.confidence,
            evidence=data.evidence,
            estimated_cost=data.estimated_cost,
        )

        if safety_res.decision == PolicyDecision.ALLOW:
            approval_state = "approved"
            approval_required = False
        elif safety_res.decision in [PolicyDecision.APPROVAL_REQUIRED, PolicyDecision.ESCALATE]:
            approval_state = "pending_approval"
            approval_required = True
        else:
            approval_state = "rejected"
            approval_required = False

        evidence = dict(data.evidence or {})
        if data.steps:
            evidence["steps"] = [s.model_dump() for s in data.steps]
        if data.title:
            evidence["title"] = data.title
        if data.objective:
            evidence["objective"] = data.objective
        if data.estimated_duration_minutes:
            evidence["estimated_duration_minutes"] = data.estimated_duration_minutes
        evidence["source"] = data.source or "user"

        plan = ActionPlan(
            farm_id=data.farm_id,
            zone_id=data.zone_id,
            risk_id=data.risk_id,
            source_risk_ids=data.source_risk_ids or ([data.risk_id] if data.risk_id else None),
            action_type=action_type,
            action_summary=action_summary,
            priority=data.priority,
            confidence=data.confidence,
            evidence=evidence,
            estimated_cost=data.estimated_cost,
            safety_flags=safety_res.safety_flags,
            approval_required=approval_required,
            approval_state=approval_state,
            policy_decision=safety_res.decision.value,
            rationale=f"{data.rationale or ''}\nSafety Policy: {safety_res.rationale}".strip(),
            version=1,
        )
        session.add(plan)
        await session.flush()

        session.add(
            AuditEvent(
                farm_id=data.farm_id,
                entity_type="action_plan",
                entity_id=plan.id,
                actor_id=actor_id,
                event_type="action_plan_created",
                source=data.source or "user",
                after_state={"policy_decision": plan.policy_decision, "approval_state": plan.approval_state},
            )
        )

        if safety_res.decision == PolicyDecision.ALLOW:
            await TaskService.create_task_for_plan(session, plan, source="safety_guard_auto_approval", auto_commit=False)
        elif safety_res.decision in [PolicyDecision.APPROVAL_REQUIRED, PolicyDecision.ESCALATE]:
            session.add(
                AuditEvent(
                    farm_id=data.farm_id,
                    entity_type="action_plan",
                    entity_id=plan.id,
                    actor_id=actor_id,
                    event_type="action_plan_approval_required",
                    source="safety_guard",
                    after_state={"reasons": safety_res.safety_flags},
                )
            )
            await AlertService.create_alert(
                session=session,
                farm_id=data.farm_id,
                zone_id=data.zone_id,
                risk_id=data.risk_id,
                severity="warning",
                message=f"Action Plan requires approval: {plan.action_summary}",
                dedupe_key=f"action_plan_approval_required:{plan.id}",
            )
        elif safety_res.decision == PolicyDecision.REJECT:
            session.add(
                AuditEvent(
                    farm_id=data.farm_id,
                    entity_type="action_plan",
                    entity_id=plan.id,
                    actor_id=actor_id,
                    event_type="action_plan_rejected",
                    source="safety_guard",
                    after_state={"reasons": safety_res.safety_flags},
                )
            )

        await session.commit()
        await session.refresh(plan)
        return plan

    @staticmethod
    async def approve_plan(
        session: AsyncSession,
        plan_id: str,
        reviewer_id: str,
        review_notes: Optional[str] = None,
    ) -> ActionPlan:
        """
        Authoritatively approves an ActionPlan, transitioning to APPROVED and creating the executable Task.
        """
        plan = await ActionPlanService.get_plan(session, plan_id)

        # 1. Reject if plan was deemed unsafe by policy or already rejected
        if plan.policy_decision == "REJECT" or plan.approval_state == "rejected":
            raise FarmOpsException(
                status_code=400,
                detail="Cannot approve an action plan rejected by deterministic safety policy.",
            )

        # 2. Cannot approve completed or cancelled plan
        if plan.approval_state in ["completed", "cancelled"]:
            raise FarmOpsException(
                status_code=400,
                detail=f"Cannot approve an action plan in '{plan.approval_state}' state.",
            )

        # 3. Idempotent check: if already approved, ensure task exists and return cleanly
        if plan.approval_state in ["approved", "auto_approved"]:
            await TaskService.create_task_for_plan(session, plan, source="user_approval", auto_commit=False)
            await session.commit()
            await session.refresh(plan)
            return plan

        # 4. Transition state
        plan.approval_state = "approved"
        if review_notes:
            plan.rationale = f"{plan.rationale or ''}\nReviewer Note: {review_notes}".strip()

        # 5. Create Task exactly once
        await TaskService.create_task_for_plan(session, plan, source="user_approval", auto_commit=False)

        # 6. Audit approval
        session.add(
            AuditEvent(
                farm_id=plan.farm_id,
                entity_type="action_plan",
                entity_id=plan.id,
                actor_id=reviewer_id,
                event_type="action_plan_approved",
                source="user",
                after_state={"approval_state": "approved", "reviewer_id": reviewer_id},
            )
        )

        # 7. Fire alert
        await AlertService.create_alert(
            session=session,
            farm_id=plan.farm_id,
            zone_id=plan.zone_id,
            risk_id=plan.risk_id,
            severity="info",
            message=f"Action Plan approved: {plan.action_summary}",
            dedupe_key=f"action_plan_approved:{plan.id}",
        )

        await session.commit()
        await session.refresh(plan)
        return plan

    @staticmethod
    async def reject_plan(
        session: AsyncSession,
        plan_id: str,
        reviewer_id: str,
        review_notes: Optional[str] = None,
    ) -> ActionPlan:
        """
        Rejects an ActionPlan, preventing executable task creation.
        """
        plan = await ActionPlanService.get_plan(session, plan_id)

        # Idempotent return if already rejected
        if plan.approval_state == "rejected":
            return plan

        if plan.approval_state in ["completed", "cancelled"]:
            raise FarmOpsException(
                status_code=400,
                detail=f"Cannot reject an action plan in '{plan.approval_state}' state.",
            )

        plan.approval_state = "rejected"
        if review_notes:
            plan.rationale = f"{plan.rationale or ''}\nRejection Note: {review_notes}".strip()

        # Audit rejection
        session.add(
            AuditEvent(
                farm_id=plan.farm_id,
                entity_type="action_plan",
                entity_id=plan.id,
                actor_id=reviewer_id,
                event_type="action_plan_rejected",
                source="user",
                after_state={"approval_state": "rejected", "reviewer_id": reviewer_id},
            )
        )

        # Fire alert
        await AlertService.create_alert(
            session=session,
            farm_id=plan.farm_id,
            zone_id=plan.zone_id,
            risk_id=plan.risk_id,
            severity="warning",
            message=f"Action Plan rejected by agronomist: {plan.action_summary}",
            dedupe_key=f"action_plan_rejected:{plan.id}",
        )

        await session.commit()
        await session.refresh(plan)
        return plan

    @staticmethod
    async def get_plans(
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        policy_decision: Optional[str] = None,
        approval_state: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[ActionPlan]:
        query = select(ActionPlan).where(ActionPlan.farm_id == farm_id)
        if zone_id:
            query = query.where(ActionPlan.zone_id == zone_id)
        if policy_decision:
            query = query.where(ActionPlan.policy_decision == policy_decision)
        effective_status = approval_state or status
        if effective_status:
            # Handle normalized status string
            query = query.where(
                (ActionPlan.approval_state == effective_status.lower()) |
                (ActionPlan.approval_state == effective_status)
            )

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
