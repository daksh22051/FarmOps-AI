"""
Escalation Pydantic v2 Schemas
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class EscalationCreate(BaseModel):
    farm_id: str
    zone_id: Optional[str] = None
    risk_id: Optional[str] = None
    plan_id: Optional[str] = None
    reason: str


class EscalationReviewRequest(BaseModel):
    assigned_expert_id: Optional[str] = None
    review_notes: str
    review_outcome: str = Field(..., json_schema_extra={"example": "approved_with_adjustments"})
    status: str = Field("resolved", json_schema_extra={"example": "resolved"})


class EscalationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    risk_id: Optional[str] = None
    plan_id: Optional[str] = None
    reason: str
    status: str
    assigned_expert_id: Optional[str] = None
    review_notes: Optional[str] = None
    review_outcome: Optional[str] = None
    created_at: datetime
    updated_at: datetime
