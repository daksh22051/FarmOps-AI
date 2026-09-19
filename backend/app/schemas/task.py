"""
Task Pydantic v2 Schemas
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TaskBase(BaseModel):
    zone_id: Optional[str] = None
    assignee_id: Optional[str] = None
    status: str = Field("pending", max_length=32)
    due_from: Optional[datetime] = None
    due_until: Optional[datetime] = None
    checklist: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None


class TaskCreate(TaskBase):
    farm_id: str
    plan_id: Optional[str] = None


class TaskUpdate(BaseModel):
    assignee_id: Optional[str] = None
    status: Optional[str] = None  # pending, in_progress, completed, cancelled, blocked
    checklist: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    plan_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
