"""
FarmOps AI - Seed Working Real-World Scenario
Seeds Zone A (Wheat - Normal), Zone B (Cotton - Water Stress), Zone C (Wheat - Normal)
with fresh telemetry, deterministic risk detection, AI action plan, alert, and tasks.
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete
from app.core.database import get_session_factory
from app.models.farm import Farm, Zone
from app.models.device import Device
from app.models.sensor_event import SensorEvent
from app.models.risk import RiskAssessment
from app.models.plan import ActionPlan
from app.models.task import Task
from app.models.alert import Alert
from app.services.risk_detection_service import RiskDetectionService
from app.core.security import AuthUser


async def seed_farm_scenario(farm_id: str):
    factory = get_session_factory()
    now = datetime.now(timezone.utc)
    
    async with factory() as session:
        farm = await session.get(Farm, farm_id)
        if not farm:
            print(f"Farm {farm_id} not found.")
            return

        print(f"Seeding farm: {farm.name} ({farm.id})")
        
        # Ensure farm coordinates are in crop_profile for weather
        if not farm.crop_profile:
            farm.crop_profile = {}
        farm.crop_profile["primary_crop"] = "Wheat & Cotton"
        farm.crop_profile["latitude"] = 23.0500
        farm.crop_profile["longitude"] = 72.4800
        farm.crop_profile["city"] = "Shilaj"
        session.add(farm)

        # Get zones
        zones = list((await session.scalars(select(Zone).where(Zone.farm_id == farm_id).order_by(Zone.name))).all())
        if len(zones) < 3:
            print(f"Farm {farm.name} has fewer than 3 zones ({len(zones)}). Creating Zone A, B, C...")
            existing_names = {z.name for z in zones}
            needed = [
                ("Zone A", "Wheat", 1.8),
                ("Zone B", "Cotton", 1.6),
                ("Zone C", "Wheat", 1.8),
            ]
            for name, crop, area in needed:
                if name not in existing_names:
                    z = Zone(
                        farm_id=farm.id,
                        name=name,
                        crop=crop,
                        area=area,
                        area_unit=farm.area_unit or "acres",
                        status="active"
                    )
                    session.add(z)
            await session.commit()
            zones = list((await session.scalars(select(Zone).where(Zone.farm_id == farm_id).order_by(Zone.name))).all())

        zone_a = next((z for z in zones if "A" in z.name or "1" in z.name), zones[0])
        zone_b = next((z for z in zones if "B" in z.name or "2" in z.name), zones[1])
        zone_c = next((z for z in zones if "C" in z.name or "3" in z.name), zones[2])

        # Ensure crops match
        zone_a.crop = "Wheat"
        zone_b.crop = "Cotton"
        zone_c.crop = "Wheat"
        session.add_all([zone_a, zone_b, zone_c])
        await session.commit()

        # Clean existing risks, plans, alerts, tasks for a fresh pristine real-world state
        await session.execute(delete(RiskAssessment).where(RiskAssessment.farm_id == farm.id))
        await session.execute(delete(ActionPlan).where(ActionPlan.farm_id == farm.id))
        await session.execute(delete(Alert).where(Alert.farm_id == farm.id))
        await session.execute(delete(Task).where(Task.farm_id == farm.id))
        await session.commit()

        # Register or get devices for each zone
        devices = {}
        for z in [zone_a, zone_b, zone_c]:
            dev = (await session.scalars(select(Device).where(Device.zone_id == z.id, Device.enabled == True))).first()
            if not dev:
                dev = Device(
                    farm_id=farm.id,
                    zone_id=z.id,
                    device_type="soil_probe",
                    enabled=True,
                    calibration={"source": "field_edge_sensor", "name": f"Telemetry Node - {z.name}"}
                )
                session.add(dev)
                await session.commit()
                await session.refresh(dev)
            devices[z.name] = dev

        # Seed realistic measurements
        telemetry_configs = [
            # Zone A: Wheat - Normal Healthy
            (zone_a, devices[zone_a.name], {
                "soil_moisture": (36.5, "%"),
                "air_temperature": (24.2, "degC"),
                "air_humidity": (58.0, "%"),
                "soil_ph": (6.7, "pH"),
                "nitrogen": (42.0, "mg/kg"),
                "phosphorus": (28.0, "mg/kg"),
                "potassium": (35.0, "mg/kg"),
            }),
            # Zone B: Cotton - Critical Water Stress
            (zone_b, devices[zone_b.name], {
                "soil_moisture": (16.2, "%"),    # CRITICAL: < 20% threshold
                "air_temperature": (34.5, "degC"), # Heat stress: > 32°C
                "air_humidity": (31.0, "%"),      # Low humidity: < 35%
                "soil_ph": (6.8, "pH"),
                "nitrogen": (38.0, "mg/kg"),
                "phosphorus": (24.0, "mg/kg"),
                "potassium": (32.0, "mg/kg"),
            }),
            # Zone C: Wheat - Normal Healthy
            (zone_c, devices[zone_c.name], {
                "soil_moisture": (38.0, "%"),
                "air_temperature": (23.8, "degC"),
                "air_humidity": (60.0, "%"),
                "soil_ph": (6.8, "pH"),
                "nitrogen": (45.0, "mg/kg"),
                "phosphorus": (30.0, "mg/kg"),
                "potassium": (37.0, "mg/kg"),
            }),
        ]

        seq = int(now.timestamp())
        for z, dev, metrics in telemetry_configs:
            # First clean recent events for this device to prevent duplicate key errors
            await session.execute(delete(SensorEvent).where(SensorEvent.device_id == dev.id))
            await session.commit()
            
            for offset_mins in [30, 15, 2]:
                evt_time = now - timedelta(minutes=offset_mins)
                measurements_dict = {}
                for metric_name, (val, unit) in metrics.items():
                    # small natural variance
                    variance = 0.2 if offset_mins != 2 else 0.0
                    actual_val = round(val - variance, 2)
                    measurements_dict[metric_name] = actual_val
                    event = SensorEvent(
                        device_id=dev.id,
                        farm_id=farm.id,
                        zone_id=z.id,
                        metric=metric_name,
                        value=actual_val,
                        unit=unit,
                        measurements=measurements_dict,
                        event_at=evt_time,
                        received_at=evt_time,
                        sequence=seq,
                        quality="good",
                        source="device",
                        is_duplicate=False
                    )
                    seq += 1
                    session.add(event)
        await session.commit()
        print("Telemetry events ingested successfully.")

        detected_risks = await RiskDetectionService.evaluate_farm(session=session, farm_id=farm.id)
        print(f"Risk Detection complete. Generated {len(detected_risks)} risk assessments:")
        for r in detected_risks:
            print(f" - [{r.severity.upper()}] {r.risk_type} in zone {r.zone_id}")

        # Find the Zone B water stress risk
        water_risk = next((r for r in detected_risks if r.risk_type == "water_stress" and r.zone_id == zone_b.id), None)
        if not water_risk and detected_risks:
            water_risk = detected_risks[0]

        # Add Active Alert for Water Stress
        alert = Alert(
            farm_id=farm.id,
            zone_id=zone_b.id,
            risk_id=water_risk.id if water_risk else None,
            severity="critical",
            channel="in_app",
            message="Water Stress Alert: Zone B (Cotton) volumetric soil moisture dropped to 16.2% under 34.5°C heat. Regulated drip irrigation required.",
            delivery_status="delivered",
            dedupe_key=f"alert-ws-{farm.id}-{zone_b.id}-{int(now.timestamp())}",
            created_at=now - timedelta(minutes=10)
        )
        session.add(alert)

        # Add Pending Action Plan
        plan = ActionPlan(
            farm_id=farm.id,
            zone_id=zone_b.id,
            risk_id=water_risk.id if water_risk else None,
            action_type="irrigate",
            action_summary="Initiate 25mm targeted drip irrigation cycle via Line B2 starting 18:30 IST to arrest evapotranspiration loss in cotton parcel.",
            approval_state="pending_approval",
            approval_required=True,
            policy_decision="APPROVAL_REQUIRED",
            priority="high",
            confidence=0.92,
            rationale="Root-zone moisture (16.2%) is below the 25% minimum threshold for cotton boll development stage. Evening irrigation avoids high solar evaporative loss.",
            safety_flags=["Policy: Irrigation above 20mm requires human operator sign-off"],
            evidence={
                "title": "Deficit Drip Irrigation Schedule — Zone B (Cotton)",
                "source": "gemini_agent",
                "objective": "Restore cotton root zone to optimal 28-32% volumetric water content"
            },
            earliest_at=now + timedelta(hours=1),
            latest_at=now + timedelta(hours=6),
            created_at=now - timedelta(minutes=8)
        )
        session.add(plan)

        # Add Open Field Task
        task_open = Task(
            farm_id=farm.id,
            zone_id=zone_b.id,
            status="in_progress",
            notes="Verify drip manifold line pressure (target 1.8 bar) and check emitters 12 through 30 in Cotton Zone B for sediment clogging.",
            evidence={
                "title": "Inspect Zone B Drip Emitters & Subsoil Probe",
                "description": "Verify drip manifold line pressure (target 1.8 bar) and check emitters 12 through 30 in Cotton Zone B for sediment clogging.",
                "priority": "urgent",
                "source": "ai_plan"
            },
            due_until=now + timedelta(hours=4),
            started_at=now - timedelta(minutes=20),
            created_at=now - timedelta(minutes=25)
        )
        session.add(task_open)

        # Add Recently Completed Task
        task_done = Task(
            farm_id=farm.id,
            zone_id=zone_a.id,
            status="completed",
            notes="Extract 4 randomized soil core samples at 15cm depth across Wheat Zone A and verify foliar chlorophyll index.",
            evidence={
                "title": "Baseline Soil Core Sampling & Canopy Scouting — Zone A",
                "description": "Extract 4 randomized soil core samples at 15cm depth across Wheat Zone A and verify foliar chlorophyll index.",
                "priority": "medium",
                "source": "user",
                "completion_notes": "Moisture baseline confirmed at 36.5%. Soil core structure optimal; no sign of fungal spore or leaf chlorosis."
            },
            completed_at=now - timedelta(hours=1, minutes=45),
            created_at=now - timedelta(hours=3)
        )
        session.add(task_done)

        await session.commit()
        print(f"Farm {farm.name} successfully primed with real-world working scenario!")


async def main():
    factory = get_session_factory()
    async with factory() as session:
        farms = list((await session.scalars(select(Farm))).all())
    
    # Seed all farms or specifically farm1 and farmer
    for f in farms:
        await seed_farm_scenario(f.id)


if __name__ == "__main__":
    asyncio.run(main())
