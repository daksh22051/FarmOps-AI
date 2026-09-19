"""
Field Tasks Endpoints with Farm-Scoped Authorization
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
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/tasks", tags=["Field Tasks"])


@router.post("", response_model=APIResponse[TaskResponse], status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Creates a field task. Requires owner, manager, or operator role on the farm."""
    await check_farm_access(
        db,
        farm_id=payload.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "operator"],
    )
    task = await TaskService.create_task(db, data=payload)
    return APIResponse(success=True, data=TaskResponse.model_validate(task), message="Task created")


@router.get("/{farm_id}", response_model=APIResponse[List[TaskResponse]])
async def list_tasks(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    status: Optional[str] = Query(None, description="Filter: pending, in_progress, completed, cancelled"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists field tasks. Verifies user has access to this farm."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    tasks = await TaskService.get_tasks(db, farm_id=farm_id, zone_id=zone_id, status=status, limit=limit)
    return APIResponse(success=True, data=[TaskResponse.model_validate(t) for t in tasks])


@router.get("/detail/{task_id}", response_model=APIResponse[TaskResponse])
async def get_task_detail(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves task details. Verifies user has access to the owning farm."""
    task = await verify_task_access(task_id=task_id, db=db, user=user)
    return APIResponse(success=True, data=TaskResponse.model_validate(task))


@router.patch("/{task_id}", response_model=APIResponse[TaskResponse])
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
        allowed_roles=["owner", "manager", "operator"],
    )
    updated = await TaskService.update_task(db, task_id=task_id, actor_id=user.id, data=payload)
    return APIResponse(success=True, data=TaskResponse.model_validate(updated), message="Task updated")
