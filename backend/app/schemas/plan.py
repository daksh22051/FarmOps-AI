"""
ActionPlan Pydantic v2 Schemas
"""

from typing import Optional, Dict, Any, List, Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ActionPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    risk_id: Optional[str] = None
    source_risk_ids: Optional[List[str]] = None
    action_type: str
    action_summary: str
    earliest_at: Optional[datetime] = None
    latest_at: Optional[datetime] = None
    priority: str
    confidence: float
    evidence: Optional[Dict[str, Any]] = None
    estimated_cost: Optional[float] = None
    safety_flags: Optional[List[str]] = None
    approval_required: bool
    approval_state: str
    policy_decision: str
    rationale: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime


class ActionPlanApprovalRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    review_notes: Optional[str] = None
