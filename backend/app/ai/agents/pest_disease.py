"""
Pest and Disease Risk Agent
Evaluates temperature-humidity index, leaf wetness duration, and pathogen pressure.
Outputs structured, advisory-only AIProposal objects emphasizing Risk != Diagnosis.
"""

from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface, get_ai_provider
from app.ai.agents.base import BaseAIAgent
from app.ai.prompts import PEST_DISEASE_SYSTEM_PROMPT
from app.schemas.ai import AIProposal, AgentType


class PestDiseaseAgent(BaseAIAgent):
    def __init__(self, provider: Optional[AIProviderInterface] = None):
        super().__init__(
            provider=provider or get_ai_provider(),
            agent_type=AgentType.PEST_DISEASE_AGENT,
            version="1.0.0",
        )
        self.agent_name = "pest_disease_agent"

    @property
    def system_prompt(self) -> str:
        return PEST_DISEASE_SYSTEM_PROMPT

    @property
    def default_risk_type(self) -> str:
        return "pest_disease"

    async def evaluate(self, context: Dict[str, Any]) -> AIProposal:
        """
        Generates structured AI advisory proposal for pest and disease risk.
        """
        return await self._generate_and_validate(context)

    async def assess_risk(
        self,
        farm_id: str,
        zone_id: Optional[str],
        telemetry: Dict[str, Any],
        crop_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Legacy evaluation method for backward compatibility with existing orchestrators.
        """
        context = {
            "farm": {"id": farm_id},
            "zone": {"id": zone_id, "crop": (crop_context or {}).get("crop_name", "Crop")},
            "risk": {"risk_type": "pest_disease", "severity": "medium", "score": 0.55},
            "telemetry": telemetry,
            "observations": [],
        }
        proposal = await self.evaluate(context)
        humidity = telemetry.get("air_humidity", 60.0)

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risk_type": "pest_disease",
            "severity": proposal.urgency,
            "score": 0.85 if proposal.urgency in ["high", "critical"] else 0.55,
            "confidence": proposal.confidence,
            "evidence": {
                "air_humidity": humidity,
                "analysis": proposal.rationale,
                "proposal": proposal.model_dump(),
            },
            "missing_information": [] if "air_humidity" in telemetry else ["air_humidity"],
            "agent": self.agent_name,
            "agent_version": self.version,
            "recommended_action_type": "apply_biocontrol",
            "recommended_action_summary": proposal.recommendation,
            "estimated_cost": 45.0,
        }
