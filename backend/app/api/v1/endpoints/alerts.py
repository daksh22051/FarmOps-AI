"""
Operational Alerts Endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, AuthUser
from app.services.alert_service import AlertService
from app.schemas.alert import AlertResponse, AlertAcknowledgeRequest
from app.schemas.common import APIResponse

router = APIRouter(prefix="/alerts", tags=["Alerts & Alarms"])


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
    alert = await AlertService.acknowledge_alert(db, alert_id=alert_id, actor_id=user.id)
    return APIResponse(success=True, data=AlertResponse.model_validate(alert), message="Alert acknowledged")
