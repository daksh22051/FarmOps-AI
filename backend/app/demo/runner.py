"""
Demo Pipeline Runner Engine
Executes the full end-to-end FarmOps AI workflow deterministically through production services:
Telemetry -> Risk Detection -> AI Reasoning -> Safety Guard -> Action Plan -> Approval -> Task Execution -> Reassessment -> Audit/Alerts.
"""

import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser
from app.core.logging import logger
from app.demo.schemas import DemoRunRequest, DemoRunResult
from app.demo.seed_demo import seed_or_get_demo_infrastructure

from app.models.sensor_event import SensorEvent
from app.models.risk import RiskAssessment
from app.models.plan import ActionPlan
from app.models.task import Task
from app.models.audit import AuditEvent
from app.models.alert import Alert

from app.schemas.telemetry import TelemetryEventCreate
from app.schemas.ai import AIProposal
from app.services.telemetry_service import TelemetryService
from app.services.risk_detection_service import RiskDetectionService
from app.services.ai_context_service import AIContextService
from app.services.action_plan_service import ActionPlanService
from app.services.task_service import TaskService
from app.services.alert_service import AlertService
from app.ai.provider import get_ai_provider
from app.ai.agents.water_stress import WaterStressAgent
from app.ai.agents.pest_disease import PestDiseaseAgent
from app.ai.agents.nutrient import NutrientAgent
from app.ai.safety_guard import SafetyGuard, PolicyDecision


