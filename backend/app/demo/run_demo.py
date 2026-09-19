"""
CLI Demo Runner for FarmOps AI
Executes the end-to-end autonomous pipeline directly from the command line.

Usage:
    python -m app.demo.run_demo [--scenario water_stress] [--no-auto-approve]
"""

import sys
import asyncio
import argparse
import json
from app.core.database import get_session_factory
from app.core.security import AuthUser
from app.demo.schemas import DemoRunRequest
from app.demo.runner import DemoRunner


async def main():
    parser = argparse.ArgumentParser(description="FarmOps AI End-to-End Demo Pipeline Runner")
    parser.add_argument(
        "--scenario",
        default="water_stress",
        choices=["water_stress", "pest_disease", "nutrient_deficiency", "chemical_approval", "prohibited_actuator"],
        help="Demo scenario to run",
    )
    parser.add_argument(
        "--no-auto-approve",
        action="store_true",
        help="Do not automatically approve plans requiring human review",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON result only",
    )
    args = parser.parse_args()

    # Create mock authenticated user for CLI execution
    cli_user = AuthUser(
        id="usr_cli_demo_operator",
        email="operator@farmops.demo",
        role="owner",
        user_metadata={"name": "CLI Demo Operator"},
    )

    request_opts = DemoRunRequest(
        scenario=args.scenario,
        auto_approve=not args.no_auto_approve,
    )

    factory = get_session_factory()
    async with factory() as session:
        result = await DemoRunner.run_pipeline(
            session=session,
            user=cli_user,
            options=request_opts,
        )

    if args.json:
        print(result.model_dump_json(indent=2))
        return

    # Formatted terminal output
    print("\n" + "=" * 70)
    print(f" FARMOPS AI — END-TO-END DEMO EXECUTION [{result.demo_run_id}]")
    print("=" * 70)
    print(f" Scenario         : {result.scenario}")
    print(f" Status           : {'SUCCESS' if result.success else 'FAILED'}")
    print(f" Farm ID          : {result.farm_id}")
    print(f" Zone ID          : {result.zone_id}")
    print(f" Device ID        : {result.device_id}")
    print(f" Telemetry ID     : {result.telemetry_event_id}")
    print(f" Risk Detected    : {result.risk_type} ({result.risk_severity}) -> {result.risk_id}")
    print(f" Safety Decision  : {result.safety_decision}")
    print(f" Action Plan ID   : {result.action_plan_id} (State: {result.approval_state})")
    print(f" Task ID          : {result.task_id} (State: {result.task_status})")
    print(f" Reassessment Req : {result.reassessment_requested}")
    print(f" Audit Events     : {len(result.audit_event_ids)} recorded")
    print(f" Alerts Fired     : {len(result.alert_ids)} tracked")
    print("-" * 70)
    print(" EXECUTION LOG:")
    for line in result.execution_log:
        print(f"  * {line}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
