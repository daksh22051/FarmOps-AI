"""
ActionPlan Pydantic v2 Schemas
Domain schemas for action plan generation, deterministic safety gating, and human approval workflow.
"""

from typing import Optional, Dict, Any, List, Literal
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.schemas.ai import AIProposal


class ActionPlanStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ActionPlanStep(BaseModel):
    step_number: int = Field(1, description="Sequential step index")
    title: str = Field(..., description="Short summary of the step")
    description: Optional[str] = Field(None, description="Detailed execution instructions")
    action_type: Optional[str] = Field(None, description="Action category (e.g., inspect, sample, irrigate)")
    status: str = Field("pending", description="Step execution status (pending, in_progress, completed, skipped)")
    notes: Optional[str] = Field(None, description="Agronomic or operator notes")


class ActionPlanCreate(BaseModel):
    farm_id: Optional[str] = Field(None, description="Owning farm ID")
    zone_id: Optional[str] = Field(None, description="Target zone ID")
    risk_id: Optional[str] = Field(None, description="Originating RiskAssessment ID")
    source_risk_ids: Optional[List[str]] = Field(None, description="List of related risk IDs")
    
    title: Optional[str] = Field(None, description="Action plan title")
    objective: Optional[str] = Field(None, description="Operational goal")
    action_type: Optional[str] = Field(None, description="Category of action")
    action_summary: Optional[str] = Field(None, description="Summary of action")
    priority: str = Field("medium", description="Priority: low, medium, high, urgent")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence score")
    
    rationale: Optional[str] = Field(None, description="Agronomic rationale")
    estimated_cost: Optional[float] = Field(None, ge=0.0, description="Estimated cost in USD/local currency")
    estimated_duration_minutes: Optional[int] = Field(None, ge=0, description="Estimated execution time in minutes")
    
    steps: Optional[List[ActionPlanStep]] = Field(None, description="Ordered action steps")
    evidence: Optional[Dict[str, Any]] = Field(None, description="Supporting telemetry and agronomic evidence")
    source: Optional[str] = Field("ai_agent", description="Creator source: ai_agent, user, rule_engine")
    ai_proposal: Optional[AIProposal] = Field(None, description="Raw AIProposal from Gemini/domain agent")
    earliest_at: Optional[datetime] = None
    latest_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_schedule(self):
        for field in ("earliest_at", "latest_at"):
            value = getattr(self, field)
            if value is not None and value.tzinfo is None:
                setattr(self, field, value.replace(tzinfo=timezone.utc))
        if self.earliest_at and self.latest_at and self.latest_at < self.earliest_at:
            raise ValueError("The end of the action window must be after its start.")
        return self


class ActionPlanApprovalRequest(BaseModel):
    decision: Optional[Literal["approved", "rejected"]] = Field("approved", description="Reviewer decision")
    review_notes: Optional[str] = Field(None, description="Reviewer comments")
    notes: Optional[str] = Field(None, description="Alternative field for review notes")


class ActionPlanDecisionRequest(BaseModel):
    """A farmer's decision on a proposed plan (PRD: POST /plans/{planId}/decision)."""

    decision: Literal["approve", "reject", "reschedule"] = Field(
        ..., description="approve | reject | reschedule"
    )
    reason: Optional[str] = Field(None, max_length=2000, description="Why this decision was taken")
    earliest_at: Optional[datetime] = Field(None, description="New window start; reschedule only")
    latest_at: Optional[datetime] = Field(None, description="New window end; reschedule only")


class ActionPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    risk_id: Optional[str] = None
    source_risk_ids: Optional[List[str]] = None
    
    title: Optional[str] = None
    objective: Optional[str] = None
    action_type: str
    action_summary: str
    
    earliest_at: Optional[datetime] = None
    latest_at: Optional[datetime] = None
    priority: str
    confidence: float
    evidence: Optional[Dict[str, Any]] = None
    estimated_cost: Optional[float] = None
    # The PRD requires cost to be explicitly "unknown" rather than silently null, so the
    # UI can distinguish "we costed this at zero" from "we have no basis for a figure".
    estimated_cost_status: str = "unknown"
    estimated_cost_currency: str = "INR"
    estimated_duration_minutes: Optional[int] = None

    safety_flags: Optional[List[str]] = None
    approval_required: bool
    requires_human_approval: Optional[bool] = None
    approval_state: str
    status: Optional[str] = None
    policy_decision: str
    safety_status: Optional[str] = None
    safety_notes: Optional[str] = None
    
    steps: Optional[List[Dict[str, Any]]] = None
    source: Optional[str] = None
    rationale: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def populate_computed_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Resolve aliases
            if "status" not in data or data["status"] is None:
                data["status"] = data.get("approval_state")
            if "requires_human_approval" not in data or data["requires_human_approval"] is None:
                data["requires_human_approval"] = data.get("approval_required")
            if "safety_status" not in data or data["safety_status"] is None:
                data["safety_status"] = data.get("policy_decision")
            if not data.get("estimated_cost_status"):
                data["estimated_cost_status"] = "known" if data.get("estimated_cost") is not None else "unknown"
            if "title" not in data or not data["title"]:
                data["title"] = data.get("action_summary") or data.get("action_type")
            return data

        # If data is an ORM object
        evidence = getattr(data, "evidence", None) or {}
        approval_state = getattr(data, "approval_state", "pending")
        approval_required = getattr(data, "approval_required", False)
        policy_decision = getattr(data, "policy_decision", "ALLOW")
        action_summary = getattr(data, "action_summary", "")
        action_type = getattr(data, "action_type", "")
        rationale = getattr(data, "rationale", "")

        return {
            "id": getattr(data, "id", ""),
            "farm_id": getattr(data, "farm_id", ""),
            "zone_id": getattr(data, "zone_id", None),
            "risk_id": getattr(data, "risk_id", None),
            "source_risk_ids": getattr(data, "source_risk_ids", None),
            "title": evidence.get("title") or action_summary or action_type,
            "objective": evidence.get("objective") or rationale,
            "action_type": action_type,
            "action_summary": action_summary,
            "earliest_at": getattr(data, "earliest_at", None),
            "latest_at": getattr(data, "latest_at", None),
            "priority": getattr(data, "priority", "medium"),
            "confidence": getattr(data, "confidence", 1.0),
            "evidence": evidence,
            "estimated_cost": getattr(data, "estimated_cost", None),
            "estimated_cost_status": "known" if getattr(data, "estimated_cost", None) is not None else "unknown",
            "estimated_cost_currency": evidence.get("cost_currency") or "INR",
            "estimated_duration_minutes": evidence.get("estimated_duration_minutes"),
            "safety_flags": getattr(data, "safety_flags", None),
            "approval_required": approval_required,
            "requires_human_approval": approval_required,
            "approval_state": approval_state,
            "status": approval_state,
            "policy_decision": policy_decision,
            "safety_status": policy_decision,
            "safety_notes": rationale,
            "steps": evidence.get("steps"),
            "source": evidence.get("source", "system"),
            "rationale": rationale,
            "version": getattr(data, "version", 1),
            "created_at": getattr(data, "created_at", None),
            "updated_at": getattr(data, "updated_at", None),
        }