class DemoRunner:
    @staticmethod
    def _get_scenario_telemetry(scenario: str) -> Dict[str, Any]:
        """Returns deterministic, realistic sensor measurements for the scenario."""
        clean_scenario = (scenario or "water_stress").strip().lower()
        if clean_scenario == "pest_disease":
            return {
                "soil_moisture": 32.0,
                "soil_temperature": 22.5,
                "air_temperature": 25.0,
                "air_humidity": 89.5,      # Triggers Pest & Disease humidity threshold (> 88.0%)
                "soil_ph": 6.7,
                "nitrogen": 40.0,
                "phosphorus": 25.0,
                "potassium": 35.0,
            }
        elif clean_scenario == "nutrient_deficiency":
            return {
                "soil_moisture": 30.0,
                "soil_temperature": 24.0,
                "air_temperature": 26.0,
                "air_humidity": 55.0,
                "soil_ph": 5.1,             # Low pH
                "nitrogen": 8.0,            # Severe low N (< 12.0)
                "phosphorus": 6.5,          # Severe low P (< 8.0)
                "potassium": 9.0,           # Severe low K (< 10.0)
            }
        else:  # water_stress / chemical_approval / prohibited_actuator
            return {
                "soil_moisture": 16.5,      # Critical low moisture (< 20.0%)
                "soil_temperature": 29.0,
                "air_temperature": 34.5,    # High evapotranspiration (> 32.0°C)
                "air_humidity": 32.0,       # Low RH (< 35.0%)
                "soil_ph": 6.8,
                "nitrogen": 45.0,
                "phosphorus": 30.0,
                "potassium": 40.0,
            }

    @classmethod
    async def run_pipeline(
        cls,
        session: AsyncSession,
        user: AuthUser,
        options: Optional[DemoRunRequest] = None,
    ) -> DemoRunResult:
        """
        Executes the complete deterministic FarmOps AI demo workflow.
        """
        opts = options or DemoRunRequest()
        run_id = f"demo-{uuid.uuid4().hex[:8]}"
        log: List[str] = []
        audit_ids: List[str] = []
        alert_ids: List[str] = []

        logger.info(f"=== Starting Demo Pipeline [{run_id}] | Scenario: {opts.scenario} ===")
        log.append(f"Starting Demo Pipeline [{run_id}] for scenario '{opts.scenario}'")

        try:
            # -------------------------------------------------------------
            # STAGE 1: Infrastructure Seeding / Resolution
            # -------------------------------------------------------------
            farm, zone, device = await seed_or_get_demo_infrastructure(
                session=session,
                owner_id=user.id,
                farm_name=opts.farm_name or "Demo Autonomous Farm",
                zone_name=opts.zone_name or "Demo Sector Alpha",
                device_name=opts.device_name or "Demo Moisture Node 01",
            )
            log.append(f"[Stage 1] Resolved infrastructure: Farm '{farm.name}' ({farm.id}), Zone '{zone.name}' ({zone.id}), Device '{device.device_type}' ({device.id})")

            # -------------------------------------------------------------
            # STAGE 2: Telemetry Ingestion Pipeline
            # -------------------------------------------------------------
            measurements = cls._get_scenario_telemetry(opts.scenario)
            if opts.telemetry_override:
                measurements.update(opts.telemetry_override)

            # Determine sequence number for device idempotency
            last_seq_res = await session.execute(
                select(SensorEvent.sequence)
                .where(SensorEvent.device_id == device.id)
                .order_by(desc(SensorEvent.sequence))
                .limit(1)
            )
            last_seq = last_seq_res.scalar_one_or_none() or 0
            seq_num = last_seq + 1

            telemetry_payload = TelemetryEventCreate(
                device_id=device.id,
                event_timestamp=datetime.now(timezone.utc),
                sequence=seq_num,
                measurements=measurements,
            )

            telemetry_resp = await TelemetryService.ingest_event(
                session=session,
                payload=telemetry_payload,
                user=user,
                source="demo_runner",
            )
            log.append(f"[Stage 2] Ingested telemetry event {telemetry_resp.id} (seq {seq_num}) with measurements: {measurements}")

            # -------------------------------------------------------------
            # STAGE 3: Deterministic Agronomic Risk Detection
            # -------------------------------------------------------------
            detected_risks = await RiskDetectionService.evaluate_zone(
                session=session,
                farm_id=farm.id,
                zone_id=zone.id,
                actor_id=user.id,
            )
            if not detected_risks:
                # Fallback evaluate farm if zone returned empty
                detected_risks = await RiskDetectionService.evaluate_farm(
                    session=session,
                    farm_id=farm.id,
                    actor_id=user.id,
                )

            if not detected_risks:
                raise RuntimeError("Risk Detection Engine did not produce any risk assessments for critical telemetry.")

            # Select target risk matching scenario
            target_risk = None
            if opts.scenario == "pest_disease":
                target_risk = next((r for r in detected_risks if r.risk_type == "pest_disease"), detected_risks[0])
            elif opts.scenario == "nutrient_deficiency":
                target_risk = next((r for r in detected_risks if r.risk_type == "nutrient_deficiency"), detected_risks[0])
            else:
                target_risk = next((r for r in detected_risks if r.risk_type == "water_stress"), detected_risks[0])

            log.append(f"[Stage 3] Detected {len(detected_risks)} risk(s). Target Risk: {target_risk.risk_type.upper()} ({target_risk.id}) | Severity: {target_risk.severity.upper()} | Score: {target_risk.score:.2f}")

            # -------------------------------------------------------------
            # STAGE 4: Agronomic AI Reasoning & Structured Proposal
            # -------------------------------------------------------------
            context = await AIContextService.build_risk_context(session=session, risk_id=target_risk.id)
            provider = get_ai_provider()

            if opts.scenario == "pest_disease":
                agent = PestDiseaseAgent(provider)
            elif opts.scenario == "nutrient_deficiency":
                agent = NutrientAgent(provider)
            else:
                agent = WaterStressAgent(provider)

            proposal: AIProposal = await agent.evaluate(context)

            # Modify proposal for special safety demo scenarios if requested
            if opts.scenario == "chemical_approval" or opts.force_approval_required:
                proposal.recommendation = "Apply chemical_spray fungicide for immediate mildew suppression."
                proposal.safety_notes = "Requires agronomist sign-off on chemical withholding period."
            elif opts.scenario == "prohibited_actuator":
                proposal.recommendation = "actuator_direct_trigger to turn valve 4 and autonomous_pump_start directly."
                proposal.safety_notes = "Unsafe autonomous physical control override."

            log.append(f"[Stage 4] AI Agent '{proposal.agent_type}' generated proposal: '{proposal.recommendation}' (Confidence: {proposal.confidence:.2f})")

            # -------------------------------------------------------------
            # STAGE 5: Deterministic Safety Guard & Action Plan Creation
            # -------------------------------------------------------------
            safety_eval = SafetyGuard.evaluate_proposal(proposal)
            log.append(f"[Stage 5] Safety Guard Decision: {safety_eval.decision.value} (Approval Required: {safety_eval.approval_required}) | Flags: {safety_eval.safety_flags}")

            plan = await ActionPlanService.create_plan_from_proposal(
                session=session,
                farm_id=farm.id,
                zone_id=zone.id,
                risk_id=target_risk.id,
                proposal=proposal,
                actor_id=user.id,
            )
            log.append(f"[Stage 5] Created ActionPlan {plan.id} | Status: {plan.approval_state.upper()} | Policy: {plan.policy_decision}")

            # -------------------------------------------------------------
            # STAGE 6: Human Approval Workflow (if required)
            # -------------------------------------------------------------
            task: Optional[Task] = None

            if plan.policy_decision == PolicyDecision.REJECT.value:
                log.append("[Stage 6] Action Plan was REJECTED by deterministic safety policy. Halting task creation safely.")
            elif plan.approval_state == "pending_approval":
                log.append("[Stage 6] Plan requires human approval. No task automatically spawned.")
                if opts.auto_approve:
                    log.append("[Stage 6] Performing authorized human approval on ActionPlan...")
                    approved_plan = await ActionPlanService.approve_plan(
                        session=session,
                        plan_id=plan.id,
                        reviewer_id=user.id,
                        review_notes=f"Demo agronomist sign-off for {run_id}",
                    )
                    plan = approved_plan
                    log.append(f"[Stage 6] ActionPlan {plan.id} transitioned to APPROVED.")

            # -------------------------------------------------------------
            # STAGE 7: Task Execution Lifecycle
            # -------------------------------------------------------------
            if plan.approval_state in ["approved", "auto_approved"]:
                # Fetch created task
                task_res = await session.execute(select(Task).where(Task.plan_id == plan.id))
                task = task_res.scalars().first()

                if task:
                    log.append(f"[Stage 7] Field Task {task.id} initialized in '{task.status.upper()}' state.")

                    # Start Task Execution
                    started_task = await TaskService.start_task(
                        session=session,
                        task_id=task.id,
                        actor_id=user.id,
                        notes=f"Started execution for demo run {run_id}",
                    )
                    log.append(f"[Stage 7] Field Task {started_task.id} transitioned to IN_PROGRESS at {started_task.started_at.isoformat()}.")

                    # Complete Task Execution
                    completed_task = await TaskService.complete_task(
                        session=session,
                        task_id=task.id,
                        actor_id=user.id,
                        completion_notes=f"Demo execution completed successfully: Verified sensor feedback.",
                        completed_by=user.id,
                    )
                    task = completed_task
                    log.append(f"[Stage 7] Field Task {completed_task.id} transitioned to COMPLETED at {completed_task.completed_at.isoformat()}.")

            # -------------------------------------------------------------
            # STAGE 8: Reassessment Signal & Audit Verification
            # -------------------------------------------------------------
            audit_res = await session.execute(
                select(AuditEvent)
                .where(AuditEvent.farm_id == farm.id)
                .order_by(desc(AuditEvent.timestamp))
                .limit(20)
            )
            audit_events = list(audit_res.scalars().all())
            audit_ids = [e.id for e in audit_events]

            reassessment_found = any(
                e.event_type == "risk_reassessment_requested" and e.entity_id == target_risk.id
                for e in audit_events
            )
            if reassessment_found:
                log.append(f"[Stage 8] Verified risk_reassessment_requested signal emitted for Risk {target_risk.id}.")

            alert_res = await session.execute(
                select(Alert)
                .where(Alert.farm_id == farm.id)
                .order_by(desc(Alert.created_at))
                .limit(10)
            )
            alert_ids = [a.id for a in alert_res.scalars().all()]
            log.append(f"[Stage 8] Observability complete: {len(audit_ids)} audit events and {len(alert_ids)} alerts tracked.")

            # Refresh plan to get final status
            await session.refresh(plan)

            result = DemoRunResult(
                demo_run_id=run_id,
                scenario=opts.scenario,
                success=True,
                farm_id=farm.id,
                zone_id=zone.id,
                device_id=device.id,
                telemetry_event_id=telemetry_resp.id,
                telemetry_measurements=measurements,
                risk_id=target_risk.id,
                risk_type=target_risk.risk_type,
                risk_severity=target_risk.severity,
                risk_score=target_risk.score,
                ai_proposal=proposal.model_dump(),
                safety_decision=safety_eval.decision.value,
                action_plan_id=plan.id,
                approval_state=plan.approval_state,
                task_id=task.id if task else None,
                task_status=task.status if task else None,
                audit_event_ids=audit_ids,
                alert_ids=alert_ids,
                reassessment_requested=reassessment_found,
                execution_log=log,
            )

            logger.info(f"=== Demo Pipeline [{run_id}] Finished Successfully ===")
            return result

        except Exception as exc:
            logger.exception(f"Demo Pipeline [{run_id}] encountered an error: {exc}")
            log.append(f"[ERROR] Pipeline execution halted: {str(exc)}")
            return DemoRunResult(
                demo_run_id=run_id,
                scenario=opts.scenario,
                success=False,
                farm_id=locals().get("farm", None).id if "farm" in locals() and locals().get("farm") else "unknown",
                zone_id=locals().get("zone", None).id if "zone" in locals() and locals().get("zone") else "unknown",
                device_id=locals().get("device", None).id if "device" in locals() and locals().get("device") else "unknown",
                telemetry_event_id=locals().get("telemetry_resp", None).id if "telemetry_resp" in locals() and locals().get("telemetry_resp") else "none",
                telemetry_measurements=measurements if "measurements" in locals() else {},
                error_message=str(exc),
                execution_log=log,
                audit_event_ids=audit_ids,
                alert_ids=alert_ids,
            )
