"""
Isolated AI Provider Layer
Provides a uniform abstraction over Google Gemini API with fallback Mock Provider for local testing.
"""

import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from app.config import settings
from app.core.logging import logger
from app.core.exceptions import AIProviderException
from app.integrations.gemini_client import GeminiClient


class AIProviderInterface(ABC):
    @abstractmethod
    async def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generates text from the AI model."""
        pass

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generates structured JSON dictionary from the AI model."""
        pass


class GeminiProvider(AIProviderInterface):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.client = GeminiClient(api_key=api_key, model=model)

    async def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        return await self.client.generate_text(
            prompt=prompt,
            system_instruction=system_instruction,
            context_data=context_data,
        )

    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await self.client.generate_json(
            prompt=prompt,
            system_instruction=system_instruction,
            context_data=context_data,
        )


class MockAIProvider(AIProviderInterface):
    """
    Mock AI Provider used during local development or testing when GEMINI_API_KEY is not supplied.
    Returns realistic agronomic responses matching required schemas.
    """

    async def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        lower_prompt = prompt.lower()
        context = context_data or {}
        moisture = context.get("soil_moisture", 35.0)

        if "irrigat" in lower_prompt or "water" in lower_prompt:
            return (
                f"Agronomic Irrigation Analysis: Current soil moisture is recorded at {moisture}%.\n"
                f"Recommendation: Review irrigation schedule for affected zone to replenish root-zone volumetric water content."
            )
        elif "pest" in lower_prompt or "disease" in lower_prompt or "fung" in lower_prompt:
            return (
                "Agronomic Pest & Disease Risk Assessment: Ambient relative humidity is elevated.\n"
                "Conditions indicate elevated risk of pathogen development. Recommendation: Conduct manual field scouting."
            )
        elif "nutrient" in lower_prompt or "fertiliz" in lower_prompt:
            return (
                "Agronomic Soil Nutrient Assessment: Suboptimal macronutrient levels detected.\n"
                "Recommendation: Conduct soil sample testing to verify available nitrogen and pH balance."
            )
        else:
            return (
                "FarmOps AI Autonomous Supervisor: Analyzed farm telemetry context.\n"
                "All parameters evaluated. Maintain baseline monitoring."
            )

    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        sys_inst = system_instruction or ""
        context = context_data or {}
        telemetry = context.get("telemetry", {})
        risk = context.get("risk", {})
        risk_type = (risk.get("risk_type") or "").lower()

        if "(PEST_DISEASE_AGENT)" in sys_inst or risk_type == "pest_disease":
            humidity = telemetry.get("air_humidity", 85.0)
            return {
                "agent_type": "PEST_DISEASE_AGENT",
                "risk_type": "pest_disease",
                "recommendation": "Microclimate conditions indicate elevated risk of fungal pathogen development; field scouting is recommended.",
                "rationale": f"Sustained high relative humidity ({humidity}%) and warm canopy temperatures create favorable microclimate for spore germination.",
                "confidence": 0.82,
                "urgency": "medium",
                "evidence_refs": ["air_humidity", "air_temperature"],
                "assumptions": ["Canopy microclimate aligns with edge sensor readings"],
                "uncertainty": "Visual foliar symptoms require on-site agronomist scouting to confirm presence of spores.",
                "requires_human_review": True,
                "safety_notes": "Advisory proposal only. Do not apply chemical pesticides without confirmed diagnosis and human review.",
            }

        elif "(NUTRIENT_AGENT)" in sys_inst or risk_type == "nutrient_deficiency":
            return {
                "agent_type": "NUTRIENT_AGENT",
                "risk_type": "nutrient_deficiency",
                "recommendation": "Perform localized soil core sampling and test available nitrogen/potassium before amending soil.",
                "rationale": "Telemetry indicates depleted available macronutrients below minimum vegetative stage baseline.",
                "confidence": 0.78,
                "urgency": "medium",
                "evidence_refs": ["nitrogen", "soil_ph"],
                "assumptions": ["Root zone nutrient sensor is properly calibrated"],
                "uncertainty": "Subsoil nutrient stratification and organic matter mineralization rates are not measured directly.",
                "requires_human_review": True,
                "safety_notes": "Advisory only. Exact chemical fertilizer dosages must be formulated by a certified agronomist.",
            }

        elif "(MARKET_CONTEXT_AGENT)" in sys_inst or risk_type == "market_exposure":
            has_market_data = bool(context.get("market") or context.get("observations"))
            if not has_market_data:
                return {
                    "agent_type": "MARKET_CONTEXT_AGENT",
                    "risk_type": "market_exposure",
                    "recommendation": "Market context is currently unavailable. Maintain planned agronomic schedule.",
                    "rationale": "No verified regional market spot prices or commodity exchange feeds are currently active.",
                    "confidence": 0.50,
                    "urgency": "low",
                    "evidence_refs": [],
                    "assumptions": ["Standard local wholesale distribution channel active"],
                    "uncertainty": "Live spot commodity prices could not be fetched.",
                    "requires_human_review": False,
                    "safety_notes": "Informational context only. Never executes financial transactions or market orders.",
                }
            return {
                "agent_type": "MARKET_CONTEXT_AGENT",
                "risk_type": "market_exposure",
                "recommendation": "Monitor local commodity market trends as crop approaches optimal harvest window.",
                "rationale": "Regional wholesale pricing indicates stable commodity demand.",
                "confidence": 0.75,
                "urgency": "low",
                "evidence_refs": ["market_observation"],
                "assumptions": ["Historical seasonal demand patterns hold"],
                "uncertainty": "Regional transport fuel surcharges may influence net margins.",
                "requires_human_review": False,
                "safety_notes": "Informational advisory only.",
            }

        elif "(WATER_AGENT)" in sys_inst or risk_type == "water_stress" or "irrigation" in risk_type:
            moisture = telemetry.get("soil_moisture") or risk.get("evidence", {}).get("signals", [{}])[0].get("value", 18.5)
            return {
                "agent_type": "WATER_AGENT",
                "risk_type": "water_stress",
                "recommendation": f"Review irrigation need for affected zone due to persistent low soil moisture ({moisture}%).",
                "rationale": f"Observed soil moisture ({moisture}%) is below optimal vegetative threshold with dry atmospheric conditions.",
                "confidence": 0.88,
                "urgency": "high" if float(moisture) < 20.0 else "medium",
                "evidence_refs": ["soil_moisture", "air_temperature"],
                "assumptions": ["Sensor calibration is accurate", "Drip irrigation system operational"],
                "uncertainty": "Long-range weather forecast precipitation volume remains uncertain.",
                "requires_human_review": True,
                "safety_notes": "Do not exceed zone hydraulic pressure limits or over-saturate root zone.",
            }

        return {
            "agent_type": "ORCHESTRATOR",
            "risk_type": "general_advisory",
            "recommendation": "Maintain standard farm monitoring protocol.",
            "rationale": "Agronomic parameters are within operational ranges.",
            "confidence": 0.85,
            "urgency": "low",
            "evidence_refs": [],
            "assumptions": [],
            "uncertainty": "None",
            "requires_human_review": False,
            "safety_notes": None,
        }


def get_ai_provider() -> AIProviderInterface:
    """Factory returning live GeminiProvider if API key is present, else MockAIProvider."""
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your-gemini-api-key" and not settings.GEMINI_API_KEY.startswith("mock_"):
        return GeminiProvider()
    return MockAIProvider()
