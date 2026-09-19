"""
Nutrient & Soil Health Risk Agent
Evaluates NPK macronutrients, soil pH nutrient availability, and fertilization requirements.
"""

from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface

NUTRIENT_AGENT_PROMPT = """
You are the FarmOps Nutrient & Soil Health Risk Agent.
Your mission is to analyze nitrogen (N), phosphorus (P), potassium (K), electrical conductivity (EC), and soil pH.
Diagnose nutrient deficiencies or toxicities based on crop phenological stage.
Recommend organic soil amendments or balanced fertigation recipes.
"""


class NutrientAgent:
    def __init__(self, provider: AIProviderInterface):
        self.provider = provider
        self.agent_name = "nutrient_agent"
        self.version = "1.0.0"

    async def assess_risk(
        self,
        farm_id: str,
        zone_id: Optional[str],
        telemetry: Dict[str, Any],
        crop_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        soil_ph = telemetry.get("soil_ph", 6.5)
        nitrogen = telemetry.get("nitrogen", 45.0)
        phosphorus = telemetry.get("phosphorus", 25.0)
        potassium = telemetry.get("potassium", 180.0)

        # Agronomic risk heuristic
        if soil_ph < 5.5 or soil_ph > 8.0:
            severity = "high"
            score = 0.80
        elif nitrogen < 20.0 or potassium < 100.0:
            severity = "medium"
            score = 0.60
        else:
            severity = "low"
            score = 0.15

        prompt = (
            f"Evaluate soil nutrient and pH balance for zone {zone_id or 'farm'}.\n"
            f"Soil pH: {soil_ph}, Nitrogen: {nitrogen} mg/kg, Phosphorus: {phosphorus} mg/kg, Potassium: {potassium} mg/kg.\n"
            f"Crop context: {crop_context or {}}"
        )
        ai_analysis = await self.provider.generate_response(
            prompt=prompt,
            system_instruction=NUTRIENT_AGENT_PROMPT,
            context_data={"telemetry": telemetry, "crop": crop_context},
        )

        missing_info = []
        if "electrical_conductivity" not in telemetry:
            missing_info.append("electrical_conductivity")

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risk_type": "nutrient_deficiency",
            "severity": severity,
            "score": score,
            "confidence": 0.85,
            "evidence": {
                "soil_ph": soil_ph,
                "nitrogen": nitrogen,
                "phosphorus": phosphorus,
                "potassium": potassium,
                "analysis": ai_analysis,
            },
            "missing_information": missing_info,
            "agent": self.agent_name,
            "agent_version": self.version,
            "recommended_action_type": "apply_fertilizer",
            "recommended_action_summary": f"Apply balanced organic soil amendment to correct soil pH ({soil_ph}) and replenish nitrogen.",
            "estimated_cost": 85.0,
        }
