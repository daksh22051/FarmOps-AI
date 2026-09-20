"""Farm-scoped operational snapshot. Missing measurements are never healthy readings."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import noload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import AuthUser, get_current_user, check_farm_access
from app.models.farm import Zone
from app.models.device import Device
from app.models.sensor_event import SensorEvent
from app.models.risk import RiskAssessment
from app.models.plan import ActionPlan
from app.models.task import Task
from app.models.alert import Alert
from app.schemas.risk import RiskAssessmentResponse
from app.schemas.plan import ActionPlanResponse
from app.schemas.task import TaskResponse
from app.schemas.alert import AlertResponse
from app.schemas.common import APIResponse
from app.config import settings
from app.services.risk_detection_service import (
    RiskDetectionService,
    FRESH_THRESHOLD_MINUTES,
    STALE_THRESHOLD_MINUTES,
    VERY_STALE_THRESHOLD_MINUTES,
)

router = APIRouter(tags=["Dashboard"])


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


@router.get("/dashboard")
async def dashboard_by_query(
    farm_id: str = Query(..., description="Farm to summarise"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Farm overview (PRD: GET /dashboard?farm_id=...)."""
    return await dashboard(farm_id=farm_id, db=db, user=user)


@router.get("/farms/{farm_id}/dashboard")
async def dashboard(farm_id: str, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    await check_farm_access(db, farm_id=farm_id, user=user)
    now = datetime.now(timezone.utc)
    zones = list((await db.scalars(select(Zone).where(Zone.farm_id == farm_id).options(noload("*")).order_by(Zone.name))).all())
    # Windowing keeps one latest valid measurement event per device/metric without
    # letting a noisy sensor evict another zone's last observation.
    ranked = select(SensorEvent.id, func.row_number().over(
        partition_by=(SensorEvent.device_id, SensorEvent.metric),
        order_by=(SensorEvent.event_at.desc(), SensorEvent.received_at.desc()),
    ).label("rank")).where(
        SensorEvent.farm_id == farm_id, SensorEvent.quality == "good",
        SensorEvent.is_duplicate.is_(False), SensorEvent.event_at <= now,
    ).subquery()
    events = list((await db.scalars(select(SensorEvent).join(ranked, SensorEvent.id == ranked.c.id).where(ranked.c.rank == 1))).all())
    risks = list((await db.scalars(select(RiskAssessment).where(
        RiskAssessment.farm_id == farm_id, RiskAssessment.status.in_(["open", "acknowledged"])
    ).options(noload("*")).order_by(RiskAssessment.updated_at.desc()))).all())

    async def count(model, *conditions):
        return await db.scalar(select(func.count()).select_from(model).where(model.farm_id == farm_id, *conditions))

    async def recent(model, schema, *conditions, order=None):
        rows = (await db.scalars(select(model).where(model.farm_id == farm_id, *conditions)
            .options(noload("*")).order_by(order if order is not None else model.created_at.desc()).limit(12))).all()
        return [schema.model_validate(row).model_dump(mode="json") for row in rows]

    def monitoring(scoped):
        # Same freshness ladder the risk engine uses, so a zone is never reported "current"
        # here while its risk evidence calls the very same reading stale.
        last = max((utc(e.event_at) for e in scoped), default=None)
        return {"status": RiskDetectionService.calculate_freshness(last, now),
                "has_data": last is not None,
                "age_minutes": None if last is None else round((now - last).total_seconds() / 60.0, 1),
                "last_reading_at": last.isoformat() if last else None}

    def latest_readings(scoped):
        """Latest measured value per metric, with the provenance the PRD requires.

        A metric that was never reported is simply absent — the UI must render
        "no reading" rather than substituting a plausible-looking number.
        """
        out: dict = {}
        for e in sorted(scoped, key=lambda x: utc(x.event_at) or now):
            measured = e.measurements or {e.metric: e.value}
            for metric, value in measured.items():
                if value is None:
                    continue
                out[metric] = {
                    "metric": metric,
                    "value": value,
                    # An event row carries a single `unit`, and it describes that row's own
                    # `metric`. The other entries of a `measurements` bundle have no unit of
                    # their own, so they report none rather than borrowing a wrong one — a
                    # soil-moisture reading labelled "pH" is a false measurement.
                    "unit": (e.unit or None) if metric == e.metric else None,
                    "event_at": (utc(e.event_at).isoformat() if e.event_at else None),
                    "received_at": (utc(e.received_at).isoformat() if e.received_at else None),
                    "source": e.source,
                    "quality": e.quality,
                    "simulated": e.source in ("simulated", "simulator", "demo"),
                    "freshness": RiskDetectionService.calculate_freshness(utc(e.event_at), now),
                }
        return out

    zone_rows = []
    for zone in zones:
        scoped_events = [e for e in events if e.zone_id == zone.id]
        state = monitoring(scoped_events)
        zone_risks = [r for r in risks if r.zone_id == zone.id or r.zone_id is None]
        # `status` is the zone's own lifecycle (active/fallow/...); telemetry freshness is
        # reported separately so the two can never be confused for one another.
        zone_rows.append({"id": zone.id, "name": zone.name, "crop": zone.crop, "area": zone.area,
                          "area_unit": zone.area_unit, "status": zone.status,
                          "monitoring": state,
                          "telemetry_status": state["status"],
                          "last_reading_at": state["last_reading_at"],
                          "readings": latest_readings(scoped_events),
                          "risk_ids": [r.id for r in zone_risks]})
    key = settings.GEMINI_API_KEY
    counts_row = (await db.execute(select(
        select(func.count()).select_from(ActionPlan).where(
            ActionPlan.farm_id == farm_id, ActionPlan.approval_state == "pending_approval"
        ).scalar_subquery(),
        select(func.count()).select_from(Task).where(
            Task.farm_id == farm_id, Task.status.in_(["pending", "assigned", "in_progress", "blocked"])
        ).scalar_subquery(),
        select(func.count()).select_from(Alert).where(
            Alert.farm_id == farm_id, Alert.acknowledged_at.is_(None)
        ).scalar_subquery(),
        select(func.count()).select_from(Device).where(
            Device.farm_id == farm_id, Device.enabled.is_(True)
        ).scalar_subquery(),
    ))).first()
    pending_plans_count, open_tasks_count, alerts_count, devices_count = (
        counts_row if counts_row else (0, 0, 0, 0)
    )

    return APIResponse(success=True, data={
        "farm_id": farm_id, "generated_at": now.isoformat(), "monitoring": monitoring(events),
        "freshness_thresholds_minutes": {
            "fresh": FRESH_THRESHOLD_MINUTES,
            "stale": STALE_THRESHOLD_MINUTES,
            "very_stale": VERY_STALE_THRESHOLD_MINUTES,
        },
        "zones": zone_rows,
        "ai_available": bool(key and key != "your-gemini-api-key" and not key.startswith("mock_")),
        "risks": [RiskAssessmentResponse.model_validate(r).model_dump(mode="json") for r in risks],
        "plans": await recent(ActionPlan, ActionPlanResponse, ActionPlan.approval_state.in_(["draft", "pending_approval", "approved", "executing"])),
        "tasks": await recent(Task, TaskResponse, Task.status.in_(["pending", "assigned", "in_progress", "blocked"]), order=Task.due_until.asc().nullslast()),
        "completed_tasks": await recent(Task, TaskResponse, Task.status == "completed", order=Task.completed_at.desc()),
        "alerts": await recent(Alert, AlertResponse, Alert.acknowledged_at.is_(None)),
        "counts": {
            "risks": len(risks),
            "pending_plans": pending_plans_count or 0,
            "open_tasks": open_tasks_count or 0,
            "alerts": alerts_count or 0,
            "devices": devices_count or 0,
        },
    })
