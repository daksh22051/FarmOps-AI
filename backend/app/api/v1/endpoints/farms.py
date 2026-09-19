"""
Farm, Zone, and FarmMembership Endpoints
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
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
    farms = await FarmService.get_farms(db, user_id=user.id)
    return APIResponse(success=True, data=[FarmResponse.model_validate(f) for f in farms])


@router.get("/{farm_id}", response_model=APIResponse[FarmResponse])
async def get_farm(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    farm = await FarmService.get_farm(db, farm_id=farm_id)
    return APIResponse(success=True, data=FarmResponse.model_validate(farm))


@router.put("/{farm_id}", response_model=APIResponse[FarmResponse])
async def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
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
    zones = await FarmService.get_zones(db, farm_id=farm_id)
    return APIResponse(success=True, data=[ZoneResponse.model_validate(z) for z in zones])


# --- MEMBERSHIPS ---
@router.post("/{farm_id}/members", response_model=APIResponse[FarmMembershipResponse], status_code=status.HTTP_201_CREATED)
async def add_membership(
    farm_id: str,
    payload: FarmMembershipCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    membership = await FarmService.add_membership(db, farm_id=farm_id, data=payload)
    return APIResponse(success=True, data=FarmMembershipResponse.model_validate(membership), message="Membership granted")


@router.get("/{farm_id}/members", response_model=APIResponse[List[FarmMembershipResponse]])
async def list_memberships(
    farm_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    memberships = await FarmService.get_memberships(db, farm_id=farm_id)
    return APIResponse(success=True, data=[FarmMembershipResponse.model_validate(m) for m in memberships])
