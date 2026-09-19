"""
External Observation Ingestion & Query Domain Service
Manages weather, satellite NDVI, and market observation ingestion with deduplication and RBAC.
"""

from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status

from app.models.external_observation import ExternalObservation
from app.models.farm import Farm, Zone
from app.schemas.observation import (
    ExternalObservationCreate,
    ExternalObservationResponse,
    ObservationListResponse,
)
from app.core.security import AuthUser, check_farm_access
from app.core.exceptions import EntityNotFoundException, FarmOpsException
from app.services.audit_service import AuditService
from app.core.logging import logger


class ExternalObservationService:
    @staticmethod
    async def create_observation(
        session: AsyncSession,
        data: ExternalObservationCreate,
        user: AuthUser,
    ) -> ExternalObservationResponse:
        """
        Ingests an external observation for an authorized farm, ensuring cross-farm zone isolation,
        idempotency via (farm_id, source, source_reference, observed_at), and audit logging.
        """
        # 1. Verify Farm exists
        farm_res = await session.execute(select(Farm).where(Farm.id == data.farm_id))
        farm = farm_res.scalars().first()
        if not farm:
            raise EntityNotFoundException("Farm", data.farm_id)

        # 2. Authorize User for the target farm
        await check_farm_access(session, farm_id=data.farm_id, user=user)

        # 3. Verify Zone if provided (ensure zone belongs to the same farm)
        if data.zone_id:
            zone_res = await session.execute(select(Zone).where(Zone.id == data.zone_id))
            zone = zone_res.scalars().first()
            if not zone:
                raise EntityNotFoundException("Zone", data.zone_id)
            if zone.farm_id != data.farm_id:
                raise FarmOpsException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    code="INVALID_ZONE_ASSOCIATION",
                    detail=f"Zone '{data.zone_id}' belongs to another farm and cannot be referenced for farm '{data.farm_id}'.",
                )

        # 4. Deduplication Check on (farm_id, source, source_reference, observed_at)
        observed_ts = data.observed_at
        if observed_ts.tzinfo is None:
            observed_ts = observed_ts.replace(tzinfo=timezone.utc)

        if data.source_reference:
            dup_query = select(ExternalObservation).where(
                ExternalObservation.farm_id == data.farm_id,
                ExternalObservation.source == data.source,
                ExternalObservation.source_reference == data.source_reference,
                ExternalObservation.observed_at == observed_ts,
            )
            dup_res = await session.execute(dup_query)
            existing = dup_res.scalar_one_or_none()

            if existing:
                logger.info(
                    f"Duplicate observation skipped: source={data.source}, ref={data.source_reference}, observed_at={observed_ts}"
                )
                return ExternalObservationResponse(
                    id=existing.id,
                    farm_id=existing.farm_id,
                    zone_id=existing.zone_id,
                    source=existing.source,
                    observation_type=existing.type,
                    observed_at=existing.observed_at,
                    payload=existing.payload,
                    source_reference=existing.source_reference,
                    freshness=existing.freshness,
                    status=existing.status,
                    fetched_at=existing.fetched_at,
                    valid_from=existing.valid_from,
                    valid_until=existing.valid_until,
                    created_at=existing.created_at,
                    duplicate=True,
                )

        now_utc = datetime.now(timezone.utc)

        # 5. Persist External Observation
        observation = ExternalObservation(
            farm_id=data.farm_id,
            zone_id=data.zone_id,
            type=data.observation_type,
            source=data.source,
            source_reference=data.source_reference,
            observed_at=observed_ts,
            payload=data.payload,
            freshness=data.freshness or "fresh",
            status="active",
            fetched_at=now_utc,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
        )
        session.add(observation)
        await session.commit()
        await session.refresh(observation)

        # 6. Audit Event Recording
        await AuditService.log_event(
            session=session,
            farm_id=data.farm_id,
            event_type="ingest_observation",
            entity_type="external_observation",
            entity_id=observation.id,
            actor_id=user.user_id,
            after_state={
                "source": data.source,
                "observation_type": data.observation_type,
                "source_reference": data.source_reference,
            },
        )

        logger.info(f"Ingested external observation id={observation.id} for farm={data.farm_id} from source={data.source}")

        return ExternalObservationResponse(
            id=observation.id,
            farm_id=observation.farm_id,
            zone_id=observation.zone_id,
            source=observation.source,
            observation_type=observation.type,
            observed_at=observation.observed_at,
            payload=observation.payload,
            source_reference=observation.source_reference,
            freshness=observation.freshness,
            status=observation.status,
            fetched_at=observation.fetched_at,
            valid_from=observation.valid_from,
            valid_until=observation.valid_until,
            created_at=observation.created_at,
            duplicate=False,
        )

    @staticmethod
    async def get_observations(
        session: AsyncSession,
        farm_id: str,
        user: AuthUser,
        zone_id: Optional[str] = None,
        source: Optional[str] = None,
        observation_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> ObservationListResponse:
        """Queries observations for a farm with pagination and filters."""
        await check_farm_access(session, farm_id=farm_id, user=user)

        base_query = select(ExternalObservation).where(ExternalObservation.farm_id == farm_id)
        count_query = select(func.count(ExternalObservation.id)).where(ExternalObservation.farm_id == farm_id)

        if zone_id:
            base_query = base_query.where(ExternalObservation.zone_id == zone_id)
            count_query = count_query.where(ExternalObservation.zone_id == zone_id)
        if source:
            base_query = base_query.where(ExternalObservation.source == source)
            count_query = count_query.where(ExternalObservation.source == source)
        if observation_type:
            base_query = base_query.where(ExternalObservation.type == observation_type)
            count_query = count_query.where(ExternalObservation.type == observation_type)

        # Count total
        total_res = await session.execute(count_query)
        total = total_res.scalar() or 0

        # Paginate
        offset = (page - 1) * page_size
        items_query = base_query.order_by(desc(ExternalObservation.observed_at)).offset(offset).limit(page_size)
        items_res = await session.execute(items_query)
        rows = items_res.scalars().all()

        items = [
            ExternalObservationResponse(
                id=r.id,
                farm_id=r.farm_id,
                zone_id=r.zone_id,
                source=r.source,
                observation_type=r.type,
                observed_at=r.observed_at,
                payload=r.payload,
                source_reference=r.source_reference,
                freshness=r.freshness,
                status=r.status,
                fetched_at=r.fetched_at,
                valid_from=r.valid_from,
                valid_until=r.valid_until,
                created_at=r.created_at,
                duplicate=False,
            )
            for r in rows
        ]

        return ObservationListResponse(items=items, total=total, page=page, page_size=page_size)
