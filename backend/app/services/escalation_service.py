"""
Escalation Management Service
"""

from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.escalation import Escalation
from app.models.audit import AuditEvent
from app.schemas.escalation import EscalationCreate, EscalationReviewRequest
from app.core.exceptions import EntityNotFoundException


class EscalationService:
    @staticmethod
    async def create_escalation(session: AsyncSession, data: EscalationCreate) -> Escalation:
        esc = Escalation(
            farm_id=data.farm_id,
            zone_id=data.zone_id,
            risk_id=data.risk_id,
            plan_id=data.plan_id,
            reason=data.reason,
            status="open",
        )
        session.add(esc)
        await session.commit()
        await session.refresh(esc)
        return esc

    @staticmethod
    async def get_escalations(
        session: AsyncSession,
        farm_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        allowed_farm_ids: Optional[List[str]] = None,
    ) -> List[Escalation]:
        """Escalation cases, scoped to the caller's farms.

        ``allowed_farm_ids`` is the tenant boundary used when no single farm is
        named; ``None`` means unrestricted and is only correct for an admin.
        """
        query = select(Escalation)
        if farm_id:
            query = query.where(Escalation.farm_id == farm_id)
        elif allowed_farm_ids is not None:
            if not allowed_farm_ids:
                return []
            query = query.where(Escalation.farm_id.in_(allowed_farm_ids))
        if status:
            query = query.where(Escalation.status == status)
        query = query.order_by(desc(Escalation.created_at)).limit(limit)
        res = await session.execute(query)
        return list(res.scalars().all())

    @staticmethod
    async def review_escalation(
        session: AsyncSession,
        escalation_id: str,
        reviewer_id: str,
        data: EscalationReviewRequest,
    ) -> Escalation:
        query = select(Escalation).where(Escalation.id == escalation_id)
        res = await session.execute(query)
        esc = res.scalar_one_or_none()
        if not esc:
            raise EntityNotFoundException("Escalation", escalation_id)

        esc.assigned_expert_id = data.assigned_expert_id or reviewer_id
        esc.review_notes = data.review_notes
        esc.review_outcome = data.review_outcome
        esc.status = data.status

        session.add(
            AuditEvent(
                farm_id=esc.farm_id,
                entity_type="escalation",
                entity_id=esc.id,
                actor_id=reviewer_id,
                event_type="escalation_reviewed",
                after_state={"outcome": esc.review_outcome, "status": esc.status},
                source="user",
            )
        )

        await session.commit()
        await session.refresh(esc)
        return esc
