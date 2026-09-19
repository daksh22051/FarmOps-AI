"""
Field Tasks Endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
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
    tasks = await TaskService.get_tasks(db, farm_id=farm_id, zone_id=zone_id, status=status, limit=limit)
    return APIResponse(success=True, data=[TaskResponse.model_validate(t) for t in tasks])


@router.get("/detail/{task_id}", response_model=APIResponse[TaskResponse])
async def get_task_detail(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    task = await TaskService.get_task(db, task_id=task_id)
    return APIResponse(success=True, data=TaskResponse.model_validate(task))


@router.patch("/{task_id}", response_model=APIResponse[TaskResponse])
async def update_task_progress(
    task_id: str,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    task = await TaskService.update_task(db, task_id=task_id, actor_id=user.id, data=payload)
    return APIResponse(success=True, data=TaskResponse.model_validate(task), message="Task updated")
