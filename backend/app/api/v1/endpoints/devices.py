"""
Direct Device Resource Endpoints (/api/v1/devices)
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
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/devices", tags=["Devices & Edge Gateways"])


@router.post("/{farm_id}", response_model=APIResponse[DeviceResponse], status_code=status.HTTP_201_CREATED)
async def register_device_alias(
    farm_id: str,
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Registers a hardware device / sensor node to a farm (alias route)."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner", "manager"])
    device = await DeviceService.create_device(db, farm_id=farm_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="register_device",
        entity_type="device",
        farm_id=farm_id,
        entity_id=device.id,
        actor_id=user.id,
        after_state={"device_type": device.device_type, "zone_id": device.zone_id, "is_demo": payload.is_demo},
        source="user",
    )
    return APIResponse(
        success=True,
        data=DeviceResponse.from_orm_device(device),
        message="Device registered successfully",
    )


@router.get("/{device_id}", response_model=APIResponse[DeviceResponse])
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Retrieves device details. Verifies caller has access to the owning farm.
    Never leaks credentials in response.
    """
    device = await verify_device_access(device_id=device_id, db=db, user=user)
    return APIResponse(success=True, data=DeviceResponse.from_orm_device(device))


@router.patch("/{device_id}", response_model=APIResponse[DeviceResponse])
async def update_device(
    device_id: str,
    payload: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Partially updates a device configuration (e.g. zone attachment, calibration, enabled status).
    Requires owner or manager role on the owning farm.
    """
    device = await verify_device_access(device_id=device_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=device.farm_id,
        user=user,
        allowed_roles=["owner", "manager"],
    )
    updated = await DeviceService.update_device(db, device_id=device_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="update_device",
        entity_type="device",
        farm_id=device.farm_id,
        entity_id=device.id,
        actor_id=user.id,
        after_state=payload.model_dump(exclude_unset=True),
        source="user",
    )
    return APIResponse(
        success=True,
        data=DeviceResponse.from_orm_device(updated),
        message="Device updated successfully",
    )


@router.get("/farm/{farm_id}", response_model=APIResponse[List[DeviceResponse]])
async def list_farm_devices_alias(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Alias for listing devices within a farm."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    devices = await DeviceService.get_devices(db, farm_id=farm_id, zone_id=zone_id)
    return APIResponse(
        success=True,
        data=[DeviceResponse.from_orm_device(d) for d in devices],
    )
