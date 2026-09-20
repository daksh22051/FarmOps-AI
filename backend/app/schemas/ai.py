"""
AI Proposals & Evaluation Pydantic v2 Schemas
Provides strict validation for structured LLM proposals, agent types, and safety evaluation results.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AgentType:
    WATER_AGENT = "WATER_AGENT"
    PEST_DISEASE_AGENT = "PEST_DISEASE_AGENT"
    NUTRIENT_AGENT = "NUTRIENT_AGENT"
    MARKET_CONTEXT_AGENT = "MARKET_CONTEXT_AGENT"
    ORCHESTRATOR = "ORCHESTRATOR"

    VALID_TYPES = {
        WATER_AGENT,
        PEST_DISEASE_AGENT,
        NUTRIENT_AGENT,
        MARKET_CONTEXT_AGENT,
        ORCHESTRATOR,
    }


class AIProposal(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)

    agent_type: str = Field(..., description="Originating agent identifier (e.g. WATER_AGENT, PEST_DISEASE_AGENT)")
    risk_type: str = Field(..., description="Target risk category (e.g. water_stress, pest_disease, nutrient_deficiency)")
    recommendation: str = Field(..., min_length=5, description="Actionable advisory recommendation for farm operator/agronomist")
    rationale: str = Field(..., min_length=5, description="Agronomic reasoning grounded in supplied telemetry and observations")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence score between 0.0 and 1.0")
    urgency: str = Field(..., description="Urgency level: low, medium, high, critical")
    evidence_refs: List[str] = Field(default_factory=list, description="List of specific sensor metrics or observation keys used")
    assumptions: List[str] = Field(default_factory=list, description="Explicit agronomic assumptions made during inference")
    uncertainty: str = Field(default="", description="Statement of data gaps or uncertainty in evaluation")
    requires_human_review: bool = Field(default=True, description="Whether human review is required before taking any action")
    safety_notes: Optional[str] = Field(None, description="Safety guard notes or chemical/actuator warnings")

    @field_validator("agent_type")
    @classmethod
    def validate_agent_type(cls, v: str) -> str:
        v_upper = v.strip().upper()
        if v_upper not in AgentType.VALID_TYPES:
            # Allow common aliases/lowercase
            mapping = {
                "WATER_STRESS_AGENT": AgentType.WATER_AGENT,
                "WATER_AGENT": AgentType.WATER_AGENT,
                "PEST_DISEASE_AGENT": AgentType.PEST_DISEASE_AGENT,
                "PEST_AGENT": AgentType.PEST_DISEASE_AGENT,
                "NUTRIENT_AGENT": AgentType.NUTRIENT_AGENT,
                "MARKET_CONTEXT_AGENT": AgentType.MARKET_CONTEXT_AGENT,
                "MARKET_AGENT": AgentType.MARKET_CONTEXT_AGENT,
                "ORCHESTRATOR": AgentType.ORCHESTRATOR,
            }
            if v_upper in mapping:
                return mapping[v_upper]
            raise ValueError(f"Invalid agent_type '{v}'. Must be one of: {sorted(AgentType.VALID_TYPES)}")
        return v_upper

    @field_validator("urgency")
    @classmethod
    def validate_urgency(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if v_clean not in {"low", "medium", "high", "critical"}:
            raise ValueError(f"Invalid urgency '{v}'. Must be one of: low, medium, high, critical")
        return v_clean

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        return round(max(0.0, min(1.0, float(v))), 2)


class AIEvaluationRequest(BaseModel):
    risk_id: str = Field(..., description="UUID of the RiskAssessment to evaluate")
    require_live: bool = Field(False, description="Reject mock providers for operational dashboard requests")


class AISafetyDecision(BaseModel):
    decision: str = Field(..., description="Safety policy decision: approved, requires_review, rejected, escalate")
    approval_required: bool = Field(..., description="Whether human signature is required")
    safety_flags: List[str] = Field(default_factory=list, description="Safety rule flags triggered")
    rationale: str = Field(..., description="Deterministic safety evaluation reasoning")
    requires_escalation: bool = Field(default=False, description="Whether immediate manager/admin escalation is needed")


class AIEvaluationResponse(BaseModel):
    risk: Dict[str, Any] = Field(..., description="Target RiskAssessment details")
    proposal: AIProposal = Field(..., description="Validated structured AI advisory proposal")
    safety: AISafetyDecision = Field(..., description="Authoritative deterministic safety guard verdict")
