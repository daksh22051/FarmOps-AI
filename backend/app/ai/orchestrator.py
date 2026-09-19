"""
Plan Orchestrator
Coordinates multi-agent risk detection, ActionPlan synthesis, Deterministic Safety Guard enforcement,
and automated Task / Alert / Escalation generation.
"""

from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai.provider import get_ai_provider, AIProviderInterface
from app.ai.safety_guard import SafetyGuard, PolicyDecision
from app.ai.agents.water_stress import WaterStressAgent
from app.ai.agents.pest_disease import PestDiseaseAgent
from app.ai.agents.nutrient import NutrientAgent
from app.ai.agents.market_context import MarketContextAgent

from app.models.risk import RiskAssessment
from app.models.plan import ActionPlan
from app.models.task import Task
from app.models.alert import Alert
from app.models.escalation import Escalation
from app.models.audit import AuditEvent
from app.core.logging import logger


class PlanOrchestrator:
    def __init__(self, provider: Optional[AIProviderInterface] = None):
        self.provider = provider or get_ai_provider()
        self.water_stress_agent = WaterStressAgent(self.provider)
        self.pest_disease_agent = PestDiseaseAgent(self.provider)
        self.nutrient_agent = NutrientAgent(self.provider)
        self.market_context_agent = MarketContextAgent(self.provider)

    async def evaluate_and_orchestrate(
        self,
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        telemetry: Optional[Dict[str, Any]] = None,
        crop_context: Optional[Dict[str, Any]] = None,
        actor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes end-to-end autonomous agronomic intelligence loop:
        1. Multi-agent risk assessment
        2. Plan proposal synthesis
        3. Deterministic Safety Guard evaluation
        4. Conditional Task, Alert, or Escalation creation
        5. Audit event logging
        """
        tel = telemetry or {}
        results: List[Dict[str, Any]] = []

        # 1. Run all 4 domain agents
        agent_assessments = [
            await self.water_stress_agent.assess_risk(farm_id, zone_id, tel, crop_context),
            await self.pest_disease_agent.assess_risk(farm_id, zone_id, tel, crop_context),
            await self.nutrient_agent.assess_risk(farm_id, zone_id, tel, crop_context),
            await self.market_context_agent.assess_risk(
                farm_id, zone_id, crop_context.get("crop_name", "Produce") if crop_context else "Produce"
            ),
        ]

        created_risks: List[RiskAssessment] = []
        created_plans: List[ActionPlan] = []
        created_tasks: List[Task] = []
        created_alerts: List[Alert] = []
        created_escalations: List[Escalation] = []

        for assessment_data in agent_assessments:
            # 2. Persist Risk Assessment
            risk = RiskAssessment(
                farm_id=farm_id,
                zone_id=zone_id,
                risk_type=assessment_data["risk_type"],
                severity=assessment_data["severity"],
                score=assessment_data["score"],
                confidence=assessment_data["confidence"],
                evidence=assessment_data["evidence"],
                missing_information=assessment_data["missing_information"],
                status="open",
                agent=assessment_data["agent"],
                agent_version=assessment_data["agent_version"],
            )
            session.add(risk)
            await session.commit()
            await session.refresh(risk)
            created_risks.append(risk)

            # Audit risk detection
            session.add(
                AuditEvent(
                    farm_id=farm_id,
                    entity_type="risk_assessment",
                    entity_id=risk.id,
                    actor_id=actor_id or "system",
                    event_type="risk_detected",
                    after_state={"risk_type": risk.risk_type, "severity": risk.severity, "score": risk.score},
                    source="agent",
                    model_version=assessment_data["agent_version"],
                )
            )

            # 3. Create Alert if Severity is High or Critical
            if risk.severity in ["high", "critical"]:
                dedupe = f"{farm_id}_{zone_id or 'all'}_{risk.risk_type}_{risk.severity}"
                alert = Alert(
                    farm_id=farm_id,
                    zone_id=zone_id,
                    risk_id=risk.id,
                    severity=risk.severity,
                    channel="in_app",
                    message=f"Urgent Risk: {risk.risk_type.replace('_', ' ').title()} (Severity: {risk.severity.upper()})",
                    delivery_status="pending",
                    dedupe_key=dedupe,
                )
                session.add(alert)
                created_alerts.append(alert)

            # 4. Synthesize Candidate Action Plan
            action_type = assessment_data.get("recommended_action_type", "scout_field")
            action_summary = assessment_data.get("recommended_action_summary", "Field inspection recommended.")
            confidence = assessment_data["confidence"]
            estimated_cost = assessment_data.get("estimated_cost", 0.0)

            # 5. Execute Deterministic Safety Guard (Zero LLM Dependency)
            safety_eval = SafetyGuard.evaluate_plan(
                action_type=action_type,
                action_summary=action_summary,
                confidence=confidence,
                evidence=assessment_data["evidence"],
                estimated_cost=estimated_cost,
            )

            plan = ActionPlan(
                farm_id=farm_id,
                zone_id=zone_id,
                risk_id=risk.id,
                source_risk_ids=[risk.id],
                action_type=action_type,
                action_summary=action_summary,
                priority="urgent" if risk.severity == "critical" else ("high" if risk.severity == "high" else "medium"),
                confidence=confidence,
                evidence=assessment_data["evidence"],
                estimated_cost=estimated_cost,
                safety_flags=safety_eval.safety_flags,
                approval_required=safety_eval.approval_required,
                approval_state="pending" if safety_eval.approval_required else "auto_approved",
                policy_decision=safety_eval.decision.value,
                rationale=safety_eval.rationale,
                version=1,
            )
            session.add(plan)
            await session.commit()
            await session.refresh(plan)
            created_plans.append(plan)

            # Audit plan creation & safety decision
            session.add(
                AuditEvent(
                    farm_id=farm_id,
                    entity_type="action_plan",
                    entity_id=plan.id,
                    actor_id=actor_id or "system",
                    event_type="safety_evaluated",
                    after_state={
                        "action_type": plan.action_type,
                        "policy_decision": plan.policy_decision,
                        "approval_required": plan.approval_required,
                    },
                    source="safety_guard",
                    policy_version="1.0.0",
                )
            )

            # 6. Branch based on Safety Guard Policy Decision
            if safety_eval.requires_escalation or safety_eval.decision == PolicyDecision.ESCALATE:
                escalation = Escalation(
                    farm_id=farm_id,
                    zone_id=zone_id,
                    risk_id=risk.id,
                    plan_id=plan.id,
                    reason=safety_eval.rationale,
                    status="open",
                )
                session.add(escalation)
                created_escalations.append(escalation)
                logger.warning(f"ESCALATION TRIGGERED for plan {plan.id}: {safety_eval.rationale}")

            elif safety_eval.decision == PolicyDecision.ALLOW and not safety_eval.approval_required:
                # Direct Task Creation ONLY when fully allowed by Safety Guard
                task = Task(
                    farm_id=farm_id,
                    zone_id=zone_id,
                    plan_id=plan.id,
                    status="pending",
                    notes=f"Auto-generated from approved plan: {plan.action_summary}",
                    checklist=[{"item": f"Execute {plan.action_type}", "done": False}],
                )
                session.add(task)
                created_tasks.append(task)
                logger.info(f"TASK CREATED for plan {plan.id} under policy ALLOW")

        await session.commit()

        return {
            "farm_id": farm_id,
            "zone_id": zone_id,
            "risks_detected": len(created_risks),
            "plans_generated": len(created_plans),
            "tasks_created": len(created_tasks),
            "alerts_fired": len(created_alerts),
            "escalations_opened": len(created_escalations),
            "risks": [r.id for r in created_risks],
            "plans": [p.id for p in created_plans],
        }
