"""
Audit Event Inspection Endpoints with Authorization and Scoping

Also serves the PRD's activity-stream surfaces:
  * GET /timeline  - paginated chronological activity for an authorized farm
  * GET /changes   - lightweight polling feed for near-real-time UI updates
"""

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    get_current_user,
    AuthUser,
    check_farm_access,
    get_accessible_farm_ids,
)
from app.services.audit_service import AuditService
from app.schemas.audit import AuditEventResponse
from app.schemas.common import APIResponse

router = APIRouter(tags=["Audit & Observability"])


async def _scope(
    db: AsyncSession, farm_id: Optional[str], user: AuthUser
) -> Optional[List[str]]:
    """Resolve the tenant boundary for a request that may or may not name a farm."""
    if farm_id:
        await check_farm_access(db, farm_id=farm_id, user=user)
        return None
    return await get_accessible_farm_ids(db, user)


@router.get("/audit", response_model=APIResponse[List[AuditEventResponse]])
@router.get("/audit/events", response_model=APIResponse[List[AuditEventResponse]])
async def get_audit_events(
    farm_id: Optional[str] = Query(None, description="Filter by farm ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Retrieves audit events for compliance, security, and traceability.

    With `farm_id` the caller's access to that farm is verified. Without it the
    feed is still restricted to farms the caller belongs to, so this endpoint
    never exposes another tenant's history.
    """
    allowed = await _scope(db, farm_id, user)
    events = await AuditService.get_events(
        db, farm_id=farm_id, limit=limit, offset=offset, allowed_farm_ids=allowed
    )
    return APIResponse(success=True, data=[AuditEventResponse.model_validate(e) for e in events])


@router.get("/timeline", response_model=APIResponse[List[AuditEventResponse]])
async def get_timeline(
    farm_id: Optional[str] = Query(None, description="Farm to build the timeline for"),
    event_type: Optional[str] = Query(None, description="Comma-separated event types to include"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Paginated chronological activity stream for an authorized farm."""
    allowed = await _scope(db, farm_id, user)
    types = [t.strip() for t in event_type.split(",") if t.strip()] if event_type else None
    events = await AuditService.get_events(
        db,
        farm_id=farm_id,
        limit=limit,
        offset=offset,
        allowed_farm_ids=allowed,
        event_types=types,
    )
    total = await AuditService.count_events(db, farm_id=farm_id, allowed_farm_ids=allowed)
    return APIResponse(
        success=True,
        data=[AuditEventResponse.model_validate(e) for e in events],
        message=f"Retrieved {len(events)} timeline entries.",
        meta={"total": total, "limit": limit, "offset": offset, "has_more": offset + len(events) < total},
    )


@router.get("/changes", response_model=APIResponse[List[dict]])
async def get_changes(
    since: Optional[datetime] = Query(None, description="ISO-8601 UTC cursor; returns events strictly after it"),
    farm_id: Optional[str] = Query(None, description="Restrict to one farm"),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """
    Polling feed of recent changes, for clients that want near-real-time updates
    without a socket.

    Returns the PRD's realtime envelope. Consumers must tolerate duplicate and
    out-of-order events: re-polling with the same cursor is safe and intentional.
    """
    allowed = await _scope(db, farm_id, user)
    if since is not None and since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)

    events = await AuditService.get_events(
        db, farm_id=farm_id, limit=limit, offset=0, allowed_farm_ids=allowed, since=since
    )
    # Oldest-first so a client can advance its cursor to the last item it processed.
    events = list(reversed(events))
    now = datetime.now(timezone.utc)
    envelope = [
        {
            "eventId": e.id,
            "eventType": e.event_type,
            "farmId": e.farm_id,
            "entityType": e.entity_type,
            "entityId": e.entity_id,
            "occurredAt": (e.timestamp.replace(tzinfo=timezone.utc) if e.timestamp.tzinfo is None else e.timestamp).isoformat(),
            "source": e.source,
            "correlationId": e.correlation_id,
        }
        for e in events
    ]
    next_cursor = envelope[-1]["occurredAt"] if envelope else (since.isoformat() if since else now.isoformat())
    return APIResponse(
        success=True,
        data=envelope,
        message=f"{len(envelope)} change(s) since cursor.",
        meta={"next_cursor": next_cursor, "server_time": now.isoformat(), "has_more": len(envelope) == limit},
    )
