"""
Nutrient & Soil Health Risk Agent
Evaluates NPK macronutrients, soil pH nutrient availability, and fertilization requirements.
Outputs structured, advisory-only AIProposal objects without inventing fertilizer dosages.
"""

from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface, get_ai_provider
from app.ai.agents.base import BaseAIAgent
from app.ai.prompts import NUTRIENT_SYSTEM_PROMPT
from app.schemas.ai import AIProposal, AgentType


class NutrientAgent(BaseAIAgent):
    def __init__(self, provider: Optional[AIProviderInterface] = None):
        super().__init__(
            provider=provider or get_ai_provider(),
            agent_type=AgentType.NUTRIENT_AGENT,
            version="1.0.0",
        )
        self.agent_name = "nutrient_agent"

    @property
    def system_prompt(self) -> str:
        return NUTRIENT_SYSTEM_PROMPT

    @property
    def default_risk_type(self) -> str:
        return "nutrient_deficiency"

    async def evaluate(self, context: Dict[str, Any]) -> AIProposal:
        """
        Generates structured AI advisory proposal for soil nutrient and pH conditions.
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
            "risk": {"risk_type": "nutrient_deficiency", "severity": "medium", "score": 0.60},
            "telemetry": telemetry,
            "observations": [],
        }
        proposal = await self.evaluate(context)
        soil_ph = telemetry.get("soil_ph", 6.5)

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risk_type": "nutrient_deficiency",
            "severity": proposal.urgency,
            "score": 0.80 if proposal.urgency in ["high", "critical"] else 0.50,
            "confidence": proposal.confidence,
            "evidence": {
                "soil_ph": soil_ph,
                "analysis": proposal.rationale,
                "proposal": proposal.model_dump(),
            },
            "missing_information": [],
            "agent": self.agent_name,
            "agent_version": self.version,
            "recommended_action_type": "apply_fertilizer",
            "recommended_action_summary": proposal.recommendation,
            # Cost is not derivable from telemetry; surface it as unknown rather
            # than inventing a figure the farmer might budget against.
            "estimated_cost": None,
        }
