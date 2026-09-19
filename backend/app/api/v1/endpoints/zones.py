"""
Direct Zone Resource Endpoints (/api/v1/zones)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_zone_access,
)
from app.services.zone_service import ZoneService
from app.services.audit_service import AuditService
from app.schemas.farm import ZoneUpdate, ZoneResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/zones", tags=["Zones"])


@router.get("/{zone_id}", response_model=APIResponse[ZoneResponse])
async def get_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Retrieves a single zone by ID.
    Enforces resource-level authorization by resolving the parent farm.
    """
    zone = await verify_zone_access(zone_id=zone_id, db=db, user=user)
    return APIResponse(success=True, data=ZoneResponse.model_validate(zone))


@router.patch("/{zone_id}", response_model=APIResponse[ZoneResponse])
async def update_zone(
    zone_id: str,
    payload: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Partially updates a zone by ID.
    Requires owner or manager role on the owning farm.
    """
    zone = await verify_zone_access(zone_id=zone_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=zone.farm_id,
        user=user,
        allowed_roles=["owner", "manager"],
    )
    updated = await ZoneService.update_zone(db, zone_id=zone_id, data=payload)
    await AuditService.log_event(
        session=db,
        event_type="update_zone",
        entity_type="zone",
        farm_id=zone.farm_id,
        entity_id=zone.id,
        actor_id=user.id,
        after_state=payload.model_dump(exclude_unset=True),
        source="user",
    )
    return APIResponse(success=True, data=ZoneResponse.model_validate(updated), message="Zone updated successfully")
