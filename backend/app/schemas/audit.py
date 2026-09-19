"""
AuditEvent Pydantic v2 Schemas
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: Optional[str] = None
    entity_type: str
    entity_id: Optional[str] = None
    actor_id: Optional[str] = None
    event_type: str
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    correlation_id: Optional[str] = None
    timestamp: datetime
    source: str
    model_version: Optional[str] = None
    policy_version: Optional[str] = None
