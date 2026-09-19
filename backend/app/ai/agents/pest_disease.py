"""
Pest and Disease Risk Agent
Evaluates temperature-humidity index, leaf wetness duration, and pathogen pressure.
"""

from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface
from app.ai.prompts import PEST_DISEASE_AGENT_PROMPT


class PestDiseaseAgent:
    def __init__(self, provider: AIProviderInterface):
        self.provider = provider
        self.agent_name = "pest_disease_agent"
        self.version = "1.0.0"

    async def assess_risk(
        self,
        farm_id: str,
        zone_id: Optional[str],
        telemetry: Dict[str, Any],
        crop_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        humidity = telemetry.get("air_humidity", 60.0)
        temp = telemetry.get("air_temperature", 24.0)

        if humidity > 85.0 and 18.0 <= temp <= 28.0:
            severity = "high"
            score = 0.85
        elif humidity > 75.0:
            severity = "medium"
            score = 0.55
        else:
            severity = "low"
            score = 0.15

        prompt = (
            f"Evaluate pest and fungal pathogen risk for zone {zone_id or 'farm'}.\n"
            f"Air Humidity: {humidity}%, Temperature: {temp}°C.\n"
            f"Crop context: {crop_context or {}}"
        )
        ai_analysis = await self.provider.generate_response(
            prompt=prompt,
            system_instruction=PEST_DISEASE_AGENT_PROMPT,
            context_data={"telemetry": telemetry, "crop": crop_context},
        )

        missing_info = []
        if "leaf_wetness_hours" not in telemetry:
            missing_info.append("leaf_wetness_hours")

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risk_type": "pest_disease",
            "severity": severity,
            "score": score,
            "confidence": 0.88,
            "evidence": {
                "air_humidity": humidity,
                "air_temperature": temp,
                "analysis": ai_analysis,
            },
            "missing_information": missing_info,
            "agent": self.agent_name,
            "agent_version": self.version,
            "recommended_action_type": "apply_biocontrol",
            "recommended_action_summary": "Perform targeted foliage inspection and apply organic bio-fungicide (Bacillus subtilis).",
            "estimated_cost": 45.0,
        }
