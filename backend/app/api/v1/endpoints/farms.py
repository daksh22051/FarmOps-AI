"""
Farm, Zone, and Device Operational Management Endpoints (/api/v1/farms)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_zone_access,
)
from app.services.farm_service import FarmService
from app.services.zone_service import ZoneService
from app.services.device_service import DeviceService
from app.services.audit_service import AuditService
from app.services.risk_service import RiskService
from app.schemas.farm import (
    FarmCreate,
    FarmUpdate,
    FarmResponse,
    FarmMembershipCreate,
    FarmMembershipResponse,
    ZoneCreate,
    ZoneResponse,
)
from app.schemas.device import DeviceCreate, DeviceResponse
from app.schemas.risk import RiskAssessmentResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/farms", tags=["Farms, Zones & Devices"])


# --- FARM MANAGEMENT ---
@router.post("", response_model=APIResponse[FarmResponse], status_code=status.HTTP_201_CREATED)
async def create_farm(
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Creates a new operational farm with the authenticated caller automatically assigned as owner.
    """
    farm = await FarmService.create_farm(db, owner_id=user.id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="create_farm",
        entity_type="farm",
        farm_id=farm.id,
        entity_id=farm.id,
        actor_id=user.id,
        after_state={"name": farm.name, "location": farm.location, "total_area": farm.total_area},
        source="user",
    )
    return APIResponse(success=True, data=FarmResponse.model_validate(farm), message="Farm created successfully")


@router.get("", response_model=APIResponse[List[FarmResponse]])
async def list_farms(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lists farms accessible to the authenticated user with pagination.
    """
    filter_user_id = None if user.is_admin else user.id
    farms, total = await FarmService.get_farms(db, user_id=filter_user_id, page=page, page_size=page_size)
    return APIResponse(
        success=True,
        data=[FarmResponse.model_validate(f) for f in farms],
        message=f"Retrieved {len(farms)} of {total} farms",
    )


@router.get("/{farm_id}", response_model=APIResponse[FarmResponse])
async def get_farm(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves single farm details with farm membership verification."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    farm = await FarmService.get_farm(db, farm_id=farm_id)
    return APIResponse(success=True, data=FarmResponse.model_validate(farm))


@router.patch("/{farm_id}", response_model=APIResponse[FarmResponse])
async def patch_farm(
    farm_id: str,
    payload: FarmUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Partially updates farm configuration. Requires owner or manager role."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner", "manager"])
    farm = await FarmService.update_farm(db, farm_id=farm_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="update_farm",
        entity_type="farm",
        farm_id=farm.id,
        entity_id=farm.id,
        actor_id=user.id,
        after_state=payload.model_dump(exclude_unset=True),
        source="user",
    )
    return APIResponse(success=True, data=FarmResponse.model_validate(farm), message="Farm updated successfully")


@router.put("/{farm_id}", response_model=APIResponse[FarmResponse])
async def put_farm(
    farm_id: str,
    payload: FarmUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Full update for farm. Requires owner or manager role."""
    return await patch_farm(farm_id=farm_id, payload=payload, db=db, user=user)


@router.delete("/{farm_id}", response_model=APIResponse[bool])
async def delete_farm(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Deletes a farm. Restricted strictly to farm owner or system admin."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner"])
    await FarmService.delete_farm(db, farm_id=farm_id)
    await AuditService.log_event(
        session=db,
        event_type="delete_farm",
        entity_type="farm",
        farm_id=farm_id,
        entity_id=farm_id,
        actor_id=user.id,
        source="user",
    )
    return APIResponse(success=True, data=True, message="Farm deleted successfully")


