"""
Isolated AI Provider Layer
Provides a uniform abstraction over Google Gemini API with fallback Mock Provider for local testing.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from app.config import settings
from app.core.logging import logger
from app.core.exceptions import AIProviderException


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


class GeminiProvider(AIProviderInterface):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        self._client = None
        if self.api_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI client: {e}")

    async def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        if not self._client:
            raise AIProviderException("Gemini API Client is not configured or missing GEMINI_API_KEY.")

        try:
            full_prompt = prompt
            if context_data:
                full_prompt = f"Context Data:\n{context_data}\n\nTask:\n{prompt}"

            # Run Gemini generate_content asynchronously via client
            response = self._client.models.generate_content(
                model=self.model,
                contents=full_prompt,
                config={"system_instruction": system_instruction} if system_instruction else None,
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Gemini API generation failed: {e}")
            raise AIProviderException(f"Gemini API failure: {str(e)}")


class MockAIProvider(AIProviderInterface):
    """
    Mock AI Provider used during local development or testing when GEMINI_API_KEY is not supplied.
    Returns realistic agronomic responses.
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
                f"Recommendation: Deliver 15-20 mm of precision drip irrigation during early morning hours "
                f"(05:00 - 07:30) to replenish root-zone volumetric water content while minimizing evaporative loss."
            )
        elif "pest" in lower_prompt or "disease" in lower_prompt or "fung" in lower_prompt:
            return (
                "Agronomic Pest & Disease Risk Assessment: Ambient relative humidity is elevated.\n"
                "Risk detected for early fungal blight. Recommendation: Ensure adequate canopy airflow, "
                "inspect lower leaf surfaces for lesions, and prepare bio-fungicide (Bacillus subtilis) application."
            )
        elif "harvest" in lower_prompt or "yield" in lower_prompt:
            return (
                "Agronomic Yield & Harvest Projection: Crop maturation indices indicate optimal vegetative vigor.\n"
                "Expected harvest window is within 18-24 days. Soil nutrient balance is conducive to high-grade yield."
            )
        else:
            return (
                f"FarmOps AI Autonomous Supervisor: Analyzed farm telemetry context.\n"
                f"All microclimate parameters are within acceptable agronomic operational bands. "
                f"Continue baseline monitoring and maintain automated sensor telemetry streaming."
            )


def get_ai_provider() -> AIProviderInterface:
    """Factory returning live GeminiProvider if API key is present, else MockAIProvider."""
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your-gemini-api-key":
        return GeminiProvider()
    return MockAIProvider()
