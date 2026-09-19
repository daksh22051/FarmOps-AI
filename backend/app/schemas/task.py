"""
Task Pydantic v2 Schemas
Domain schemas for executable field tasks, operational transitions, and completion tracking.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, model_validator


class TaskStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


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
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    source: Optional[str] = "system"


class TaskUpdate(BaseModel):
    assignee_id: Optional[str] = None
    status: Optional[str] = None  # pending, assigned, in_progress, completed, cancelled, blocked
    checklist: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskStartRequest(BaseModel):
    notes: Optional[str] = Field(None, description="Operational notes upon starting task")


class TaskCompleteRequest(BaseModel):
    completion_notes: Optional[str] = Field(None, description="Notes documenting task execution outcome")
    completed_by: Optional[str] = Field(None, description="Worker / operator identifier")


class TaskCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for task cancellation")


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    plan_id: Optional[str] = None
    action_plan_id: Optional[str] = None
    
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    status: str
    assignee_id: Optional[str] = None
    
    due_from: Optional[datetime] = None
    due_until: Optional[datetime] = None
    checklist: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None
    source: Optional[str] = "system"
    
    completion_notes: Optional[str] = None
    completed_by: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def populate_task_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "action_plan_id" not in data or data["action_plan_id"] is None:
                data["action_plan_id"] = data.get("plan_id")
            if "title" not in data or not data["title"]:
                data["title"] = data.get("notes") or f"Field Task {data.get('id', '')[:8]}"
            if "description" not in data or not data["description"]:
                data["description"] = data.get("notes")
            return data

        evidence = getattr(data, "evidence", None) or {}
        notes = getattr(data, "notes", "")
        plan_id = getattr(data, "plan_id", None)
        status_val = getattr(data, "status", "pending")

        return {
            "id": getattr(data, "id", ""),
            "farm_id": getattr(data, "farm_id", ""),
            "zone_id": getattr(data, "zone_id", None),
            "plan_id": plan_id,
            "action_plan_id": plan_id,
            "title": evidence.get("title") or notes or f"Field Task {getattr(data, 'id', '')[:8]}",
            "description": evidence.get("description") or notes,
            "priority": evidence.get("priority", "medium"),
            "status": status_val,
            "assignee_id": getattr(data, "assignee_id", None),
            "due_from": getattr(data, "due_from", None),
            "due_until": getattr(data, "due_until", None),
            "checklist": getattr(data, "checklist", None),
            "notes": notes,
            "evidence": evidence,
            "source": evidence.get("source", "system"),
            "completion_notes": evidence.get("completion_notes"),
            "completed_by": evidence.get("completed_by"),
            "started_at": getattr(data, "started_at", None),
            "completed_at": getattr(data, "completed_at", None),
            "created_at": getattr(data, "created_at", None),
            "updated_at": getattr(data, "updated_at", None),
        }
