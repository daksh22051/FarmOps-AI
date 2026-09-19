"""
Water Stress Risk Agent
Evaluates root-zone volumetric soil moisture, evapotranspiration rates, and crop water demand.
"""

from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface
from app.ai.prompts import IRRIGATION_AGENT_PROMPT


class WaterStressAgent:
    def __init__(self, provider: AIProviderInterface):
        self.provider = provider
        self.agent_name = "water_stress_agent"
        self.version = "1.0.0"

    async def assess_risk(
        self,
        farm_id: str,
        zone_id: Optional[str],
        telemetry: Dict[str, Any],
        crop_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        moisture = telemetry.get("soil_moisture", 50.0)
        temp = telemetry.get("air_temperature", 25.0)
        
        # Agronomic risk heuristic
        if moisture < 20.0:
            severity = "critical"
            score = 0.90
        elif moisture < 30.0:
            severity = "high"
            score = 0.75
        elif moisture < 40.0:
            severity = "medium"
            score = 0.45
        else:
            severity = "low"
            score = 0.10

        prompt = (
            f"Evaluate water stress risk for zone {zone_id or 'farm'}.\n"
            f"Soil moisture: {moisture}%, Air temperature: {temp}°C.\n"
            f"Crop context: {crop_context or {}}"
        )
        ai_analysis = await self.provider.generate_response(
            prompt=prompt,
            system_instruction=IRRIGATION_AGENT_PROMPT,
            context_data={"telemetry": telemetry, "crop": crop_context},
        )

        missing_info = []
        if "solar_radiation" not in telemetry:
            missing_info.append("solar_radiation")

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risk_type": "water_stress",
            "severity": severity,
            "score": score,
            "confidence": 0.92,
            "evidence": {
                "soil_moisture": moisture,
                "air_temperature": temp,
                "analysis": ai_analysis,
            },
            "missing_information": missing_info,
            "agent": self.agent_name,
            "agent_version": self.version,
            "recommended_action_type": "irrigate",
            "recommended_action_summary": f"Deliver precision drip irrigation to restore soil moisture from {moisture}% to 55%.",
            "estimated_cost": 15.0,
        }
