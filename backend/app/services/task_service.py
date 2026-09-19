"""
Task Management Service
"""

from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.task import Task
from app.models.audit import AuditEvent
from app.schemas.task import TaskCreate, TaskUpdate
from app.core.exceptions import EntityNotFoundException


class TaskService:
    @staticmethod
    async def create_task(session: AsyncSession, data: TaskCreate) -> Task:
        task = Task(
            farm_id=data.farm_id,
            zone_id=data.zone_id,
            plan_id=data.plan_id,
            assignee_id=data.assignee_id,
            status=data.status,
            due_from=data.due_from,
            due_until=data.due_until,
            checklist=data.checklist,
            notes=data.notes,
            evidence=data.evidence,
        )
        session.add(task)
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
    async def update_task(session: AsyncSession, task_id: str, actor_id: str, data: TaskUpdate) -> Task:
        task = await TaskService.get_task(session, task_id)
        update_dict = data.model_dump(exclude_unset=True)

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
                after_state={"status": task.status},
                source="user",
            )
        )

        await session.commit()
        await session.refresh(task)
        return task
