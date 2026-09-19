"""
Risk Assessment Service
Provides querying, filtering, and retrieval operations for RiskAssessment entities.
"""

from typing import List, Optional, Tuple
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.risk import RiskAssessment
from app.core.exceptions import EntityNotFoundException


class RiskService:
    @staticmethod
    async def get_risks(
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        risk_type: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[RiskAssessment]:
        """
        Retrieves filtered risk assessments for a farm.
        """
        query = select(RiskAssessment).where(RiskAssessment.farm_id == farm_id)
        if zone_id:
            query = query.where(RiskAssessment.zone_id == zone_id)
        if risk_type:
            query = query.where(RiskAssessment.risk_type == risk_type.lower())
        if severity:
            query = query.where(RiskAssessment.severity == severity.lower())
        if status:
            query = query.where(RiskAssessment.status == status.lower())

        if page is not None and page_size is not None:
            calc_offset = (page - 1) * page_size
            query = query.order_by(desc(RiskAssessment.created_at)).offset(calc_offset).limit(page_size)
        else:
            query = query.order_by(desc(RiskAssessment.created_at)).offset(offset).limit(limit)

        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def get_risks_paginated(
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str] = None,
        risk_type: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[RiskAssessment], int]:
        """
        Retrieves paginated risk assessments and total count for a farm.
        """
        base_filters = [RiskAssessment.farm_id == farm_id]
        if zone_id:
            base_filters.append(RiskAssessment.zone_id == zone_id)
        if risk_type:
            base_filters.append(RiskAssessment.risk_type == risk_type.lower())
        if severity:
            base_filters.append(RiskAssessment.severity == severity.lower())
        if status:
            base_filters.append(RiskAssessment.status == status.lower())

        # Count total
        count_query = select(func.count(RiskAssessment.id)).where(*base_filters)
        count_res = await session.execute(count_query)
        total = count_res.scalar() or 0

        # Query items
        offset = (page - 1) * page_size
        items_query = select(RiskAssessment).where(*base_filters).order_by(desc(RiskAssessment.created_at)).offset(offset).limit(page_size)
        items_res = await session.execute(items_query)
        items = list(items_res.scalars().all())

        return items, total

    @staticmethod
    async def get_risk(session: AsyncSession, risk_id: str) -> RiskAssessment:
        query = select(RiskAssessment).where(RiskAssessment.id == risk_id)
        res = await session.execute(query)
        risk = res.scalar_one_or_none()
        if not risk:
            raise EntityNotFoundException("RiskAssessment", risk_id)
        return risk
