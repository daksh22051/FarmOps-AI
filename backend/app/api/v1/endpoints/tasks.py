"""
Field Tasks Endpoints with Farm-Scoped Authorization (/api/v1/tasks)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_task_access,
)
from app.services.task_service import TaskService
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskStartRequest,
    TaskCompleteRequest,
    TaskCancelRequest,
    TaskStatusTransition,
)
from app.schemas.common import APIResponse

router = APIRouter(tags=["Field Tasks"])


# 1. Manual Task Creation
@router.post("/tasks", response_model=APIResponse[TaskResponse], status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Creates a field task. Requires owner, manager, agronomist, or operator role on the farm."""
    await check_farm_access(
        db,
        farm_id=payload.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist", "operator"],
    )
    task = await TaskService.create_task(db, data=payload, actor_id=user.id)
    return APIResponse(success=True, data=TaskResponse.model_validate(task), message="Task created successfully.")


# 2. List Tasks by Farm
@router.get("/tasks", response_model=APIResponse[List[TaskResponse]])
async def list_tasks_by_query(
    farm_id: str = Query(..., description="Farm to list tasks for"),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    status: Optional[str] = Query(None, description="Filter by task status"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Authorized, filterable task list (`GET /tasks?farm_id=...`)."""
    return await list_tasks(
        farm_id=farm_id, zone_id=zone_id, status=status, limit=limit, db=db, user=user
    )


@router.get("/farms/{farm_id}/tasks", response_model=APIResponse[List[TaskResponse]])
@router.get("/tasks/{farm_id}", response_model=APIResponse[List[TaskResponse]])
async def list_tasks(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    status: Optional[str] = Query(None, description="Filter: pending, assigned, in_progress, completed, cancelled, blocked"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists field tasks. Verifies user has access to this farm."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    tasks = await TaskService.get_tasks(db, farm_id=farm_id, zone_id=zone_id, status=status, limit=limit)
    return APIResponse(
        success=True,
        data=[TaskResponse.model_validate(t) for t in tasks],
        message=f"Retrieved {len(tasks)} tasks.",
    )


# 3. Retrieve Single Task Detail
# NOTE: no "/tasks/{task_id}" route here. It would be identical in shape to
# "/tasks/{farm_id}" above, which is registered first and would always win,
# silently returning a list where callers expected one task.
@router.get("/tasks/detail/{task_id}", response_model=APIResponse[TaskResponse])
async def get_task_detail(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves task details. Verifies user has access to the owning farm."""
    task = await verify_task_access(task_id=task_id, db=db, user=user)
    return APIResponse(success=True, data=TaskResponse.model_validate(task))


# 4. Start Task Execution
@router.post("/tasks/{task_id}/start", response_model=APIResponse[TaskResponse])
async def start_task_execution(
    task_id: str,
    payload: Optional[TaskStartRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Transitions task to in_progress and marks linked ActionPlan as executing.
    Requires owner, manager, agronomist, or operator role.
    """
    task = await verify_task_access(task_id=task_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=task.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist", "operator"],
    )
    notes = payload.notes if payload else None
    started = await TaskService.start_task(
        session=db,
        task_id=task_id,
        actor_id=user.id,
        notes=notes,
    )
    return APIResponse(
        success=True,
        data=TaskResponse.model_validate(started),
        message="Task started successfully.",
    )


# 5. Complete Task Execution
@router.post("/tasks/{task_id}/complete", response_model=APIResponse[TaskResponse])
async def complete_task_execution(
    task_id: str,
    payload: Optional[TaskCompleteRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Transitions task to completed, marks linked ActionPlan as completed,
    and emits risk reassessment signal for the originating risk.
    Requires owner, manager, agronomist, or operator role.
    """
    task = await verify_task_access(task_id=task_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=task.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist", "operator"],
    )
    notes = payload.completion_notes if payload else None
    completed_by = payload.completed_by or user.id if payload else user.id
    completed = await TaskService.complete_task(
        session=db,
        task_id=task_id,
        actor_id=user.id,
        completion_notes=notes,
        completed_by=completed_by,
    )
    return APIResponse(
        success=True,
        data=TaskResponse.model_validate(completed),
        message="Task completed successfully.",
    )


# 6. Cancel Task Execution
@router.post("/tasks/{task_id}/cancel", response_model=APIResponse[TaskResponse])
async def cancel_task_execution(
    task_id: str,
    payload: Optional[TaskCancelRequest] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Cancels a field task and updates linked ActionPlan to cancelled.
    Requires owner, manager, agronomist, or operator role.
    """
    task = await verify_task_access(task_id=task_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=task.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist", "operator"],
    )
    reason = payload.reason if payload else None
    cancelled = await TaskService.cancel_task(
        session=db,
        task_id=task_id,
        actor_id=user.id,
        reason=reason,
    )
    return APIResponse(
        success=True,
        data=TaskResponse.model_validate(cancelled),
        message="Task cancelled successfully.",
    )


# 6b. Explicit status transition (PRD: PATCH /tasks/{taskId}/status)
@router.patch("/tasks/{task_id}/status", response_model=APIResponse[TaskResponse])
async def transition_task_status(
    task_id: str,
    payload: TaskStatusTransition,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Moves a task to a new status, validating the transition and the actor's role.

    This is the only route that can reach `blocked`, and it records the note and
    evidence alongside the transition in the audit trail.
    """
    task = await verify_task_access(task_id=task_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=task.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist", "operator"],
    )
    updated = await TaskService.transition_status(
        db,
        task_id=task_id,
        actor_id=user.id,
        target_status=payload.status,
        note=payload.note,
        evidence_url=payload.evidence_url,
    )
    return APIResponse(
        success=True,
        data=TaskResponse.model_validate(updated),
        message=f"Task moved to '{updated.status}'.",
    )


# 7. Update Task Progress (PATCH)
@router.patch("/tasks/{task_id}", response_model=APIResponse[TaskResponse])
async def update_task_progress(
    task_id: str,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Updates task execution progress. Verifies user has operational access to owning farm."""
    task = await verify_task_access(task_id=task_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=task.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "agronomist", "operator"],
    )
    updated = await TaskService.update_task(db, task_id=task_id, actor_id=user.id, data=payload)
    return APIResponse(success=True, data=TaskResponse.model_validate(updated), message="Task updated successfully.")
