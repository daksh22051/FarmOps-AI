"""
Deterministic Safety & Escalation Guard
Evaluates candidate ActionPlans and AIProposals deterministically without LLM dependency.
Enforces safety policies: ALLOW, APPROVAL_REQUIRED, ESCALATE, REJECT.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
from app.schemas.ai import AIProposal


class PolicyDecision(str, Enum):
    ALLOW = "ALLOW"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    ESCALATE = "ESCALATE"
    REJECT = "REJECT"


@dataclass
class SafetyEvaluationResult:
    decision: PolicyDecision
    approval_required: bool
    safety_flags: List[str]
    rationale: str
    requires_escalation: bool


class SafetyGuard:
    """
    Deterministic rule engine ensuring AI-generated proposals never trigger unsafe
    or unauthorized physical/chemical actions on the farm.
    """

    # Prohibited action keywords that must be outright rejected
    PROHIBITED_ACTIONS = {
        "actuator_direct_trigger",
        "autonomous_pump_start",
        "override_hardware_lockout",
        "execute_financial_trade",
        "autonomous_market_buy",
        "autonomous_market_sell",
        "turn valve",
        "open valve",
        "start pump",
        "direct actuator trigger",
    }

    # High-risk chemical / pesticide keywords that require human sign-off
    SENSITIVE_CHEMICAL_ACTIONS = {
        "synthetic_pesticide",
        "chemical_spray",
        "herbicide",
        "fungicide_systemic",
        "high_concentration_fertilizer",
        "restricted_pesticide",
        "apply_pesticide",
        "chemical_treatment",
    }

    @classmethod
    def evaluate_plan(
        cls,
        action_type: str,
        action_summary: str,
        confidence: float,
        evidence: Optional[Dict[str, Any]] = None,
        estimated_cost: Optional[float] = None,
        cost_threshold_for_approval: float = 250.0,
    ) -> SafetyEvaluationResult:
        flags: List[str] = []
        action_str = f"{action_type.lower()} {action_summary.lower()}"

        # 1. Check Prohibited Direct Controls
        for prohibited in cls.PROHIBITED_ACTIONS:
            if prohibited in action_str:
                return SafetyEvaluationResult(
                    decision=PolicyDecision.REJECT,
                    approval_required=False,
                    safety_flags=["PROHIBITED_ACTION_TRIGGER"],
                    rationale=f"Action '{action_type}' is prohibited by deterministic farm safety policy.",
                    requires_escalation=False,
                )

        # 2. Check Low Confidence (< 0.70)
        if confidence < 0.70:
            flags.append("LOW_AI_CONFIDENCE")
            return SafetyEvaluationResult(
                decision=PolicyDecision.ESCALATE,
                approval_required=True,
                safety_flags=flags,
                rationale=f"AI model confidence ({confidence:.2f}) is below safe automated execution threshold (0.70).",
                requires_escalation=True,
            )

        # 3. Check Sensitive Chemicals & Sprays
        for chemical_term in cls.SENSITIVE_CHEMICAL_ACTIONS:
            if chemical_term in action_str:
                flags.append("SENSITIVE_CHEMICAL_APPLICATION")
                return SafetyEvaluationResult(
                    decision=PolicyDecision.APPROVAL_REQUIRED,
                    approval_required=True,
                    safety_flags=flags,
                    rationale="Chemical/pesticide treatments require human agronomist verification.",
                    requires_escalation=False,
                )

        # 4. Check High Cost Exceedance
        if estimated_cost and estimated_cost > cost_threshold_for_approval:
            flags.append("COST_THRESHOLD_EXCEEDED")
            return SafetyEvaluationResult(
                decision=PolicyDecision.APPROVAL_REQUIRED,
                approval_required=True,
                safety_flags=flags,
                rationale=f"Estimated cost (${estimated_cost:.2f}) exceeds auto-approval ceiling (${cost_threshold_for_approval:.2f}).",
                requires_escalation=False,
            )

        # 5. Check Missing Evidence in High Impact Actions
        if evidence is None or len(evidence) == 0:
            if action_type in ["apply_fertilizer", "irrigate_heavy"]:
                flags.append("MISSING_CRITICAL_EVIDENCE")
                return SafetyEvaluationResult(
                    decision=PolicyDecision.ESCALATE,
                    approval_required=True,
                    safety_flags=flags,
                    rationale="Crucial telemetry evidence is absent for high-impact action proposal.",
                    requires_escalation=True,
                )

        # 6. Default Safe Allow
        return SafetyEvaluationResult(
            decision=PolicyDecision.ALLOW,
            approval_required=False,
            safety_flags=["SAFE_ROUTINE_ACTION"],
            rationale="Plan meets all deterministic safety criteria for automated execution.",
            requires_escalation=False,
        )

    @classmethod
    def evaluate_proposal(
        cls,
        proposal: AIProposal,
        context: Optional[Dict[str, Any]] = None,
    ) -> SafetyEvaluationResult:
        """
        Evaluates structured AIProposal against deterministic safety rules.
        """
        flags: List[str] = []
        text_to_scan = f"{proposal.recommendation.lower()} {proposal.rationale.lower()} {(proposal.safety_notes or '').lower()}"

        # 1. Check for prohibited direct physical actuator / financial triggers
        for prohibited in cls.PROHIBITED_ACTIONS:
            if prohibited in text_to_scan:
                return SafetyEvaluationResult(
                    decision=PolicyDecision.REJECT,
                    approval_required=False,
                    safety_flags=["PROHIBITED_ACTION_TRIGGER"],
                    rationale=f"AI Proposal contains prohibited direct actuator control or financial operation: '{prohibited}'.",
                    requires_escalation=False,
                )

        # 2. Check Low AI Confidence (< 0.70)
        if proposal.confidence < 0.70:
            flags.append("LOW_AI_CONFIDENCE")
            return SafetyEvaluationResult(
                decision=PolicyDecision.APPROVAL_REQUIRED,
                approval_required=True,
                safety_flags=flags,
                rationale=f"AI model confidence ({proposal.confidence:.2f}) is below automated acceptance threshold (0.70). Human review required.",
                requires_escalation=True,
            )

        # 3. Check for sensitive chemicals or synthetic pesticides
        for chemical in cls.SENSITIVE_CHEMICAL_ACTIONS:
            if chemical in text_to_scan:
                flags.append("SENSITIVE_CHEMICAL_APPLICATION")
                return SafetyEvaluationResult(
                    decision=PolicyDecision.APPROVAL_REQUIRED,
                    approval_required=True,
                    safety_flags=flags,
                    rationale=f"Proposal references sensitive chemical/pesticide treatment ('{chemical}'). Mandatory human agronomist review required.",
                    requires_escalation=False,
                )

        # 4. Check if proposal explicitly flagged requires_human_review
        if proposal.requires_human_review and proposal.urgency in ["high", "critical"]:
            flags.append("HIGH_URGENCY_HUMAN_REVIEW")
            return SafetyEvaluationResult(
                decision=PolicyDecision.APPROVAL_REQUIRED,
                approval_required=True,
                safety_flags=flags,
                rationale="High-urgency advisory flagged for mandatory agronomist review before field implementation.",
                requires_escalation=False,
            )

        # 5. Default safe routine advisory
        return SafetyEvaluationResult(
            decision=PolicyDecision.ALLOW,
            approval_required=False,
            safety_flags=["SAFE_ROUTINE_ADVISORY"],
            rationale="Proposal verified as safe non-invasive agronomic advisory.",
            requires_escalation=False,
        )
