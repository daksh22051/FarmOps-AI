"""
Base AI Agent Interface
Defines the standard contract, prompt construction, and Pydantic validation workflow for all domain agents.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from app.ai.provider import AIProviderInterface, get_ai_provider
from app.schemas.ai import AIProposal
from app.core.logging import logger
from app.core.exceptions import AIProviderException


class BaseAIAgent(ABC):
    def __init__(
        self,
        provider: Optional[AIProviderInterface] = None,
        agent_type: str = "ORCHESTRATOR",
        version: str = "1.0.0",
    ):
        self.provider = provider or get_ai_provider()
        self.agent_type = agent_type
        self.version = version

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Returns the specialized agronomic system instruction for this agent."""
        pass

    @property
    @abstractmethod
    def default_risk_type(self) -> str:
        """Returns the default risk type handled by this agent."""
        pass

    def build_user_prompt(self, context: Dict[str, Any]) -> str:
        """
        Constructs a structured prompt summarizing the current risk, farm, telemetry, and observations.
        """
        risk = context.get("risk", {})
        farm = context.get("farm", {})
        zone = context.get("zone", {})
        telemetry = context.get("telemetry", {})
        history = context.get("telemetry_history", [])
        observations = context.get("observations", [])

        prompt_lines = [
            f"Evaluate detected risk for Farm '{farm.get('name', 'N/A')}' (Zone: '{zone.get('name', 'Farm-wide') if zone else 'Farm-wide'}').",
            f"Crop: {zone.get('crop', 'General') if zone else 'General'}",
            f"Detected Risk Type: {risk.get('risk_type', self.default_risk_type)}",
            f"Severity: {risk.get('severity', 'medium')}, Deterministic Score: {risk.get('score', 0.5)}, Engine Confidence: {risk.get('confidence', 0.5)}",
            f"Engine Evidence: {risk.get('evidence', {})}",
            f"Latest Sensor Telemetry: {telemetry}",
            f"Recent Telemetry History Points: {len(history)}",
            f"Active External Observations: {observations}",
            "",
            "Generate your structured advisory proposal in raw JSON format.",
        ]
        return "\n".join(prompt_lines)

    @abstractmethod
    async def evaluate(self, context: Dict[str, Any]) -> AIProposal:
        """
        Executes LLM reasoning over context and returns a validated AIProposal.
        """
        pass

    async def _generate_and_validate(self, context: Dict[str, Any]) -> AIProposal:
        """
        Helper method that invokes the AI provider and parses/validates the returned JSON into an AIProposal.
        """
        prompt = self.build_user_prompt(context)
        try:
            raw_json = await self.provider.generate_json(
                prompt=prompt,
                system_instruction=self.system_prompt,
                context_data=context,
            )
            return AIProposal.model_validate(raw_json)
        except Exception as err:
            logger.warning(f"Error during {self.agent_type} JSON generation: {err}. Attempting fallback parser.")
            # If standard JSON parsing failed, try generate_response as text fallback
            try:
                raw_text = await self.provider.generate_response(
                    prompt=prompt,
                    system_instruction=self.system_prompt,
                    context_data=context,
                )
                # Build a safe structured fallback proposal
                return AIProposal(
                    agent_type=self.agent_type,
                    risk_type=context.get("risk", {}).get("risk_type", self.default_risk_type),
                    recommendation=f"Review agronomic conditions for {context.get('risk', {}).get('risk_type', self.default_risk_type)}.",
                    rationale=raw_text[:300] if raw_text else "AI model evaluated telemetry context.",
                    confidence=0.65,
                    urgency="medium",
                    evidence_refs=list(context.get("telemetry", {}).keys()),
                    assumptions=["Fallback response generated due to unstructured provider output"],
                    uncertainty="Provider response was semi-structured.",
                    requires_human_review=True,
                    safety_notes="Advisory review required.",
                )
            except Exception as final_err:
                raise AIProviderException(f"{self.agent_type} evaluation failed: {final_err}")
