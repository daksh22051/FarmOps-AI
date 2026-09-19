"""
Farm, Zone, and FarmMembership Endpoints with Farm-Scoped Authorization
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_zone_access,
)
from app.services.farm_service import FarmService
from app.services.audit_service import AuditService
from app.schemas.farm import (
    FarmCreate,
    FarmUpdate,
    FarmResponse,
    FarmMembershipCreate,
    FarmMembershipResponse,
    ZoneCreate,
    ZoneResponse,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/farms", tags=["Farms, Zones & Memberships"])


@router.post("", response_model=APIResponse[FarmResponse], status_code=status.HTTP_201_CREATED)
async def create_farm(
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Creates a new farm with the authenticated user as the owner."""
    farm = await FarmService.create_farm(db, owner_id=user.id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="create_farm",
        entity_type="farm",
        farm_id=farm.id,
        entity_id=farm.id,
        actor_id=user.id,
        after_state={"name": farm.name},
        source="user",
    )
    return APIResponse(success=True, data=FarmResponse.model_validate(farm), message="Farm created successfully")


@router.get("", response_model=APIResponse[List[FarmResponse]])
async def list_farms(
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists all farms the authenticated user owns or is a member of (or all if ADMIN)."""
    filter_user_id = None if user.is_admin else user.id
    farms = await FarmService.get_farms(db, user_id=filter_user_id)
    return APIResponse(success=True, data=[FarmResponse.model_validate(f) for f in farms])


@router.get("/{farm_id}", response_model=APIResponse[FarmResponse])
async def get_farm(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves farm details, strictly checking farm membership."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    farm = await FarmService.get_farm(db, farm_id=farm_id)
    return APIResponse(success=True, data=FarmResponse.model_validate(farm))


@router.put("/{farm_id}", response_model=APIResponse[FarmResponse])
async def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Updates farm settings. Requires owner or manager role."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner", "manager"])
    farm = await FarmService.update_farm(db, farm_id=farm_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="update_farm",
        entity_type="farm",
        farm_id=farm.id,
        entity_id=farm.id,
        actor_id=user.id,
        source="user",
    )
    return APIResponse(success=True, data=FarmResponse.model_validate(farm), message="Farm updated successfully")


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


# --- ZONES ---
@router.post("/{farm_id}/zones", response_model=APIResponse[ZoneResponse], status_code=status.HTTP_201_CREATED)
async def create_zone(
    farm_id: str,
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Creates a zone within a farm. Requires owner or manager role."""
    await check_farm_access(db, farm_id=farm_id, user=user, allowed_roles=["owner", "manager"])
    zone = await FarmService.create_zone(db, farm_id=farm_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="create_zone",
        entity_type="zone",
        farm_id=farm_id,
        entity_id=zone.id,
        actor_id=user.id,
        after_state={"name": zone.name},
        source="user",
    )
    return APIResponse(success=True, data=ZoneResponse.model_validate(zone), message="Zone created successfully")


@router.get("/{farm_id}/zones", response_model=APIResponse[List[ZoneResponse]])
async def list_zones(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists zones in a farm. Verifies user has access to this farm."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    zones = await FarmService.get_zones(db, farm_id=farm_id)
    return APIResponse(success=True, data=[ZoneResponse.model_validate(z) for z in zones])


@router.get("/zones/{zone_id}", response_model=APIResponse[ZoneResponse])
async def get_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieves single zone. Verifies user has access to owning farm."""
    zone = await verify_zone_access(zone_id=zone_id, db=db, user=user)
    return APIResponse(success=True, data=ZoneResponse.model_validate(zone))


# --- MEMBERSHIPS ---
@router.post("/{farm_id}/members", response_model=APIResponse[FarmMembershipResponse], status_code=status.HTTP_201_CREATED)
async def add_membership(
    farm_id: str,
    payload: FarmMembershipCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Adds a member to the farm. Restricted to owner or manager."""
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
    """Lists members of a farm. Verifies caller has access to the farm."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    memberships = await FarmService.get_memberships(db, farm_id=farm_id)
    return APIResponse(success=True, data=[FarmMembershipResponse.model_validate(m) for m in memberships])
