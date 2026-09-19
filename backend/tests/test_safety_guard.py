"""
Deterministic Safety Guard Tests
Verifies rule-based enforcement of ALLOW, APPROVAL_REQUIRED, ESCALATE, and REJECT policies without LLM dependency.
"""

import pytest
from app.ai.safety_guard import SafetyGuard, PolicyDecision


def test_safety_guard_allows_safe_routine_irrigation():
    result = SafetyGuard.evaluate_plan(
        action_type="irrigate",
        action_summary="Deliver 15 mm of precision drip irrigation during early morning.",
        confidence=0.92,
        evidence={"soil_moisture": 25.0},
        estimated_cost=15.0,
    )
    assert result.decision == PolicyDecision.ALLOW
    assert result.approval_required is False
    assert result.requires_escalation is False


def test_safety_guard_rejects_prohibited_actuator_override():
    result = SafetyGuard.evaluate_plan(
        action_type="actuator_direct_trigger",
        action_summary="Autonomous pump start with direct hardware override.",
        confidence=0.99,
        evidence={"sensor": "dry"},
    )
    assert result.decision == PolicyDecision.REJECT
    assert "PROHIBITED_ACTION_TRIGGER" in result.safety_flags
    assert result.requires_escalation is False


def test_safety_guard_requires_approval_for_sensitive_chemicals():
    result = SafetyGuard.evaluate_plan(
        action_type="apply_pesticide",
        action_summary="Apply systemic chemical_spray to eradicate fungal infestation.",
        confidence=0.95,
        evidence={"humidity": 88.0},
        estimated_cost=60.0,
    )
    assert result.decision == PolicyDecision.APPROVAL_REQUIRED
    assert result.approval_required is True
    assert "SENSITIVE_CHEMICAL_APPLICATION" in result.safety_flags


def test_safety_guard_escalates_on_low_confidence():
    result = SafetyGuard.evaluate_plan(
        action_type="apply_fertilizer",
        action_summary="Apply organic nitrogen booster.",
        confidence=0.62,  # Below 0.70 threshold
        evidence={"soil_ph": 6.2},
    )
    assert result.decision == PolicyDecision.ESCALATE
    assert result.approval_required is True
    assert result.requires_escalation is True
    assert "LOW_AI_CONFIDENCE" in result.safety_flags


def test_safety_guard_requires_approval_on_high_cost():
    result = SafetyGuard.evaluate_plan(
        action_type="soil_remediation",
        action_summary="Comprehensive field gypsum amendment and deep subsoiling.",
        confidence=0.90,
        evidence={"soil_compaction": "high"},
        estimated_cost=650.0,  # Exceeds default $250 limit
    )
    assert result.decision == PolicyDecision.APPROVAL_REQUIRED
    assert result.approval_required is True
    assert "COST_THRESHOLD_EXCEEDED" in result.safety_flags
