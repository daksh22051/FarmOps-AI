"""
Operational Alerts Endpoints with Farm-Scoped Authorization
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    verify_alert_access,
)
from app.services.alert_service import AlertService
from app.schemas.alert import AlertResponse, AlertAcknowledgeRequest
from app.schemas.common import APIResponse

router = APIRouter(prefix="/alerts", tags=["Alerts & Alarms"])


@router.get("", response_model=APIResponse[List[AlertResponse]])
async def list_alerts_by_query(
    farm_id: str = Query(..., description="Farm to list alerts for"),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    severity: Optional[str] = Query(None, description="Filter: info, warning, critical"),
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledgment state"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Alert feed for a farm (PRD: GET /alerts?farm_id=...)."""
    return await list_alerts(
        farm_id=farm_id, zone_id=zone_id, severity=severity,
        acknowledged=acknowledged, limit=limit, db=db, user=user,
    )


@router.get("/{farm_id}", response_model=APIResponse[List[AlertResponse]])
async def list_alerts(
    farm_id: str,
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    severity: Optional[str] = Query(None, description="Filter: info, warning, critical"),
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledgment state"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Lists alerts for a farm. Verifies caller has access to the farm."""
    await check_farm_access(db, farm_id=farm_id, user=user)
    alerts = await AlertService.get_alerts(
        db, farm_id=farm_id, zone_id=zone_id, severity=severity, acknowledged=acknowledged, limit=limit
    )
    return APIResponse(success=True, data=[AlertResponse.model_validate(a) for a in alerts])


@router.post("/{alert_id}/acknowledge", response_model=APIResponse[AlertResponse])
async def acknowledge_alert(
    alert_id: str,
    payload: AlertAcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Acknowledges an active operational alert.
    Requires owner, manager, operator, or agronomist role on the owning farm.
    """
    alert = await verify_alert_access(alert_id=alert_id, db=db, user=user)
    await check_farm_access(
        db,
        farm_id=alert.farm_id,
        user=user,
        allowed_roles=["owner", "manager", "operator", "agronomist"],
    )
    acknowledged = await AlertService.acknowledge_alert(db, alert_id=alert_id, actor_id=user.id)
    return APIResponse(success=True, data=AlertResponse.model_validate(acknowledged), message="Alert acknowledged")
