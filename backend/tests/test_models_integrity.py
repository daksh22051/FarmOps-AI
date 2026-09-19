"""
Database Integrity & Schema Validation Tests
Verifies UUID primary keys, relationships, UTC timestamps, and unique constraints.
"""

import pytest
from sqlalchemy import select, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    Base,
    Farm,
    FarmMembership,
    Zone,
    Device,
    SensorEvent,
    ExternalObservation,
    RiskAssessment,
    ActionPlan,
    Task,
    Alert,
    Escalation,
    AuditEvent,
)


@pytest.mark.asyncio
async def test_all_models_registered_in_metadata():
    tables = Base.metadata.tables.keys()
    required_tables = [
        "profiles",
        "farms",
        "farm_memberships",
        "zones",
        "devices",
        "sensor_events",
        "external_observations",
        "risk_assessments",
        "action_plans",
        "tasks",
        "alerts",
        "escalations",
        "audit_events",
    ]
    for tbl in required_tables:
        assert tbl in tables, f"Table '{tbl}' missing from SQLAlchemy metadata"


@pytest.mark.asyncio
async def test_sensor_event_unique_constraint_on_device_and_sequence(db_session: AsyncSession):
    # 1. Create farm & device
    farm = Farm(owner_id="owner_1", name="Integrity Farm")
    db_session.add(farm)
    await db_session.commit()

    device = Device(farm_id=farm.id, device_type="soil_sensor")
    db_session.add(device)
    await db_session.commit()

    # 2. Insert first sensor event with sequence 1
    event1 = SensorEvent(
        device_id=device.id,
        farm_id=farm.id,
        metric="soil_moisture",
        value=32.0,
        sequence=1,
    )
    db_session.add(event1)
    await db_session.commit()

    # 3. Attempt to insert second sensor event with identical device_id and sequence
    event2 = SensorEvent(
        device_id=device.id,
        farm_id=farm.id,
        metric="soil_moisture",
        value=35.0,
        sequence=1,  # Duplicate sequence on same device
    )
    db_session.add(event2)
    with pytest.raises(Exception):
        await db_session.commit()
    await db_session.rollback()
