"""
Alert Management Service
"""

from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.alert import Alert
from app.models.audit import AuditEvent
from app.core.exceptions import EntityNotFoundException


class AlertService:
    @staticmethod
    async def create_alert(
        session: AsyncSession,
        farm_id: str,
        message: str,
        severity: str = "warning",
        zone_id: Optional[str] = None,
        risk_id: Optional[str] = None,
        channel: str = "in_app",
        dedupe_key: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Alert:
        """
        Creates an alert if an active alert with the given dedupe_key does not already exist.
        """
        if not dedupe_key:
            dedupe_key = f"{farm_id}:{severity}:{message[:32]}"

        res = await session.execute(
            select(Alert).where(
                Alert.farm_id == farm_id,
                Alert.dedupe_key == dedupe_key,
                Alert.acknowledged_at.is_(None),
            )
        )
        existing = res.scalars().first()
        if existing:
            return existing

        alert = Alert(
            farm_id=farm_id,
            zone_id=zone_id,
            risk_id=risk_id,
            severity=severity,
            channel=channel,
            message=message,
            delivery_status="pending",
            dedupe_key=dedupe_key,
            created_at=datetime.now(timezone.utc),
        )
        session.add(alert)
        if auto_commit:
            await session.commit()
            await session.refresh(alert)
        return alert

    @staticmethod
    async def get_alerts(
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        severity: Optional[str] = None,
        acknowledged: Optional[bool] = None,
        limit: int = 50,
    ) -> List[Alert]:
        query = select(Alert).where(Alert.farm_id == farm_id)
        if zone_id:
            query = query.where(Alert.zone_id == zone_id)
        if severity:
            query = query.where(Alert.severity == severity)
        if acknowledged is True:
            query = query.where(Alert.acknowledged_at.is_not(None))
        elif acknowledged is False:
            query = query.where(Alert.acknowledged_at.is_(None))

        query = query.order_by(desc(Alert.created_at)).limit(limit)
        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def acknowledge_alert(session: AsyncSession, alert_id: str, actor_id: str) -> Alert:
        query = select(Alert).where(Alert.id == alert_id)
        res = await session.execute(query)
        alert = res.scalar_one_or_none()
        if not alert:
            raise EntityNotFoundException("Alert", alert_id)

        alert.acknowledged_at = datetime.now(timezone.utc)
        alert.delivery_status = "delivered"

        # Audit alert acknowledgement
        session.add(
            AuditEvent(
                farm_id=alert.farm_id,
                entity_type="alert",
                entity_id=alert.id,
                actor_id=actor_id,
                event_type="alert_acknowledged",
                source="user",
            )
        )

        await session.commit()
        await session.refresh(alert)
        return alert
