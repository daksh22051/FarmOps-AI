"""
RiskAssessment Pydantic v2 Schemas
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RiskAssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    farm_id: str
    zone_id: Optional[str] = None
    risk_type: str
    severity: str
    score: float
    confidence: float
    evidence: Optional[Dict[str, Any]] = None
    missing_information: Optional[List[str]] = None
    status: str
    agent: str
    agent_version: str
    created_at: datetime
    updated_at: datetime


class RiskAssessmentEvaluateRequest(BaseModel):
    farm_id: str
    zone_id: Optional[str] = None
    telemetry_override: Optional[Dict[str, Any]] = None
