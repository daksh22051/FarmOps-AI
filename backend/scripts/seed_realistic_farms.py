"""
Seed Realistic Multi-Farm Agro Production Scenarios
Replaces test farms with 3 distinct Indian agricultural farms:
1. Shree Patel Krishi Farm (Shilaj, Ahmedabad) - Water Stress on Cotton Zone B
2. Green Valley Agro Farm (Surat) - Nutrient Deficiency on Banana Zone B
3. Kisan Agro Farms (Anand/Kheda) - Elevated Pest/Disease Risk on Mustard Zone B
"""

import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import asyncio
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


FARMS_SPEC = [
    {
        "name": "Shree Patel Krishi Farm",
        "location": "Shilaj, Ahmedabad, Gujarat",
        "total_area": 12.5,
        "area_unit": "acres",
        "primary_crop": "Wheat • Cotton",
        "latitude": 23.0566,
        "longitude": 72.4800,
        "city": "Shilaj",
        "zones": [
            {
                "name": "Zone A (North Block)",
                "crop": "Wheat",
                "area": 4.5,
                "status": "active",
                "condition": "normal",
                "telemetry": {
                    "soil_moisture": (35.8, "%"),
                    "air_temperature": (24.0, "degC"),
                    "air_humidity": (58.0, "%"),
                    "soil_ph": (6.7, "pH"),
                    "nitrogen": (42.0, "mg/kg"),
                    "phosphorus": (28.0, "mg/kg"),
                    "potassium": (35.0, "mg/kg"),
                },
            },
            {
                "name": "Zone B (Cotton Parcel)",
                "crop": "Cotton",
                "area": 4.0,
                "status": "active",
                "condition": "water_stress",
                "telemetry": {
                    "soil_moisture": (15.6, "%"),  # Critical deficit < 20%
                    "air_temperature": (34.8, "degC"), # Heat stress > 32°C
                    "air_humidity": (31.0, "%"),  # Low humidity < 35%
                    "soil_ph": (6.8, "pH"),
                    "nitrogen": (38.0, "mg/kg"),
                    "phosphorus": (24.0, "mg/kg"),
                    "potassium": (32.0, "mg/kg"),
                },
            },
            {
                "name": "Zone C (South Block)",
                "crop": "Wheat",
                "area": 4.0,
                "status": "active",
                "condition": "normal",
                "telemetry": {
                    "soil_moisture": (37.2, "%"),
                    "air_temperature": (23.5, "degC"),
                    "air_humidity": (60.0, "%"),
                    "soil_ph": (6.8, "pH"),
                    "nitrogen": (45.0, "mg/kg"),
                    "phosphorus": (30.0, "mg/kg"),
                    "potassium": (37.0, "mg/kg"),
                },
            },
        ],
        "scenario": {
            "risk_type": "water_stress",
            "severity": "critical",
            "explanation": "Volumetric soil moisture dropped to 15.6% under 34.8°C ambient temperature. Evaporative deficit threatens boll formation.",
            "target_zone_idx": 1,
            "plan": {
                "action_type": "irrigate",
                "title": "Emergency Drip Irrigation Cycle — Zone B (Cotton)",
                "summary": "Initiate 25mm targeted drip irrigation cycle via Line B2 starting 18:30 IST to arrest evapotranspiration loss in cotton parcel.",
                "rationale": "Root-zone moisture (15.6%) is below the 25% minimum threshold for cotton boll development stage. Evening irrigation avoids high solar evaporative loss.",
                "timing_desc": "Today, 6:30 PM – 10:30 PM IST (Evening Window)",
                "start_hour_ist": 18,
                "start_min_ist": 30,
                "duration_hours": 4,
                "approval_required": True,
                "priority": "urgent",
            },
            "alert": {
                "severity": "critical",
                "message": "Water Stress Alert: Zone B (Cotton) soil moisture critical at 15.6% under 34.8°C heat. Drip irrigation required.",
            },
            "open_task": {
                "title": "Inspect Zone B Drip Emitters & Subsoil Probe",
                "desc": "Verify drip manifold line pressure (target 1.8 bar) and inspect emitters 12 through 30 in Cotton Zone B for sediment clogging.",
                "priority": "urgent",
                "status": "in_progress",
                "zone_idx": 1,
            },
            "done_task": {
                "title": "Baseline Soil Core Sampling & Scouting — Zone A",
                "desc": "Extract 4 randomized soil core samples at 15cm depth across Wheat Zone A.",
                "priority": "medium",
                "zone_idx": 0,
                "notes": "Moisture baseline confirmed at 35.8%. Root zone healthy, zero fungal or leaf chlorosis symptoms.",
            }
        }
    },
    {
        "name": "Green Valley Agro Farm",
        "location": "Surat, South Gujarat, India",
        "total_area": 8.5,
        "area_unit": "acres",
        "primary_crop": "Sugarcane • Banana • Vegetables",
        "latitude": 21.1702,
        "longitude": 72.8311,
        "city": "Surat",
        "zones": [
            {
                "name": "Zone A (Canal Block)",
                "crop": "Sugarcane",
                "area": 3.5,
                "status": "active",
                "condition": "normal",
                "telemetry": {
                    "soil_moisture": (42.0, "%"),
                    "air_temperature": (28.5, "degC"),
                    "air_humidity": (68.0, "%"),
                    "soil_ph": (6.9, "pH"),
                    "nitrogen": (52.0, "mg/kg"),
                    "phosphorus": (34.0, "mg/kg"),
                    "potassium": (45.0, "mg/kg"),
                },
            },
            {
                "name": "Zone B (Banana Orchard)",
                "crop": "Banana",
                "area": 3.0,
                "status": "active",
                "condition": "nutrient_deficiency",
                "telemetry": {
                    "soil_moisture": (32.0, "%"),
                    "air_temperature": (29.0, "degC"),
                    "air_humidity": (65.0, "%"),
                    "soil_ph": (5.2, "pH"),     # Acidic pH locking nutrients
                    "nitrogen": (8.5, "mg/kg"),  # Severe low N < 12 mg/kg
                    "phosphorus": (7.0, "mg/kg"), # Severe low P < 8 mg/kg
                    "potassium": (11.0, "mg/kg"),# Severe low K < 12 mg/kg
                },
            },
            {
                "name": "Zone C (Riverfront Parcel)",
                "crop": "Vegetables",
                "area": 2.0,
                "status": "active",
                "condition": "normal",
                "telemetry": {
                    "soil_moisture": (36.0, "%"),
                    "air_temperature": (27.5, "degC"),
                    "air_humidity": (64.0, "%"),
                    "soil_ph": (6.8, "pH"),
                    "nitrogen": (48.0, "mg/kg"),
                    "phosphorus": (31.0, "mg/kg"),
                    "potassium": (39.0, "mg/kg"),
                },
            },
        ],
        "scenario": {
            "risk_type": "nutrient_deficiency",
            "severity": "high",
            "explanation": "Available nitrogen (8.5 mg/kg) and phosphorus (7.0 mg/kg) have dropped into critical deficiency. Acidic soil pH (5.2) impairs macronutrient uptake.",
            "target_zone_idx": 1,
            "plan": {
                "action_type": "apply_fertilizer",
                "title": "Targeted Micro-Nutrient Fertigation & pH Buffering — Zone B",
                "summary": "Apply customized water-soluble 19:19:19 fertigation blend with agricultural lime buffer to correct soil acidity and restore vegetative vigor.",
                "rationale": "Severe nitrogen and phosphorus depletion during early bunching phase causes stunted pseudostem growth and yield degradation.",
                "timing_desc": "Tomorrow, 7:00 AM – 11:00 AM IST (Morning Fertigation)",
                "start_hour_ist": 7,
                "start_min_ist": 0,
                "duration_hours": 4,
                "approval_required": True,
                "priority": "high",
            },
            "alert": {
                "severity": "warning",
                "message": "Nutrient Deficiency Alert: Zone B Banana orchard available nitrogen severely depleted (8.5 mg/kg, pH 5.2).",
            },
            "open_task": {
                "title": "Calibrate Fertigation Venturi Injector — Zone B",
                "desc": "Clean suction filter and calibrate injector flow rate to 4.5 L/hr for soluble NPK application in Banana orchard.",
                "priority": "high",
                "status": "in_progress",
                "zone_idx": 1,
            },
            "done_task": {
                "title": "Soil pH & Tensiometer Sensor Verification — Zone A",
                "desc": "Check Canal Block moisture sensors and log 2-point pH buffer calibration.",
                "priority": "medium",
                "zone_idx": 0,
                "notes": "Moisture sensor accuracy within +/- 1.2%. Soil pH steady at 6.9; cane stalks robust.",
            }
        }
    },
    {
        "name": "Kisan Agro Farms",
        "location": "Anand, Kheda District, Gujarat",
        "total_area": 16.0,
        "area_unit": "acres",
        "primary_crop": "Maize • Mustard • Pulses",
        "latitude": 22.5645,
        "longitude": 72.9289,
        "city": "Anand",
        "zones": [
            {
                "name": "Zone A (East Parcel)",
                "crop": "Maize",
                "area": 6.0,
                "status": "active",
                "condition": "normal",
                "telemetry": {
                    "soil_moisture": (33.5, "%"),
                    "air_temperature": (25.0, "degC"),
                    "air_humidity": (62.0, "%"),
                    "soil_ph": (6.8, "pH"),
                    "nitrogen": (46.0, "mg/kg"),
                    "phosphorus": (29.0, "mg/kg"),
                    "potassium": (38.0, "mg/kg"),
                },
            },
            {
                "name": "Zone B (Mustard Belt)",
                "crop": "Mustard",
                "area": 5.0,
                "status": "active",
                "condition": "pest_disease",
                "telemetry": {
                    "soil_moisture": (31.0, "%"),
                    "air_temperature": (22.5, "degC"),
                    "air_humidity": (91.5, "%"), # CRITICAL: sustained humidity > 88%
                    "soil_ph": (6.7, "pH"),
                    "nitrogen": (40.0, "mg/kg"),
                    "phosphorus": (26.0, "mg/kg"),
                    "potassium": (34.0, "mg/kg"),
                },
            },
            {
                "name": "Zone C (West Ridge)",
                "crop": "Pulses",
                "area": 5.0,
                "status": "active",
                "condition": "normal",
                "telemetry": {
                    "soil_moisture": (29.0, "%"),
                    "air_temperature": (26.0, "degC"),
                    "air_humidity": (60.0, "%"),
                    "soil_ph": (6.8, "pH"),
                    "nitrogen": (44.0, "mg/kg"),
                    "phosphorus": (28.0, "mg/kg"),
                    "potassium": (36.0, "mg/kg"),
                },
            },
        ],
        "scenario": {
            "risk_type": "pest_disease",
            "severity": "high",
            "explanation": "Prolonged high canopy humidity (91.5% RH) at 22.5°C creates optimal microclimate conditions for white rust and fungal pathogen development.",
            "target_zone_idx": 1,
            "plan": {
                "action_type": "apply_biocontrol",
                "title": "Field Scouting & Preventive Biocontrol Spray — Zone B (Mustard)",
                "summary": "Deploy Trichoderma harzianum bio-fungicide foliar spray and conduct zigzag canopy scouting across Mustard rows 12-40.",
                "rationale": "High relative humidity (91.5%) sustained over 6 hours elevates spore germination risk. Early biological intervention prevents fungal outbreak.",
                "timing_desc": "Today, 4:00 PM – 7:00 PM IST (Pre-Dusk Spray Window)",
                "start_hour_ist": 16,
                "start_min_ist": 0,
                "duration_hours": 3,
                "approval_required": True,
                "priority": "high",
            },
            "alert": {
                "severity": "warning",
                "message": "Pest & Disease Warning: Sustained 91.5% humidity in Zone B Mustard canopy favors fungal pathogen germination.",
            },
            "open_task": {
                "title": "Inspect Underside of Mustard Leaves (Rows 12-40)",
                "desc": "Check for white pustules on leaf undersides and verify sticky traps for aphid populations.",
                "priority": "urgent",
                "status": "in_progress",
                "zone_idx": 1,
            },
            "done_task": {
                "title": "Yellow Sticky Trap Grid Deployment — Zone A",
                "desc": "Install 12 pheromone & sticky monitoring cards across East Parcel Maize.",
                "priority": "low",
                "zone_idx": 0,
                "notes": "Trap density 2 per acre established. Pest population counts below economic threshold.",
            }
        }
    }
]


