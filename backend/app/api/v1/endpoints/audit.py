"""
Audit Event Inspection Endpoints with Authorization and Scoping
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
)
from app.services.audit_service import AuditService
from app.schemas.audit import AuditEventResponse
from app.schemas.common import APIResponse

router = APIRouter(prefix="/audit", tags=["Audit & Observability"])


@router.get("/events", response_model=APIResponse[List[AuditEventResponse]])
async def get_audit_events(
    farm_id: Optional[str] = Query(None, description="Filter by farm ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Retrieves audit events for compliance, security, and traceability.
    Enforces farm-scoped authorization when farm_id is requested.
    """
    if farm_id:
        await check_farm_access(db, farm_id=farm_id, user=user)

    events = await AuditService.get_events(db, farm_id=farm_id, limit=limit, offset=offset)
    return APIResponse(success=True, data=[AuditEventResponse.model_validate(e) for e in events])
