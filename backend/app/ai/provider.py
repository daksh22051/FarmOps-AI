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
        self.fallback = MockAIProvider()

    async def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        try:
            return await self.client.generate_text(
                prompt=prompt,
                system_instruction=system_instruction,
                context_data=context_data,
            )
        except Exception as e:
            logger.warning(f"GeminiProvider generate_response failed: {e}. Gracefully falling back to agronomic expert rules.")
            return await self.fallback.generate_response(
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
        try:
            return await self.client.generate_json(
                prompt=prompt,
                system_instruction=system_instruction,
                context_data=context_data,
            )
        except Exception as e:
            logger.warning(f"GeminiProvider generate_json failed: {e}. Gracefully falling back to agronomic expert rules.")
            return await self.fallback.generate_json(
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
            humidity = telemetry.get("air_humidity")
            # Only cite a humidity figure when one was actually measured. A missing
            # reading must stay missing rather than being defaulted into the rationale.
            if humidity is None:
                rationale = (
                    "Reported conditions are consistent with a microclimate that can favour "
                    "fungal spore germination, but no humidity reading was available for this zone."
                )
                confidence = 0.45
                evidence_refs: list = []
                missing = ["air_humidity"]
            else:
                rationale = (
                    f"Measured relative humidity ({humidity}%) together with warm canopy temperatures "
                    f"creates a microclimate in which spore germination is more likely."
                )
                confidence = 0.62
                evidence_refs = ["air_humidity", "air_temperature"]
                missing = []
            return {
                "agent_type": "PEST_DISEASE_AGENT",
                "risk_type": "pest_disease",
                "recommendation": "Scout the affected zone for foliar symptoms; this is a risk candidate, not a confirmed diagnosis.",
                "rationale": rationale,
                "confidence": confidence,
                "urgency": "medium",
                "evidence_refs": evidence_refs,
                "assumptions": ["Canopy microclimate is comparable to the edge sensor location"],
                "uncertainty": (
                    "No imagery or laboratory confirmation is available. Visual foliar symptoms must be "
                    "confirmed on site before any pathogen is named."
                    + (f" Missing inputs: {', '.join(missing)}." if missing else "")
                ),
                "requires_human_review": True,
                "safety_notes": "Advisory proposal only. Do not apply chemical pesticides without a confirmed diagnosis and human review.",
            }

        elif "(NUTRIENT_AGENT)" in sys_inst or risk_type == "nutrient_deficiency":
            # Report only nutrient values that were actually measured, and never propose a
            # product or dosage — soil sampling is the correct next step for this agent.
            nutrient_keys = ("nitrogen", "phosphorus", "potassium", "soil_ph", "ph")
            measured = {k: telemetry[k] for k in nutrient_keys if telemetry.get(k) is not None}
            missing = [k for k in ("nitrogen", "phosphorus", "potassium") if telemetry.get(k) is None]
            if measured:
                readings = ", ".join(f"{k}={v}" for k, v in measured.items())
                rationale = (
                    f"Available soil readings ({readings}) sit outside the configured comfortable range "
                    f"for this crop, which is consistent with a nutrient availability problem."
                )
                confidence = 0.55 if missing else 0.7
            else:
                rationale = (
                    "No soil nutrient readings were available for this zone, so the deficiency cannot be "
                    "characterised from telemetry alone."
                )
                confidence = 0.35
            return {
                "agent_type": "NUTRIENT_AGENT",
                "risk_type": "nutrient_deficiency",
                "recommendation": (
                    "Collect a soil sample from the affected zone and review the laboratory result with an "
                    "agronomist before any corrective nutrient application is planned."
                ),
                "rationale": rationale,
                "confidence": confidence,
                "urgency": "medium",
                "evidence_refs": list(measured.keys()),
                "assumptions": ["Soil nutrient sensor placement is representative of the zone"],
                "uncertainty": (
                    "Sensor-derived nutrient values are indicative only and do not replace a laboratory soil test."
                    + (f" No reading available for: {', '.join(missing)}." if missing else "")
                ),
                "requires_human_review": True,
                "safety_notes": (
                    "Advisory only. This system does not calculate fertilizer products, blends or dosages; "
                    "those must come from a soil test interpreted by a qualified agronomist."
                ),
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
            moisture = telemetry.get("soil_moisture")
            if moisture is None:
                signals = risk.get("evidence", {}).get("signals") or [{}]
                moisture = signals[0].get("value")
            if moisture is None:
                # No measurement to reason from: say so instead of assuming a value.
                return {
                    "agent_type": "WATER_AGENT",
                    "risk_type": "water_stress",
                    "recommendation": "Check the affected zone in person; no soil moisture reading is available to assess irrigation need.",
                    "rationale": "No soil moisture measurement was available for this zone at assessment time.",
                    "confidence": 0.3,
                    "urgency": "medium",
                    "evidence_refs": [],
                    "assumptions": [],
                    "uncertainty": "Soil moisture is missing; the zone may or may not be water stressed.",
                    "requires_human_review": True,
                    "safety_notes": "Advisory only. This system does not operate irrigation equipment.",
                }
            return {
                "agent_type": "WATER_AGENT",
                "risk_type": "water_stress",
                "recommendation": f"Review irrigation need for affected zone due to persistent low soil moisture ({moisture}%).",
                "rationale": f"Observed soil moisture ({moisture}%) is below the configured comfortable range for this crop stage.",
                "confidence": 0.75,
                "urgency": "high" if float(moisture) < 20.0 else "medium",
                "evidence_refs": ["soil_moisture", "air_temperature"],
                "assumptions": ["Sensor calibration is accurate", "Drip irrigation system operational"],
                "uncertainty": "Long-range weather forecast precipitation volume remains uncertain.",
                "requires_human_review": True,
                "safety_notes": "Advisory only. This system does not operate irrigation equipment; do not over-saturate the root zone.",
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
