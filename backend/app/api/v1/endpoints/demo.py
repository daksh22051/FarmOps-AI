"""
Demo Pipeline Execution Endpoints (/api/v1/demo)
Enables authenticated, deterministic demonstration of the complete FarmOps AI backend workflow.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
from app.demo.schemas import DemoRunRequest, DemoRunResult, DemoStatusResponse
from app.demo.runner import DemoRunner
from app.schemas.common import APIResponse

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
