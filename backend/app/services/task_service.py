"""
Task Management Service
Handles field task lifecycle, state transitions, execution tracking, and safety integration.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.task import Task
from app.models.plan import ActionPlan
from app.models.audit import AuditEvent
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.alert_service import AlertService
from app.core.exceptions import EntityNotFoundException, FarmOpsException


# Authoritative task state machine. The PRD requires legal transitions to be
# enforced on the server, not merely disabled in the UI, so every path that
# changes a task's status validates against this map.
TASK_STATUSES = ("pending", "assigned", "approved", "in_progress", "blocked", "completed", "cancelled")

LEGAL_TASK_TRANSITIONS: Dict[str, set] = {
    "pending": {"assigned", "approved", "in_progress", "blocked", "cancelled"},
    "assigned": {"approved", "in_progress", "blocked", "cancelled", "pending"},
    "approved": {"in_progress", "blocked", "cancelled"},
    "in_progress": {"completed", "blocked", "cancelled"},
    "blocked": {"in_progress", "assigned", "pending", "cancelled"},
    # Terminal states: a finished or abandoned task is not reopened. A new task is
    # created instead, so the audit trail keeps both outcomes.
    "completed": set(),
    "cancelled": set(),
}


def assert_legal_task_transition(current: str, target: str) -> None:
    """Raise unless ``current -> target`` is a permitted task transition."""
    if current == target:
        return  # idempotent no-op
    if target not in TASK_STATUSES:
        raise FarmOpsException(
            status_code=422,
            detail=f"'{target}' is not a valid task status.",
            code="INVALID_TASK_STATUS",
        )
    if target not in LEGAL_TASK_TRANSITIONS.get(current, set()):
        allowed = sorted(LEGAL_TASK_TRANSITIONS.get(current, set()))
        raise FarmOpsException(
            status_code=409,
            detail=(
                f"Cannot move a task from '{current}' to '{target}'. "
                + (f"Allowed from '{current}': {', '.join(allowed)}." if allowed else f"'{current}' is a terminal state.")
            ),
            code="ILLEGAL_TASK_TRANSITION",
        )


class TaskService:
    @staticmethod
    async def create_task_for_plan(
        session: AsyncSession,
        plan: ActionPlan,
        source: str = "system",
        auto_commit: bool = True,
    ) -> Task:
        """
        Instantiates an executable task from an approved ActionPlan exactly once (idempotent).
        """
        # Check if task already exists for this action plan
        existing_res = await session.execute(
            select(Task).where(Task.plan_id == plan.id)
        )
        existing_task = existing_res.scalars().first()
        if existing_task:
            return existing_task

        # Parse steps / checklist from plan evidence or create default step
        evidence = plan.evidence or {}
        steps = evidence.get("steps")
        if steps and isinstance(steps, list):
            checklist = [
                {
                    "step_number": s.get("step_number", i + 1),
                    "item": s.get("title") or s.get("description", f"Step {i+1}"),
                    "done": False,
                }
                for i, s in enumerate(steps)
            ]
        else:
            checklist = [{"step_number": 1, "item": f"Execute {plan.action_type}: {plan.action_summary}", "done": False}]

        task_evidence = {
            "source": source,
            "action_type": plan.action_type,
            "priority": plan.priority,
            "plan_id": plan.id,
            "risk_id": plan.risk_id,
            "estimated_cost": plan.estimated_cost,
        }

        task = Task(
            farm_id=plan.farm_id,
            zone_id=plan.zone_id,
            plan_id=plan.id,
            status="pending",
            due_from=plan.earliest_at,
            due_until=plan.latest_at,
            checklist=checklist,
            notes=f"[{plan.action_type.upper()}] {plan.action_summary}",
            evidence=task_evidence,
        )
        session.add(task)
        await session.flush()

        # Audit task creation
        session.add(
            AuditEvent(
                farm_id=plan.farm_id,
                entity_type="task",
                entity_id=task.id,
                actor_id=source if source != "system" else None,
                event_type="task_created",
                source=source,
                after_state={"status": "pending", "plan_id": plan.id, "priority": plan.priority},
            )
        )

        # Fire alert
        await AlertService.create_alert(
            session=session,
            farm_id=plan.farm_id,
            zone_id=plan.zone_id,
            risk_id=plan.risk_id,
            severity="info",
            message=f"New task created: {plan.action_summary}",
            dedupe_key=f"task_created:{task.id}",
        )

        if auto_commit:
            await session.commit()
            await session.refresh(task)
        return task

    @staticmethod
    async def create_task(session: AsyncSession, data: TaskCreate, actor_id: Optional[str] = None) -> Task:
        task = Task(
            farm_id=data.farm_id,
            zone_id=data.zone_id,
            plan_id=data.plan_id,
            assignee_id=data.assignee_id,
            status=data.status,
            due_from=data.due_from,
            due_until=data.due_until,
            checklist=data.checklist,
            notes=data.notes or data.title or "Manual Field Task",
            evidence=data.evidence or {"source": data.source or "user", "priority": data.priority or "medium"},
        )
        session.add(task)
        await session.flush()

        # Audit task creation
        session.add(
            AuditEvent(
                farm_id=data.farm_id,
                entity_type="task",
                entity_id=task.id,
                actor_id=actor_id,
                event_type="task_created",
                source="user",
                after_state={"status": task.status, "plan_id": data.plan_id},
            )
        )

        await session.commit()
        await session.refresh(task)
        return task

    @staticmethod
    async def get_tasks(
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Task]:
        query = select(Task).where(Task.farm_id == farm_id)
        if zone_id:
            query = query.where(Task.zone_id == zone_id)
        if status:
            query = query.where(Task.status == status)

        query = query.order_by(desc(Task.created_at)).limit(limit)
        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def get_task(session: AsyncSession, task_id: str) -> Task:
        query = select(Task).where(Task.id == task_id)
        res = await session.execute(query)
        task = res.scalar_one_or_none()
        if not task:
            raise EntityNotFoundException("Task", task_id)
        return task

    @staticmethod
    async def start_task(
        session: AsyncSession,
        task_id: str,
        actor_id: str,
        notes: Optional[str] = None,
    ) -> Task:
        task = await TaskService.get_task(session, task_id)

        # The state machine is the single authority on what may follow what, so the
        # endpoint asks it rather than repeating its own rules. It returns quietly when
        # the task is already in progress, and raises 409 from a terminal state.
        assert_legal_task_transition(task.status, "in_progress")
        if task.status == "in_progress":
            return task

        task.status = "in_progress"
        task.started_at = datetime.now(timezone.utc)
        if notes:
            task.notes = f"{task.notes or ''}\nStart Notes: {notes}".strip()

        # If linked to ActionPlan, update plan state to executing
        if task.plan_id:
            plan_res = await session.execute(select(ActionPlan).where(ActionPlan.id == task.plan_id))
            plan = plan_res.scalars().first()
            if plan and plan.approval_state in ["approved", "pending"]:
                plan.approval_state = "executing"

        # Audit task start
        session.add(
            AuditEvent(
                farm_id=task.farm_id,
                entity_type="task",
                entity_id=task.id,
                actor_id=actor_id,
                event_type="task_started",
                source="user",
                after_state={"status": "in_progress", "started_at": task.started_at.isoformat()},
            )
        )

        await session.commit()
        await session.refresh(task)
        return task

    @staticmethod
    async def complete_task(
        session: AsyncSession,
        task_id: str,
        actor_id: str,
        completion_notes: Optional[str] = None,
        completed_by: Optional[str] = None,
    ) -> Task:
        task = await TaskService.get_task(session, task_id)

        # Completion is only reachable from `in_progress`. Enforcing it here rather than
        # in the UI means a task cannot be recorded as done without ever having started,
        # which would leave the audit trail claiming work that was never tracked.
        assert_legal_task_transition(task.status, "completed")
        if task.status == "completed":
            return task

        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)

        # Update evidence dict safely
        evidence = dict(task.evidence or {})
        if completion_notes:
            evidence["completion_notes"] = completion_notes
            task.notes = f"{task.notes or ''}\nCompletion Notes: {completion_notes}".strip()
        if completed_by:
            evidence["completed_by"] = completed_by
        task.evidence = evidence

        # Update linked action plan
        originating_risk_id = None
        if task.plan_id:
            plan_res = await session.execute(select(ActionPlan).where(ActionPlan.id == task.plan_id))
            plan = plan_res.scalars().first()
            if plan:
                plan.approval_state = "completed"
                originating_risk_id = plan.risk_id

        # Audit task completed
        session.add(
            AuditEvent(
                farm_id=task.farm_id,
                entity_type="task",
                entity_id=task.id,
                actor_id=actor_id,
                event_type="task_completed",
                source="user",
                after_state={"status": "completed", "completed_by": completed_by or actor_id},
            )
        )

        # Fire completion alert
        await AlertService.create_alert(
            session=session,
            farm_id=task.farm_id,
            zone_id=task.zone_id,
            risk_id=originating_risk_id,
            severity="info",
            message=f"Task completed: {task.notes[:64] if task.notes else 'Field task'}",
            dedupe_key=f"task_completed:{task.id}",
        )

        # Record risk reassessment requested signal if linked risk exists
        if originating_risk_id:
            session.add(
                AuditEvent(
                    farm_id=task.farm_id,
                    entity_type="risk_assessment",
                    entity_id=originating_risk_id,
                    actor_id=actor_id,
                    event_type="risk_reassessment_requested",
                    source="task_completion",
                    after_state={
                        "task_id": task.id,
                        "plan_id": task.plan_id,
                        "reason": "Mitigation task completed. Reassessment required.",
                    },
                )
            )

        await session.commit()
        await session.refresh(task)
        return task

    @staticmethod
    async def cancel_task(
        session: AsyncSession,
        task_id: str,
        actor_id: str,
        reason: Optional[str] = None,
    ) -> Task:
        task = await TaskService.get_task(session, task_id)

        assert_legal_task_transition(task.status, "cancelled")
        if task.status == "cancelled":
            return task

        task.status = "cancelled"
        if reason:
            task.notes = f"{task.notes or ''}\nCancellation Reason: {reason}".strip()

        # Update linked action plan
        if task.plan_id:
            plan_res = await session.execute(select(ActionPlan).where(ActionPlan.id == task.plan_id))
            plan = plan_res.scalars().first()
            if plan and plan.approval_state not in ["completed", "cancelled"]:
                plan.approval_state = "cancelled"

        # Audit task cancelled
        session.add(
            AuditEvent(
                farm_id=task.farm_id,
                entity_type="task",
                entity_id=task.id,
                actor_id=actor_id,
                event_type="task_cancelled",
                source="user",
                after_state={"status": "cancelled", "reason": reason},
            )
        )

        await session.commit()
        await session.refresh(task)
        return task

    @staticmethod
    async def transition_status(
        session: AsyncSession,
        task_id: str,
        actor_id: str,
        target_status: str,
        note: Optional[str] = None,
        evidence_url: Optional[str] = None,
    ) -> Task:
        """Move a task to ``target_status`` after validating the transition.

        Completing a task records the outcome but deliberately does not resolve the
        originating risk: the PRD requires reassessment against fresh evidence.
        """
        task = await TaskService.get_task(session, task_id)
        target = str(getattr(target_status, "value", target_status))
        previous = task.status
        assert_legal_task_transition(previous, target)

        if previous == target and not note and not evidence_url:
            return task

        now = datetime.now(timezone.utc)
        task.status = target
        if target == "in_progress" and not task.started_at:
            task.started_at = now
        if target in ("completed", "cancelled") and not task.completed_at:
            task.completed_at = now
        if note:
            label = "Blocked" if target == "blocked" else target.replace("_", " ").title()
            task.notes = f"{task.notes or ''}\n{label} note: {note}".strip()
        if evidence_url:
            # Evidence is a JSON column; append rather than overwrite so earlier
            # submissions stay attached to the task.
            existing = dict(task.evidence or {})
            attachments = list(existing.get("attachments") or [])
            attachments.append({"url": evidence_url, "at": now.isoformat(), "by": actor_id, "status": target})
            existing["attachments"] = attachments
            task.evidence = existing

        session.add(
            AuditEvent(
                farm_id=task.farm_id,
                entity_type="task",
                entity_id=task.id,
                actor_id=actor_id,
                event_type=f"task_{target}",
                before_state={"status": previous},
                after_state={
                    "status": target,
                    "note": note,
                    "evidence_url": evidence_url,
                },
                source="user",
            )
        )

        await session.commit()
        await session.refresh(task)
        return task

    @staticmethod
    async def update_task(session: AsyncSession, task_id: str, actor_id: str, data: TaskUpdate) -> Task:
        task = await TaskService.get_task(session, task_id)
        update_dict = data.model_dump(exclude_unset=True)
        previous_status = task.status

        # A status change here goes through the same state machine as the
        # dedicated start/complete/cancel routes; PATCH is not a back door.
        if "status" in update_dict and update_dict["status"] is not None:
            assert_legal_task_transition(previous_status, update_dict["status"])

        if data.status == "in_progress" and not task.started_at:
            task.started_at = datetime.now(timezone.utc)
        elif data.status in ["completed", "cancelled"] and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)

        for k, v in update_dict.items():
            setattr(task, k, v)

        # Audit task update
        session.add(
            AuditEvent(
                farm_id=task.farm_id,
                entity_type="task",
                entity_id=task.id,
                actor_id=actor_id,
                event_type="task_updated",
                before_state={"status": previous_status},
                after_state={"status": task.status},
                source="user",
            )
        )

        await session.commit()
        await session.refresh(task)
        return task