async def seed_clean_farms():
    factory = get_session_factory()
    now_utc = datetime.now(timezone.utc)
    # Current Indian Standard Time (UTC + 5:30)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = now_utc + ist_offset

    async with factory() as session:
        existing_farms = list((await session.scalars(select(Farm))).all())
        print(f"Found {len(existing_farms)} existing farms.")

        # Match or create the 3 standard farms
        owner_id = existing_farms[0].owner_id if existing_farms else "8e5e2a0f-850d-410b-af69-773d359e0b40"
        
        target_farms = []
        for i, spec in enumerate(FARMS_SPEC):
            if i < len(existing_farms):
                f = existing_farms[i]
                f.name = spec["name"]
                f.location = spec["location"]
                f.total_area = spec["total_area"]
                f.area_unit = spec["area_unit"]
                f.crop_profile = {
                    "primary_crop": spec["primary_crop"],
                    "latitude": spec["latitude"],
                    "longitude": spec["longitude"],
                    "city": spec["city"],
                    "state": "Gujarat",
                    "country": "India"
                }
                session.add(f)
            else:
                f = Farm(
                    owner_id=owner_id,
                    name=spec["name"],
                    location=spec["location"],
                    total_area=spec["total_area"],
                    area_unit=spec["area_unit"],
                    crop_profile={
                        "primary_crop": spec["primary_crop"],
                        "latitude": spec["latitude"],
                        "longitude": spec["longitude"],
                        "city": spec["city"],
                        "state": "Gujarat",
                        "country": "India"
                    }
                )
                session.add(f)
            target_farms.append((f, spec))
        
        # If there are any excess junk farms beyond 3, clean them up
        if len(existing_farms) > len(FARMS_SPEC):
            for extra in existing_farms[len(FARMS_SPEC):]:
                print(f"Cleaning excess farm: {extra.name} ({extra.id})")
                await session.delete(extra)
        
        await session.commit()

        # Now configure each farm's zones, devices, telemetry, risks, plans, and tasks
        for farm, spec in target_farms:
            await session.refresh(farm)
            print(f"\nConfiguring Farm: {farm.name} (id={farm.id})")

            # Clean existing farm-scoped items
            await session.execute(delete(RiskAssessment).where(RiskAssessment.farm_id == farm.id))
            await session.execute(delete(ActionPlan).where(ActionPlan.farm_id == farm.id))
            await session.execute(delete(Alert).where(Alert.farm_id == farm.id))
            await session.execute(delete(Task).where(Task.farm_id == farm.id))
            await session.commit()

            # Ensure 3 zones
            existing_zones = list((await session.scalars(select(Zone).where(Zone.farm_id == farm.id).order_by(Zone.name))).all())
            zones = []
            for z_idx, z_spec in enumerate(spec["zones"]):
                if z_idx < len(existing_zones):
                    z = existing_zones[z_idx]
                    z.name = z_spec["name"]
                    z.crop = z_spec["crop"]
                    z.area = z_spec["area"]
                    z.area_unit = spec["area_unit"]
                    z.status = z_spec["status"]
                    session.add(z)
                else:
                    z = Zone(
                        farm_id=farm.id,
                        name=z_spec["name"],
                        crop=z_spec["crop"],
                        area=z_spec["area"],
                        area_unit=spec["area_unit"],
                        status=z_spec["status"],
                    )
                    session.add(z)
                zones.append(z)
            
            # Clean extra zones if any
            if len(existing_zones) > len(spec["zones"]):
                for ez in existing_zones[len(spec["zones"]):]:
                    await session.delete(ez)
            
            await session.commit()
            for z in zones:
                await session.refresh(z)

            # Ingest fresh telemetry for each zone
            seq = int(now_utc.timestamp())
            devices = []
            for z_idx, z in enumerate(zones):
                dev = (await session.scalars(select(Device).where(Device.zone_id == z.id, Device.enabled == True))).first()
                if not dev:
                    dev = Device(
                        farm_id=farm.id,
                        zone_id=z.id,
                        device_type="soil_probe",
                        enabled=True,
                        calibration={"source": "in_situ_soil_probe", "name": f"Probe - {z.name}"}
                    )
                    session.add(dev)
                    await session.commit()
                    await session.refresh(dev)
                devices.append(dev)

                # Ingest readings
                z_spec = spec["zones"][z_idx]
                await session.execute(delete(SensorEvent).where(SensorEvent.device_id == dev.id))
                await session.commit()

                # Generate 3 historical events: 20m ago, 10m ago, and 45s ago
                for offset_mins in [20, 10, 0.75]:
                    evt_time = now_utc - timedelta(minutes=offset_mins)
                    measurements_dict = {}
                    for metric_name, (val, unit) in z_spec["telemetry"].items():
                        variance = 0.2 if offset_mins != 0.75 else 0.0
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

            # Create specific scenario risk
            sc = spec["scenario"]
            target_zone = zones[sc["target_zone_idx"]]
            
            risk = RiskAssessment(
                farm_id=farm.id,
                zone_id=target_zone.id,
                risk_type=sc["risk_type"],
                severity=sc["severity"],
                score=0.92,
                confidence=0.92,
                agent=f"{sc['risk_type']}_agent",
                agent_version="1.0.0",
                status="open",
                evidence={
                    "explanation": sc["explanation"],
                    "freshness": "live",
                    "telemetry_ref": f"Sensor probe {devices[sc['target_zone_idx']].id[:8]}",
                },
                created_at=now_utc - timedelta(minutes=15),
                updated_at=now_utc - timedelta(minutes=1)
            )
            session.add(risk)
            await session.commit()
            await session.refresh(risk)

            # Create Alert
            alert = Alert(
                farm_id=farm.id,
                zone_id=target_zone.id,
                risk_id=risk.id,
                severity=sc["alert"]["severity"],
                channel="in_app",
                message=sc["alert"]["message"],
                delivery_status="delivered",
                dedupe_key=f"alert-{farm.id}-{target_zone.id}-{sc['risk_type']}",
                created_at=now_utc - timedelta(minutes=12)
            )
            session.add(alert)

            # Calculate proper plan execution times in IST and convert to UTC
            plan_spec = sc["plan"]
            target_date_ist = now_ist.date()
            if plan_spec.get("start_hour_ist", 18) < now_ist.hour:
                target_date_ist += timedelta(days=1)
            
            start_ist = datetime(
                target_date_ist.year, target_date_ist.month, target_date_ist.day,
                plan_spec.get("start_hour_ist", 18), plan_spec.get("start_min_ist", 30)
            )
            end_ist = start_ist + timedelta(hours=plan_spec.get("duration_hours", 4))
            
            # Convert IST to UTC (subtract 5:30)
            start_utc = start_ist - ist_offset
            end_utc = end_ist - ist_offset

            # Create Pending Action Plan
            plan = ActionPlan(
                farm_id=farm.id,
                zone_id=target_zone.id,
                risk_id=risk.id,
                action_type=plan_spec["action_type"],
                action_summary=plan_spec["summary"],
                approval_state="pending_approval",
                approval_required=plan_spec["approval_required"],
                policy_decision="APPROVAL_REQUIRED" if plan_spec["approval_required"] else "ALLOW",
                priority=plan_spec["priority"],
                confidence=0.94,
                rationale=plan_spec["rationale"],
                safety_flags=["Safety Policy: Autonomous execution restricted. Operator sign-off required."],
                evidence={
                    "title": plan_spec["title"],
                    "source": "gemini_agent",
                    "timing_desc": plan_spec["timing_desc"],
                },
                earliest_at=start_utc.replace(tzinfo=timezone.utc),
                latest_at=end_utc.replace(tzinfo=timezone.utc),
                created_at=now_utc - timedelta(minutes=10)
            )
            session.add(plan)

            # Create Open Task
            ot = sc["open_task"]
            task_open = Task(
                farm_id=farm.id,
                zone_id=zones[ot["zone_idx"]].id,
                status=ot["status"],
                notes=ot["desc"],
                evidence={
                    "title": ot["title"],
                    "description": ot["desc"],
                    "priority": ot["priority"],
                    "source": "ai_plan"
                },
                due_until=(now_utc + timedelta(hours=4)).replace(tzinfo=timezone.utc),
                started_at=(now_utc - timedelta(minutes=25)).replace(tzinfo=timezone.utc),
                created_at=(now_utc - timedelta(minutes=30)).replace(tzinfo=timezone.utc)
            )
            session.add(task_open)

            # Create Recently Completed Task
            dt = sc["done_task"]
            task_done = Task(
                farm_id=farm.id,
                zone_id=zones[dt["zone_idx"]].id,
                status="completed",
                notes=dt["desc"],
                evidence={
                    "title": dt["title"],
                    "description": dt["desc"],
                    "priority": dt["priority"],
                    "source": "user",
                    "completion_notes": dt["notes"]
                },
                completed_at=(now_utc - timedelta(hours=1, minutes=30)).replace(tzinfo=timezone.utc),
                created_at=(now_utc - timedelta(hours=3)).replace(tzinfo=timezone.utc)
            )
            session.add(task_done)

            await session.commit()
            print(f"Finished seeding farm: {farm.name}")

    print("\nAll 3 realistic farms seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed_clean_farms())
