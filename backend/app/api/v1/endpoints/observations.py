"""
External Observation Ingestion & Query Endpoints
REST endpoints for weather, satellite, drone, and market observations with farm-scoped RBAC.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
from app.services.external_observation_service import ExternalObservationService
from app.schemas.observation import (
    ExternalObservationCreate,
    ExternalObservationResponse,
    ObservationListResponse,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/observations", tags=["External Observations & Environmental Data"])


@router.post(
    "",
    response_model=APIResponse[ExternalObservationResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Ingest External Observation",
    description=(
        "Ingests an external environmental or context observation (weather forecast, satellite NDVI, "
        "soil survey, market price). Enforces farm authorization, cross-farm zone verification, "
        "deduplication on (farm_id, source, source_reference, observed_at), and audit logging."
    ),
)
async def create_external_observation(
    payload: ExternalObservationCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Creates an external observation record for an authorized farm.
    """
    result = await ExternalObservationService.create_observation(db, data=payload, user=user)
    msg = "Observation ingested successfully" if not result.duplicate else "Duplicate observation acknowledged"
    return APIResponse(success=True, data=result, message=msg)


@router.get(
    "/farm/{farm_id}",
    response_model=APIResponse[ObservationListResponse],
    summary="List Farm External Observations",
    description="Retrieves paginated observations for an authorized farm with optional filters for source, type, and zone.",
)
async def list_farm_observations(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone UUID"),
    source: Optional[str] = Query(None, description="Filter by data source (e.g. weather, sentinel_2)"),
    observation_type: Optional[str] = Query(None, description="Filter by observation type (e.g. rainfall_forecast)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lists external observations for an authorized farm.
    """
    result = await ExternalObservationService.get_observations(
        session=db,
        farm_id=farm_id,
        user=user,
        zone_id=zone_id,
        source=source,
        observation_type=observation_type,
        page=page,
        page_size=page_size,
    )
    return APIResponse(success=True, data=result)
