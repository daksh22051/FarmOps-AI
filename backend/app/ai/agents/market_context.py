"""
Market Context Agent (Context-Only Service)
Provides harvest timing, commodity price context, and cold storage advisories.
STRICT CONSTRAINT: Never performs autonomous market buying, selling, or financial transactions.
"""

from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface, get_ai_provider
from app.ai.agents.base import BaseAIAgent
from app.ai.prompts import MARKET_CONTEXT_SYSTEM_PROMPT
from app.schemas.ai import AIProposal, AgentType


class MarketContextAgent(BaseAIAgent):
    def __init__(self, provider: Optional[AIProviderInterface] = None):
        super().__init__(
            provider=provider or get_ai_provider(),
            agent_type=AgentType.MARKET_CONTEXT_AGENT,
            version="1.0.0",
        )
        self.agent_name = "market_context_agent"

    @property
    def system_prompt(self) -> str:
        return MARKET_CONTEXT_SYSTEM_PROMPT

    @property
    def default_risk_type(self) -> str:
        return "market_exposure"

    async def evaluate(self, context: Dict[str, Any]) -> AIProposal:
        """
        Generates structured AI advisory proposal for market context and harvest timing.
        """
        return await self._generate_and_validate(context)

    async def assess_risk(
        self,
        farm_id: str,
        zone_id: Optional[str],
        crop_name: str = "Produce",
        market_observation: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Legacy evaluation method for backward compatibility with existing orchestrators.
        """
        context = {
            "farm": {"id": farm_id},
            "zone": {"id": zone_id, "crop": crop_name},
            "risk": {"risk_type": "market_exposure", "severity": "low", "score": 0.20},
            "telemetry": {},
            "observations": [market_observation] if market_observation else [],
        }
        proposal = await self.evaluate(context)

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risk_type": "market_exposure",
            "severity": proposal.urgency,
            "score": 0.20,
            "confidence": proposal.confidence,
            "evidence": {
                "market_observation": market_observation or {"status": "unavailable"},
                "analysis": proposal.rationale,
                "proposal": proposal.model_dump(),
            },
            "missing_information": [],
            "agent": self.agent_name,
            "agent_version": self.version,
            "recommended_action_type": "adjust_harvest_schedule",
            "recommended_action_summary": proposal.recommendation,
            # Cost is not derivable from telemetry; surface it as unknown rather
            # than inventing a figure the farmer might budget against.
            "estimated_cost": None,
        }
