"""
Demo Pipeline Schemas
Pydantic models for configuring, executing, and capturing end-to-end demo runs.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from app.schemas.ai import AIProposal


class DemoRunRequest(BaseModel):
    scenario: str = Field(
        "water_stress",
        description="Demo scenario: water_stress, pest_disease, nutrient_deficiency, chemical_approval, prohibited_actuator",
    )
    auto_approve: bool = Field(
        True,
        description="If True, automatically reviews and approves plans that enter PENDING_APPROVAL",
    )
    force_approval_required: bool = Field(
        False,
        description="Force the plan into APPROVAL_REQUIRED even if confidence is high",
    )
    farm_name: Optional[str] = Field("Demo Autonomous Farm", description="Name of demo farm")
    zone_name: Optional[str] = Field("Demo Sector Alpha", description="Name of demo zone")
    device_name: Optional[str] = Field("Demo Moisture Node 01", description="Name of demo telemetry node")
    telemetry_override: Optional[Dict[str, Any]] = Field(
        None, description="Custom sensor measurements override"
    )


class DemoRunResult(BaseModel):
    demo_run_id: str = Field(..., description="Unique UUID for this demo run")
    scenario: str = Field(..., description="Executed scenario name")
    success: bool = Field(..., description="Whether the entire pipeline completed successfully")
    
    # Infrastructure Identifiers
    farm_id: str = Field(..., description="Demo Farm UUID")
    zone_id: str = Field(..., description="Demo Zone UUID")
    device_id: str = Field(..., description="Demo Device UUID")
    
    # Pipeline Step Artifacts
    telemetry_event_id: str = Field(..., description="Ingested SensorEvent UUID")
    telemetry_measurements: Dict[str, Any] = Field(..., description="Raw sensor measurements")
    
    risk_id: Optional[str] = Field(None, description="Detected RiskAssessment UUID")
    risk_type: Optional[str] = Field(None, description="Agronomic risk type detected")
    risk_severity: Optional[str] = Field(None, description="Severity level of risk")
    risk_score: Optional[float] = Field(None, description="Risk score")
    
    ai_proposal: Optional[Dict[str, Any]] = Field(None, description="Structured AIProposal generated")
    safety_decision: Optional[str] = Field(None, description="PolicyDecision: ALLOW, APPROVAL_REQUIRED, ESCALATE, REJECT")
    
    action_plan_id: Optional[str] = Field(None, description="ActionPlan UUID")
    approval_state: Optional[str] = Field(None, description="Action plan status (approved, pending_approval, rejected, completed)")
    
    task_id: Optional[str] = Field(None, description="Executable Task UUID")
    task_status: Optional[str] = Field(None, description="Task status (pending, in_progress, completed, cancelled)")
    
    audit_event_ids: List[str] = Field(default_factory=list, description="List of recorded AuditEvent UUIDs")
    alert_ids: List[str] = Field(default_factory=list, description="List of recorded Alert UUIDs")
    
    reassessment_requested: bool = Field(False, description="Whether risk reassessment signal was recorded")
    execution_log: List[str] = Field(default_factory=list, description="Sequential human-readable pipeline execution log")
    error_message: Optional[str] = Field(None, description="Failure details if success is False")


class DemoStatusResponse(BaseModel):
    status: str = "ready"
    available_scenarios: List[str] = [
        "water_stress",
        "pest_disease",
        "nutrient_deficiency",
        "chemical_approval",
        "prohibited_actuator",
    ]
    supported_providers: List[str] = ["mock", "gemini"]
    deterministic_mode: bool = True
