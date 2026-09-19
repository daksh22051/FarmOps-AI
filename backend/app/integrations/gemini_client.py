"""
Standardized Google Gemini Client Integration
Provides a resilient, timeout-enabled, and retry-safe abstraction for Google Gemini API.
"""

import json
import asyncio
from typing import Optional, Dict, Any
from app.config import settings
from app.core.logging import logger
from app.core.exceptions import AIProviderException


class GeminiClient:
    """
    Standardized client for Google Gemini LLM API calls.
    Supports structured JSON generation, configurable timeouts, retries, and error isolation.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 12.0,
        max_retries: int = 2,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self.timeout = timeout
        self.max_retries = max_retries
        self._genai_client = None

        if self.is_configured:
            try:
                from google import genai
                self._genai_client = genai.Client(api_key=self.api_key)
            except Exception as init_err:
                logger.warning(f"Failed to initialize Google GenAI SDK: {init_err}")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "your-gemini-api-key")

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Executes text generation against Gemini with timeout and retry handling.
        """
        if not self.is_configured or not self._genai_client:
            raise AIProviderException(
                detail="Gemini API is not configured. Missing GEMINI_API_KEY.",
                code="AI_PROVIDER_NOT_CONFIGURED",
            )

        full_prompt = prompt
        if context_data:
            sanitized_context = {k: v for k, v in context_data.items() if not any(s in k.lower() for s in ["key", "secret", "token", "password"])}
            full_prompt = f"Sanitized Context:\n{json.dumps(sanitized_context, default=str)}\n\nTask:\n{prompt}"

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                def _sync_call():
                    config = {}
                    if system_instruction:
                        config["system_instruction"] = system_instruction
                    response = self._genai_client.models.generate_content(
                        model=self.model,
                        contents=full_prompt,
                        config=config if config else None,
                    )
                    return response.text or ""

                return await asyncio.wait_for(asyncio.to_thread(_sync_call), timeout=self.timeout)

            except asyncio.TimeoutError:
                last_error = AIProviderException(
                    detail=f"Gemini API request timed out after {self.timeout}s (attempt {attempt}/{self.max_retries})",
                    code="AI_PROVIDER_TIMEOUT",
                )
                logger.warning(f"Gemini timeout on attempt {attempt}: {last_error}")
            except Exception as err:
                last_error = AIProviderException(
                    detail=f"Gemini API generation error: {str(err)}",
                    code="AI_PROVIDER_ERROR",
                )
                logger.warning(f"Gemini API error on attempt {attempt}: {err}")

            if attempt < self.max_retries:
                await asyncio.sleep(0.5 * attempt)

        raise last_error or AIProviderException("Gemini generation failed after retries.")

    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generates structured JSON output from Gemini and parses it into a dictionary.
        """
        json_instruction = (
            (system_instruction or "") +
            "\nCRITICAL: You MUST respond ONLY with a valid, raw JSON object matching the requested schema. "
            "Do NOT include markdown code fences, backticks, or preamble text."
        )

        raw_text = await self.generate_text(
            prompt=prompt,
            system_instruction=json_instruction,
            context_data=context_data,
        )

        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as json_err:
            logger.error(f"Failed to parse Gemini response as JSON: {json_err}. Raw text: {raw_text[:200]}")
            raise AIProviderException(
                detail="Gemini response was not valid JSON format.",
                code="AI_MALFORMED_OUTPUT",
            )