# --- ZONES UNDER FARM ---
@router.post("/{farm_id}/zones", response_model=APIResponse[ZoneResponse], status_code=status.HTTP_201_CREATED)
async def create_zone(
    farm_id: str,
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Creates a zone within a designated farm. Requires owner or manager role."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner", "manager"])
    zone = await ZoneService.create_zone(db, farm_id=farm_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="create_zone",
        entity_type="zone",
        farm_id=farm_id,
        entity_id=zone.id,
        actor_id=user.id,
        after_state={"name": zone.name, "area": zone.area, "crop": zone.crop},
        source="user",
    )
    return APIResponse(success=True, data=ZoneResponse.model_validate(zone), message="Zone created successfully")


@router.get("/{farm_id}/zones", response_model=APIResponse[List[ZoneResponse]])
async def list_zones(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists zones within a farm. Verifies farm access."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    zones = await ZoneService.get_zones(db, farm_id=farm_id)
    return APIResponse(success=True, data=[ZoneResponse.model_validate(z) for z in zones])


@router.get("/zones/{zone_id}", response_model=APIResponse[ZoneResponse])
async def get_farm_zone_alias(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Alias for direct zone retrieval under /farms prefix."""
    zone = await verify_zone_access(zone_id=zone_id, db=db, user=user)
    return APIResponse(success=True, data=ZoneResponse.model_validate(zone))


# --- DEVICES UNDER FARM ---
@router.post("/{farm_id}/devices", response_model=APIResponse[DeviceResponse], status_code=status.HTTP_201_CREATED)
async def register_device(
    farm_id: str,
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Registers a hardware device / sensor node to a farm. Requires owner or manager role."""
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


@router.get("/{farm_id}/devices", response_model=APIResponse[List[DeviceResponse]])
async def list_devices(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists devices registered to a farm. Verifies farm access."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    devices = await DeviceService.get_devices(db, farm_id=farm_id, zone_id=zone_id)
    return APIResponse(
        success=True,
        data=[DeviceResponse.from_orm_device(d) for d in devices],
    )


# --- MEMBERSHIPS UNDER FARM ---
@router.post("/{farm_id}/members", response_model=APIResponse[FarmMembershipResponse], status_code=status.HTTP_201_CREATED)
async def add_membership(
    farm_id: str,
    payload: FarmMembershipCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Grants farm membership. Requires owner or manager role."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner", "manager"])
    membership = await FarmService.add_membership(db, farm_id=farm_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="add_farm_membership",
        entity_type="farm_membership",
        farm_id=farm_id,
        entity_id=membership.id,
        actor_id=user.id,
        after_state={"target_user_id": payload.user_id, "role": payload.role},
        source="user",
    )
    return APIResponse(success=True, data=FarmMembershipResponse.model_validate(membership), message="Membership granted")


@router.get("/{farm_id}/members", response_model=APIResponse[List[FarmMembershipResponse]])
async def list_memberships(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists memberships for a farm. Verifies caller has access to the farm."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    memberships = await FarmService.get_memberships(db, farm_id=farm_id)
    return APIResponse(success=True, data=[FarmMembershipResponse.model_validate(m) for m in memberships])


# --- RISKS UNDER FARM ---
@router.get("/{farm_id}/risks", response_model=APIResponse[List[RiskAssessmentResponse]])
async def list_farm_risks(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    risk_type: Optional[str] = Query(None, description="Filter by risk type (water_stress, pest_disease, nutrient_deficiency)"),
    severity: Optional[str] = Query(None, description="Filter by severity (low, medium, high, critical)"),
    status: Optional[str] = Query(None, description="Filter by status (open, acknowledged, resolved, dismissed)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Lists risk assessments for a farm with filtering and pagination.
    Verifies user has access to target farm.
    """
    await check_farm_access(db, farm_id=farm_id, user=user)
    risks, total = await RiskService.get_risks_paginated(
        session=db,
        farm_id=farm_id,
        zone_id=zone_id,
        risk_type=risk_type,
        severity=severity,
        status=status,
        page=page,
        page_size=page_size,
    )
    return APIResponse(
        success=True,
        data=[RiskAssessmentResponse.model_validate(r) for r in risks],
        message=f"Retrieved {len(risks)} of {total} risk assessments",
    )

