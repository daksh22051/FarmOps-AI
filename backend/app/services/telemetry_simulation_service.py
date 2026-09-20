"""
Live Telemetry Simulation & Auto-Provisioning Service
Generates continuous, realistic, agronomic in-situ sensor telemetry for all farm zones and devices.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import random
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.farm import Farm, Zone
from app.models.device import Device
from app.models.sensor_event import SensorEvent
from app.models.risk import RiskAssessment
from app.core.logging import logger


class TelemetrySimulationService:
    @staticmethod
    async def ensure_devices_for_farm(session: AsyncSession, farm_id: str) -> List[Device]:
        """
        Ensures every zone on the farm has at least one active in-situ soil probe device.
        """
        zones_res = await session.execute(
            select(Zone).where(Zone.farm_id == farm_id)
        )
        zones = list(zones_res.scalars().all())
        if not zones:
            return []

        devices_res = await session.execute(
            select(Device).where(Device.farm_id == farm_id)
        )
        existing_devices = list(devices_res.scalars().all())
        zone_to_device = {d.zone_id: d for d in existing_devices if d.zone_id}

        created_devices: List[Device] = []
        now_utc = datetime.now(timezone.utc)

        for zone in zones:
            if zone.id not in zone_to_device:
                probe_id = f"probe-{zone.id[:8]}"
                check_res = await session.execute(select(Device).where(Device.id == probe_id))
                dev = check_res.scalar_one_or_none()
                if not dev:
                    dev = Device(
                        id=probe_id,
                        farm_id=farm_id,
                        zone_id=zone.id,
                        device_type="soil_probe",
                        credential_reference=f"IN-SITU-{zone.name[:8].upper().replace(' ', '-')}-{zone.id[:4]}",
                        last_seen_at=now_utc,
                        enabled=True,
                    )
                    session.add(dev)
                    created_devices.append(dev)
                else:
                    dev.zone_id = zone.id
                    dev.enabled = True
                    dev.last_seen_at = now_utc

        if created_devices:
            await session.commit()
            logger.info(f"Auto-provisioned {len(created_devices)} probe devices for farm {farm_id}")

        # Return all active devices for the farm
        all_devs_res = await session.execute(
            select(Device).where(Device.farm_id == farm_id, Device.enabled.is_(True))
        )
        return list(all_devs_res.scalars().all())

    @staticmethod
    def _generate_readings_for_zone(zone: Zone, is_stress: bool = False) -> Dict[str, tuple[float, str]]:
        """
        Generates realistic agronomic sensor readings tailored to crop type and stress conditions.
        """
        crop_lower = (zone.crop or "").lower()
        name_lower = (zone.name or "").lower()

        # Check if zone name or condition hints at water deficit or heat stress
        is_water_stress = is_stress or "stress" in name_lower or "deficit" in name_lower or "dry" in name_lower
        is_nutrient_stress = "nutrient" in name_lower or "deficiency" in name_lower

        if is_water_stress:
            moisture = round(random.uniform(15.2, 18.8), 1)
            temp = round(random.uniform(33.5, 36.2), 1)
            humidity = round(random.uniform(28.0, 34.0), 1)
        elif "pomegranate" in crop_lower or "orchard" in crop_lower:
            moisture = round(random.uniform(32.0, 36.0), 1)
            temp = round(random.uniform(26.0, 29.5), 1)
            humidity = round(random.uniform(52.0, 62.0), 1)
        elif "rice" in crop_lower or "paddy" in crop_lower:
            moisture = round(random.uniform(55.0, 68.0), 1)
            temp = round(random.uniform(27.0, 31.0), 1)
            humidity = round(random.uniform(70.0, 85.0), 1)
        elif "cotton" in crop_lower:
            moisture = round(random.uniform(34.0, 38.0), 1)
            temp = round(random.uniform(28.0, 32.0), 1)
            humidity = round(random.uniform(45.0, 58.0), 1)
        else:
            # General balanced field crop
            moisture = round(random.uniform(34.0, 39.0), 1)
            temp = round(random.uniform(25.0, 29.0), 1)
            humidity = round(random.uniform(55.0, 65.0), 1)

        # Soil chemistry
        if is_nutrient_stress:
            n = round(random.uniform(10.0, 14.5), 1)
            p = round(random.uniform(6.5, 9.0), 1)
            k = round(random.uniform(12.0, 16.0), 1)
            ph = round(random.uniform(5.2, 5.8), 2)
        else:
            n = round(random.uniform(38.0, 46.0), 1)
            p = round(random.uniform(24.0, 32.0), 1)
            k = round(random.uniform(32.0, 42.0), 1)
            ph = round(random.uniform(6.5, 7.2), 2)

        ec = round(random.uniform(1.15, 1.45), 2)
        rainfall = 0.0

        return {
            "soil_moisture": (moisture, "%"),
            "air_temperature": (temp, "degC"),
            "air_humidity": (humidity, "%"),
            "soil_ph": (ph, "pH"),
            "nitrogen": (n, "mg/kg"),
            "phosphorus": (p, "mg/kg"),
            "potassium": (k, "mg/kg"),
            "soil_ec": (ec, "dS/m"),
            "rainfall": (rainfall, "mm"),
        }

    @classmethod
    async def simulate_live_stream_for_farm(
        cls,
        session: AsyncSession,
        farm_id: str,
        evaluate_risks: bool = True,
    ) -> int:
        """
        Ingests a fresh batch of live telemetry events for all zones of a farm with current timestamp.
        """
        devices = await cls.ensure_devices_for_farm(session, farm_id)
        if not devices:
            return 0

        zones_res = await session.execute(select(Zone).where(Zone.farm_id == farm_id))
        zones = {z.id: z for z in zones_res.scalars().all()}

        now_utc = datetime.now(timezone.utc)
        seq_base = int(now_utc.timestamp()) % 1000000

        # Query max sequence per device to prevent collisions
        seq_query = select(
            SensorEvent.device_id,
            func.max(SensorEvent.sequence).label("max_seq"),
        ).where(SensorEvent.farm_id == farm_id).group_by(SensorEvent.device_id)
        seq_res = await session.execute(seq_query)
        device_max_seq = {row.device_id: (row.max_seq or 0) for row in seq_res.all()}

        events_created = 0

        for device in devices:
            zone = zones.get(device.zone_id) if device.zone_id else None
            if not zone:
                continue

            measurements_dict = cls._generate_readings_for_zone(zone)
            raw_measurements = {k: v[0] for k, v in measurements_dict.items()}

            for metric_key, (val, unit) in measurements_dict.items():
                current_seq = device_max_seq.get(device.id, seq_base) + 1
                device_max_seq[device.id] = current_seq

                event = SensorEvent(
                    device_id=device.id,
                    farm_id=farm_id,
                    zone_id=zone.id,
                    metric=metric_key,
                    value=val,
                    unit=unit,
                    measurements=raw_measurements,
                    metadata_payload={
                        "crop": zone.crop,
                        "zone_name": zone.name,
                        "source": "live_telemetry_simulator",
                    },
                    event_at=now_utc,
                    received_at=now_utc,
                    sequence=current_seq,
                    quality="good",
                    source="simulator",
                    schema_version="1.0",
                    is_duplicate=False,
                    is_delayed=False,
                )
                session.add(event)
                events_created += 1

            device.last_seen_at = now_utc
            zone.status = "active"

        await session.commit()
        logger.info(f"Simulated {events_created} live sensor telemetry records for farm {farm_id}")

        if evaluate_risks:
            try:
                from app.services.risk_detection_service import RiskDetectionService
                await RiskDetectionService.evaluate_farm(
                    session=session,
                    farm_id=farm_id,
                    actor_id="telemetry_engine",
                )
            except Exception as e:
                logger.warning(f"Risk evaluation after telemetry simulation: {e}")

        return events_created

    @classmethod
    async def seed_time_series_history_for_farm(
        cls,
        session: AsyncSession,
        farm_id: str,
        hours_back: int = 12,
    ) -> int:
        """
        Seeds 12 historical time-series data points up to the present moment for charts & trends.
        """
        devices = await cls.ensure_devices_for_farm(session, farm_id)
        if not devices:
            return 0

        zones_res = await session.execute(select(Zone).where(Zone.farm_id == farm_id))
        zones = {z.id: z for z in zones_res.scalars().all()}

        # Query max sequence per device
        seq_query = select(
            SensorEvent.device_id,
            func.max(SensorEvent.sequence).label("max_seq"),
        ).where(SensorEvent.farm_id == farm_id).group_by(SensorEvent.device_id)
        seq_res = await session.execute(seq_query)
        device_max_seq = {row.device_id: (row.max_seq or 0) for row in seq_res.all()}

        now_utc = datetime.now(timezone.utc)
        events_created = 0

        for h in range(hours_back, -1, -1):
            event_time = now_utc - timedelta(hours=h)

            for device in devices:
                zone = zones.get(device.zone_id) if device.zone_id else None
                if not zone:
                    continue

                measurements_dict = cls._generate_readings_for_zone(zone)
                raw_measurements = {k: v[0] for k, v in measurements_dict.items()}

                for metric_key, (val, unit) in measurements_dict.items():
                    current_seq = device_max_seq.get(device.id, int(event_time.timestamp()) % 1000000) + 1
                    device_max_seq[device.id] = current_seq

                    # Add slight random walk variance per step
                    step_val = round(val + random.uniform(-0.4, 0.4), 2)
                    event = SensorEvent(
                        device_id=device.id,
                        farm_id=farm_id,
                        zone_id=zone.id,
                        metric=metric_key,
                        value=step_val,
                        unit=unit,
                        measurements=raw_measurements,
                        metadata_payload={"historical_step": h},
                        event_at=event_time,
                        received_at=event_time,
                        sequence=current_seq,
                        quality="good",
                        source="simulator",
                        schema_version="1.0",
                        is_duplicate=False,
                        is_delayed=False,
                    )
                    session.add(event)
                    events_created += 1

                if h == 0:
                    device.last_seen_at = event_time

        await session.commit()
        logger.info(f"Seeded {events_created} historical telemetry points for farm {farm_id}")
        return events_created

    @classmethod
    async def simulate_all_farms(cls, session: AsyncSession) -> Dict[str, int]:
        """
        Iterates over all farms and emits fresh live telemetry.
        """
        farms_res = await session.execute(select(Farm))
        farms = list(farms_res.scalars().all())
        results = {}
        for farm in farms:
            count = await cls.simulate_live_stream_for_farm(session, farm.id, evaluate_risks=False)
            results[farm.id] = count
        return results
