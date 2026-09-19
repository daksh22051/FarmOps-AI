"""
Audit Event Logging Service
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditEvent
from app.core.logging import logger


class AuditService:
    @staticmethod
    async def log_event(
        session: AsyncSession,
        event_type: str,
        entity_type: str,
        farm_id: Optional[str] = None,
        entity_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
        source: str = "system",
        model_version: Optional[str] = None,
        policy_version: Optional[str] = None,
    ) -> AuditEvent:
        event = AuditEvent(
            farm_id=farm_id,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            event_type=event_type,
            before_state=before_state,
            after_state=after_state,
            correlation_id=correlation_id,
            source=source,
            model_version=model_version,
            policy_version=policy_version,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        logger.info(f"Audit event logged: [{event_type}] on [{entity_type}:{entity_id}] by [{actor_id}]")
        return event

    @staticmethod
    async def get_events(
        session: AsyncSession,
        farm_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AuditEvent]:
        query = select(AuditEvent).order_by(desc(AuditEvent.timestamp))
        if farm_id:
            query = query.where(AuditEvent.farm_id == farm_id)
        query = query.limit(limit).offset(offset)
        res = await session.execute(query)
        return list(res.scalars().all())
