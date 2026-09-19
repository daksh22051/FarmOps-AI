"""
Risk Assessment Service
"""

from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.risk import RiskAssessment
from app.core.exceptions import EntityNotFoundException


class RiskService:
    @staticmethod
    async def get_risks(
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[RiskAssessment]:
        query = select(RiskAssessment).where(RiskAssessment.farm_id == farm_id)
        if zone_id:
            query = query.where(RiskAssessment.zone_id == zone_id)
        if severity:
            query = query.where(RiskAssessment.severity == severity)
        if status:
            query = query.where(RiskAssessment.status == status)

        query = query.order_by(desc(RiskAssessment.created_at)).limit(limit)
        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def get_risk(session: AsyncSession, risk_id: str) -> RiskAssessment:
        query = select(RiskAssessment).where(RiskAssessment.id == risk_id)
        res = await session.execute(query)
        risk = res.scalar_one_or_none()
        if not risk:
            raise EntityNotFoundException("RiskAssessment", risk_id)
        return risk
