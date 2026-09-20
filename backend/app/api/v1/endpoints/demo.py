"""
Demo Pipeline Execution Endpoints (/api/v1/demo)
Enables authenticated, deterministic demonstration of the complete FarmOps AI backend workflow.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, AuthUser, check_farm_access
from app.demo.schemas import DemoRunRequest, DemoRunResult, DemoStatusResponse
from app.demo.runner import DemoRunner
from app.schemas.common import APIResponse
from app.services.telemetry_simulation_service import TelemetrySimulationService
from app.core.exceptions import FarmOpsException
from app.config import settings

router = APIRouter(prefix="/demo", tags=["Demo & End-to-End Pipeline"])


@router.post("/run", response_model=APIResponse[DemoRunResult], status_code=status.HTTP_200_OK)
async def run_demo_pipeline(
    payload: DemoRunRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Executes the full deterministic FarmOps AI demo workflow:
    Telemetry Ingestion -> Risk Detection -> AI Reasoning -> Safety Guard ->
    Action Plan -> Approval (if required) -> Task Creation -> Task Execution ->
    Completion -> Risk Reassessment Signal -> Audit/Alerts.
    """
    result = await DemoRunner.run_pipeline(
        session=db,
        user=user,
        options=payload,
    )

    return APIResponse(
        success=result.success,
        data=result,
        message=f"Demo pipeline '{payload.scenario}' completed {'successfully' if result.success else 'with errors'}.",
    )


@router.get("/status", response_model=APIResponse[DemoStatusResponse], status_code=status.HTTP_200_OK)
async def get_demo_status():
    """
    Returns the operational readiness and supported scenario catalog for the demo pipeline.
    """
    return APIResponse(
        success=True,
        data=DemoStatusResponse(),
        message="Demo pipeline is ready.",
    )


# ==============================================================================
# SIMULATOR CONTROLS (PRD: POST /api/v1/demo/simulator/...)
# Protected, demo-only, and refused outside development environments.
# ==============================================================================

def _require_demo_enabled() -> None:
    """Refuse simulator operations unless this deployment allows demo tooling.

    Simulated readings write to the same tables as real telemetry, so these
    controls must never be reachable in production.
    """
    if not settings.DEMO_ENDPOINTS_ENABLED:
        raise FarmOpsException(
            status_code=403,
            detail="Simulator controls are disabled in this environment.",
            code="DEMO_DISABLED",
        )


@router.post("/simulator/emit", response_model=APIResponse[dict])
async def simulator_emit(
    farm_id: str = Query(..., description="Farm to emit simulated readings for"),
    seed_history: bool = Query(False, description="Also backfill a short history for charts"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Emit one round of clearly-labelled simulated readings for a farm's zones.

    Every event is stored with `source="simulator"` so the UI can badge it and
    never present it as a live field measurement.
    """
    _require_demo_enabled()
    await check_farm_access(db, farm_id=farm_id, user=user)

    seeded = 0
    if seed_history:
        seeded = await TelemetrySimulationService.seed_time_series_history_for_farm(db, farm_id=farm_id)
    emitted = await TelemetrySimulationService.simulate_live_stream_for_farm(
        db, farm_id=farm_id, evaluate_risks=True
    )
    return APIResponse(
        success=True,
        data={
            "farm_id": farm_id,
            "events_emitted": emitted,
            "history_events_seeded": seeded,
            "source": "simulator",
            "simulated": True,
        },
        message=f"Emitted {emitted} simulated reading(s). These are demo values, not field measurements.",
    )


@router.get("/simulator/status", response_model=APIResponse[dict])
async def simulator_status():
    """Reports whether simulator controls are available in this environment."""
    return APIResponse(
        success=True,
        data={
            "enabled": settings.DEMO_ENDPOINTS_ENABLED,
            "environment": settings.ENVIRONMENT,
            "label": "All simulator output is labelled source=simulator and is not live data.",
        },
    )
