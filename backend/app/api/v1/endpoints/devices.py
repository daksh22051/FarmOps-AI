"""
Device Registration & Management Endpoints with Farm-Scoped Authorization
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_device_access,
)
from app.services.device_service import DeviceService
from app.services.audit_service import AuditService
from app.schemas.device import DeviceCreate, DeviceResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/devices", tags=["Devices & Edge Gateways"])


@router.post("/{farm_id}", response_model=APIResponse[DeviceResponse], status_code=status.HTTP_201_CREATED)
async def register_device(
    farm_id: str,
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Registers an IoT device or gateway to a farm. Requires owner or manager role."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner", "manager"])
    device = await DeviceService.create_device(db, farm_id=farm_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="register_device",
        entity_type="device",
        farm_id=farm_id,
        entity_id=device.id,
        actor_id=user.id,
        after_state={"type": device.device_type, "zone_id": device.zone_id},
        source="user",
    )
    return APIResponse(success=True, data=DeviceResponse.model_validate(device), message="Device registered successfully")


@router.get("/farm/{farm_id}", response_model=APIResponse[List[DeviceResponse]])
async def list_devices(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists devices within a farm. Verifies farm access."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    devices = await DeviceService.get_devices(db, farm_id=farm_id, zone_id=zone_id)
    return APIResponse(success=True, data=[DeviceResponse.model_validate(d) for d in devices])


@router.get("/{device_id}", response_model=APIResponse[DeviceResponse])
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves device details. Verifies caller has access to owning farm."""
    device = await verify_device_access(device_id=device_id, db=db, user=user)
    return APIResponse(success=True, data=DeviceResponse.model_validate(device))
