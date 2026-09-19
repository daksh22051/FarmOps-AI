"""
AI Context Builder Service
Aggregates and sanitizes multi-modal farm state, sensor telemetry, and external observations
into structured, secret-free context payloads for AI reasoning.
"""

from typing import Dict, Any, Optional, List
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk import RiskAssessment
from app.models.farm import Farm, Zone
from app.models.sensor_event import SensorEvent
from app.models.external_observation import ExternalObservation
from app.core.exceptions import EntityNotFoundException


class AIContextService:
    @staticmethod
    def _sanitize_payload(data: Any) -> Any:
        """
        Recursively strips sensitive keys such as passwords, API keys, and credential references.
        """
        if isinstance(data, dict):
            return {
                k: AIContextService._sanitize_payload(v)
                for k, v in data.items()
                if not any(secret_term in k.lower() for secret_term in ["key", "secret", "password", "token", "credential", "auth"])
            }
        elif isinstance(data, list):
            return [AIContextService._sanitize_payload(item) for item in data]
        return data

    @classmethod
    async def build_risk_context(
        cls,
        session: AsyncSession,
        risk_id: str,
    ) -> Dict[str, Any]:
        """
        Loads and normalizes complete context for an existing RiskAssessment.
        Ensures zero secrets or sensitive keys are exposed to the AI model.
        """
        # 1. Load target RiskAssessment
        risk_query = select(RiskAssessment).where(RiskAssessment.id == risk_id)
        risk_res = await session.execute(risk_query)
        risk = risk_res.scalar_one_or_none()
        if not risk:
            raise EntityNotFoundException("RiskAssessment", risk_id)

        # 2. Load Farm metadata
        farm_query = select(Farm).where(Farm.id == risk.farm_id)
        farm_res = await session.execute(farm_query)
        farm = farm_res.scalar_one_or_none()

        # 3. Load Zone metadata (if associated)
        zone = None
        if risk.zone_id:
            zone_query = select(Zone).where(Zone.id == risk.zone_id)
            zone_res = await session.execute(zone_query)
            zone = zone_res.scalar_one_or_none()

        # 4. Load recent SensorEvent telemetry history (latest 10)
        tel_query = select(SensorEvent).where(SensorEvent.farm_id == risk.farm_id)
        if risk.zone_id:
            tel_query = tel_query.where(SensorEvent.zone_id == risk.zone_id)
        tel_query = tel_query.order_by(desc(SensorEvent.event_at)).limit(10)
        tel_res = await session.execute(tel_query)
        sensor_events = list(tel_res.scalars().all())

        latest_telemetry: Dict[str, Any] = {}
        history_list: List[Dict[str, Any]] = []
        for ev in reversed(sensor_events):
            if ev.measurements:
                latest_telemetry.update(ev.measurements)
            elif ev.metric and ev.metric != "multi":
                latest_telemetry[ev.metric] = ev.value

            history_list.append({
                "event_at": ev.event_at.isoformat() if ev.event_at else None,
                "measurements": cls._sanitize_payload(ev.measurements or {ev.metric: ev.value}),
                "quality": ev.quality,
            })

        # 5. Load active ExternalObservations
        obs_query = select(ExternalObservation).where(
            ExternalObservation.farm_id == risk.farm_id,
            ExternalObservation.status == "active",
        )
        if risk.zone_id:
            obs_query = obs_query.where(
                (ExternalObservation.zone_id == risk.zone_id) | (ExternalObservation.zone_id.is_(None))
            )
        obs_res = await session.execute(obs_query)
        observations = list(obs_res.scalars().all())

        obs_list = [
            {
                "type": obs.type,
                "source": obs.source,
                "observed_at": obs.observed_at.isoformat() if obs.observed_at else None,
                "payload": cls._sanitize_payload(obs.payload),
                "freshness": obs.freshness,
            }
            for obs in observations
        ]

        # 6. Assemble compact structured context
        raw_context = {
            "risk": {
                "id": risk.id,
                "farm_id": risk.farm_id,
                "zone_id": risk.zone_id,
                "risk_type": risk.risk_type,
                "severity": risk.severity,
                "score": risk.score,
                "confidence": risk.confidence,
                "evidence": risk.evidence,
                "missing_information": risk.missing_information,
                "created_at": risk.created_at.isoformat() if risk.created_at else None,
            },
            "farm": {
                "id": farm.id,
                "name": farm.name,
                "location": farm.location,
                "timezone": farm.timezone,
                "total_area": farm.total_area,
            } if farm else None,
            "zone": {
                "id": zone.id,
                "name": zone.name,
                "crop": zone.crop,
                "area": zone.area,
            } if zone else None,
            "telemetry": latest_telemetry,
            "telemetry_history": history_list,
            "observations": obs_list,
        }

        return cls._sanitize_payload(raw_context)
