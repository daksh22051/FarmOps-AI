"""
RiskAssessment Pydantic v2 Schemas
Provides validated schemas for deterministic agronomic risk detection and evaluations.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class RiskSignalEvidence(BaseModel):
    name: str = Field(..., description="Telemetry metric or observation indicator name")
    value: Any = Field(..., description="Numerical or categorical signal value")
    unit: str = Field(default="", description="Measurement unit (e.g. %, °C, mg/kg, mm)")
    observed_at: Optional[str] = Field(None, description="ISO-8601 timestamp when signal was observed")


class RiskEvidence(BaseModel):
    signals: List[RiskSignalEvidence] = Field(default_factory=list, description="Sensor signals contributing to this assessment")
    rules_triggered: List[str] = Field(default_factory=list, description="Rule names triggered during evaluation")
    freshness: str = Field(default="fresh", description="Data freshness status: fresh, stale, very_stale")
    explanation: Optional[str] = Field(None, description="Agronomic explanation of the detected condition")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Supporting external observations or weather data")


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


class RiskAssessmentListResponse(BaseModel):
    items: List[RiskAssessmentResponse]
    total: int
    page: int
    page_size: int


class RiskAssessmentEvaluateRequest(BaseModel):
    farm_id: str
    zone_id: Optional[str] = None
    telemetry_override: Optional[Dict[str, Any]] = None

