"""
Alert Pydantic v2 Schemas
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    risk_id: Optional[str] = None
    severity: str
    channel: str
    message: str
    delivery_status: str
    acknowledged_at: Optional[datetime] = None
    dedupe_key: str
    created_at: datetime


class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: Optional[str] = "operator"
