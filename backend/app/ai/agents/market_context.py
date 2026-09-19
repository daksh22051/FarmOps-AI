"""
Market Context Agent (Context-Only Service)
Provides harvest timing, commodity price context, and cold storage advisories.
STRICT CONSTRAINT: Never performs autonomous market buying, selling, or financial transactions.
"""

from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface

MARKET_AGENT_PROMPT = """
You are the FarmOps Market Context Advisory Agent.
Your mission is to provide situational market awareness to assist farm scheduling.
Evaluate regional commodity spot prices, harvest price windows, and weather-driven supply dynamics.
STRICT BOUNDARY: You are an informational advisory service ONLY. You never execute financial trades or transactions.
"""


class MarketContextAgent:
    def __init__(self, provider: AIProviderInterface):
        self.provider = provider
        self.agent_name = "market_context_agent"
        self.version = "1.0.0"

    async def assess_risk(
        self,
        farm_id: str,
        zone_id: Optional[str],
        crop_name: str = "Produce",
        market_observation: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        obs = market_observation or {"spot_price_trend": "stable", "regional_supply": "normal"}

        prompt = (
            f"Evaluate market pricing and harvest timing context for crop '{crop_name}' in zone {zone_id or 'farm'}.\n"
            f"Market Observations: {obs}"
        )
        ai_analysis = await self.provider.generate_response(
            prompt=prompt,
            system_instruction=MARKET_AGENT_PROMPT,
            context_data={"market": obs, "crop": crop_name},
        )

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risk_type": "market_exposure",
            "severity": "low",
            "score": 0.20,
            "confidence": 0.80,
            "evidence": {
                "market_observation": obs,
                "analysis": ai_analysis,
            },
            "missing_information": [],
            "agent": self.agent_name,
            "agent_version": self.version,
            "recommended_action_type": "adjust_harvest_schedule",
            "recommended_action_summary": f"Maintain standard harvest window for {crop_name}; market price trajectory is stable.",
            "estimated_cost": 0.0,
        }
