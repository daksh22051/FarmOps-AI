"""
Sensor Event Telemetry Ingestion and Time-Series Query Endpoints with Farm-Scoped Authorization
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    get_optional_current_user,
    AuthUser,
    check_farm_access,
)
from app.services.sensor_event_service import SensorEventService
from app.services.telemetry_service import TelemetryService
from app.schemas.sensor_event import (
    SensorEventIngest,
    SensorEventBatchIngest,
    SensorEventResponse,
    SensorEventFilter,
)
from app.schemas.telemetry import (
    TelemetryEventCreate,
    TelemetryEventResponse,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/telemetry", tags=["Sensor Events & Telemetry Ingestion"])


@router.post(
    "/events",
    response_model=APIResponse[TelemetryEventResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Ingest Telemetry Event",
    description=(
        "Ingests a single telemetry event from an edge sensor or gateway. "
        "Validates and normalizes measurement readings, verifies authoritative device-farm-zone hierarchy, "
        "enforces farm-scoped authorization, deduplicates by (device_id, sequence), "
        "and updates the device's last-seen timestamp."
    ),
)
async def ingest_telemetry_event(
    payload: TelemetryEventCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Ingests and normalizes an edge telemetry event with strict validation and idempotency.
    """
    result = await TelemetryService.ingest_event(db, payload=payload, user=user)
    return APIResponse(
        success=True,
        data=result,
        message="Telemetry event ingested successfully" if not result.duplicate else "Duplicate event acknowledged",
    )


@router.post("/{farm_id}/events", response_model=APIResponse[SensorEventResponse], status_code=status.HTTP_201_CREATED)
async def ingest_sensor_event(
    farm_id: str,
    payload: SensorEventIngest,
    db: AsyncSession = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_current_user),
):
    """
    Ingests a single sensor telemetry event with sequence deduplication guarantees.
    Validates farm access when authenticated user token is provided.
    """
    if user:
        await check_farm_access(db, farm_id=farm_id, user=user)

    event = await SensorEventService.ingest_event(db, farm_id=farm_id, payload=payload)
    return APIResponse(
        success=True,
        data=SensorEventResponse.model_validate(event),
        message="Sensor event ingested successfully",
    )


@router.post("/{farm_id}/events/batch", response_model=APIResponse[List[SensorEventResponse]], status_code=status.HTTP_201_CREATED)
async def ingest_sensor_events_batch(
    farm_id: str,
    payload: SensorEventBatchIngest,
    db: AsyncSession = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_current_user),
):
    """
    Ingests a batch of sensor telemetry events from edge gateways.
    Validates farm access when authenticated user token is provided.
    """
    if user:
        await check_farm_access(db, farm_id=farm_id, user=user)

    events = await SensorEventService.ingest_batch(db, farm_id=farm_id, events=payload.events)
    return APIResponse(
        success=True,
        data=[SensorEventResponse.model_validate(e) for e in events],
        message=f"Successfully ingested batch of {len(events)} events",
    )


@router.get("/{farm_id}/events", response_model=APIResponse[List[SensorEventResponse]])
async def query_sensor_events(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    metric: Optional[str] = Query(None, description="Filter by metric (e.g. soil_moisture)"),
    start_time: Optional[datetime] = Query(None, description="Start time UTC"),
    end_time: Optional[datetime] = Query(None, description="End time UTC"),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Queries time-series sensor events for a farm.
    Enforces strict farm-scoped authorization to protect cross-farm telemetry data.
    """
    await check_farm_access(db, farm_id=farm_id, user=user)

    filter_params = SensorEventFilter(
        farm_id=farm_id,
        zone_id=zone_id,
        device_id=device_id,
        metric=metric,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )
    events = await SensorEventService.query_events(db, filter_params=filter_params)
    return APIResponse(success=True, data=[SensorEventResponse.model_validate(e) for e in events])
