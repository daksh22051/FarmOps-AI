"""
Task 7: Risk Detection & Risk Assessment Engine Comprehensive Test Suite
Validates deterministic agronomic risk detection, explainable evidence, confidence & freshness scoring,
deduplication/lifecycle, REST APIs, farm-scoped RBAC, audit logging, and OpenAPI documentation.
"""

import pytest
import json
import jwt
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.farm import Farm, Zone
from app.models.device import Device
from app.models.sensor_event import SensorEvent
from app.models.external_observation import ExternalObservation
from app.models.risk import RiskAssessment
from app.models.audit import AuditEvent
from app.services.risk_detection_service import RiskDetectionService


def create_test_token(user_id: str, role: str = "authenticated") -> str:
    payload = {
        "sub": user_id,
        "email": f"{user_id}@example.com",
        "role": role,
        "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm=settings.SUPABASE_JWT_ALGORITHM)


# ==============================================================================
# 1. API LISTING & FARM-SCOPED AUTHORIZATION
# ==============================================================================

@pytest.mark.asyncio
async def test_01_authorized_user_can_list_risks(client: AsyncClient, auth_headers: dict):
    # Create farm & zone
    farm_res = await client.post("/api/v1/farms", json={"name": "Risk Testing Farm 1"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    zone_res = await client.post(f"/api/v1/farms/{farm_id}/zones", json={"name": "Zone A"}, headers=auth_headers)
    zone_id = zone_res.json()["data"]["id"]

    # Trigger deterministic detection with low moisture
    detect_res = await client.post(
        "/api/v1/risks/detect",
        json={"farm_id": farm_id, "zone_id": zone_id, "telemetry_override": {"soil_moisture": 19.5}},
        headers=auth_headers,
    )
    assert detect_res.status_code == 200
    assert len(detect_res.json()["data"]) >= 1

    # List risks via GET /api/v1/farms/{farm_id}/risks
    list_res = await client.get(f"/api/v1/farms/{farm_id}/risks", headers=auth_headers)
    assert list_res.status_code == 200
    data = list_res.json()["data"]
    assert len(data) >= 1
    assert data[0]["risk_type"] == "water_stress"
    assert data[0]["farm_id"] == farm_id


@pytest.mark.asyncio
async def test_02_unauthorized_farm_risks_rejected(client: AsyncClient, auth_headers: dict):
    # Farm owned by User 1
    farm_res = await client.post("/api/v1/farms", json={"name": "Isolated Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # User 2 headers
    user2_token = create_test_token("usr_unauthorized_attacker")
    user2_headers = {"Authorization": f"Bearer {user2_token}"}

    # Attempt cross-farm risk list
    list_res = await client.get(f"/api/v1/farms/{farm_id}/risks", headers=user2_headers)
    assert list_res.status_code == 403


@pytest.mark.asyncio
async def test_03_direct_risk_access_is_farm_scoped(client: AsyncClient, auth_headers: dict):
    # Create farm & trigger risk
    farm_res = await client.post("/api/v1/farms", json={"name": "Direct Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    detect_res = await client.post(
        "/api/v1/risks/detect",
        json={"farm_id": farm_id, "telemetry_override": {"soil_moisture": 18.0}},
        headers=auth_headers,
    )
    assert detect_res.status_code == 200
    risk_id = detect_res.json()["data"][0]["id"]

    # Authorized direct risk access GET /api/v1/risks/{risk_id}
    detail_res = await client.get(f"/api/v1/risks/{risk_id}", headers=auth_headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["data"]["id"] == risk_id

    # Unauthorized user direct access
    user2_token = create_test_token("usr_unauthorized_attacker")
    user2_headers = {"Authorization": f"Bearer {user2_token}"}

    unauth_res = await client.get(f"/api/v1/risks/{risk_id}", headers=user2_headers)
    assert unauth_res.status_code == 403


# ==============================================================================
# 2. WATER STRESS DETECTION & ENVIRONMENTAL COMPOUNDING
# ==============================================================================

@pytest.mark.asyncio
async def test_04_water_stress_detected_from_low_soil_moisture(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Water Stress Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Detect water stress with moisture=22.0%
    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 22.0},
    )
    assert len(risks) == 1
    water_risk = risks[0]
    assert water_risk.risk_type == "water_stress"
    assert water_risk.severity in ["high", "critical"]
    assert "low_soil_moisture" in water_risk.evidence["rules_triggered"]


@pytest.mark.asyncio
async def test_05_water_stress_severity_increases_with_supporting_environmental_signals(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Compounded Stress Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Low moisture + High Temp (35°C) + Low Humidity (20%) + Zero Rain
    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={
            "soil_moisture": 18.0,
            "air_temperature": 36.5,
            "air_humidity": 18.0,
            "rainfall": 0.0,
        },
    )
    assert len(risks) >= 1
    water_risk = next(r for r in risks if r.risk_type == "water_stress")
    assert water_risk.severity == "critical"
    assert "high_ambient_temperature" in water_risk.evidence["rules_triggered"]
    assert "low_air_humidity" in water_risk.evidence["rules_triggered"]
    assert water_risk.confidence >= 0.80


@pytest.mark.asyncio
async def test_06_water_stress_does_not_trigger_from_healthy_moisture(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Healthy Moisture Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Moisture 45.0% (optimal / healthy)
    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 45.0, "air_temperature": 22.0},
    )
    water_risks = [r for r in risks if r.risk_type == "water_stress"]
    assert len(water_risks) == 0


# ==============================================================================
# 3. PEST & DISEASE RISK DETECTION & EXPLAINABILITY
# ==============================================================================

@pytest.mark.asyncio
async def test_07_pest_disease_risk_detected_from_supporting_environmental_conditions(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Pest Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # High humidity 88% + warm temp 24°C + rain 6.0mm
    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={
            "soil_moisture": 40.0,  # healthy moisture so no water stress
            "air_humidity": 88.0,
            "air_temperature": 24.5,
            "rainfall": 6.0,
        },
    )
    pest_risks = [r for r in risks if r.risk_type == "pest_disease"]
    assert len(pest_risks) == 1
    pest_risk = pest_risks[0]
    assert pest_risk.severity in ["high", "critical"]
    assert "sustained_high_relative_humidity" in pest_risk.evidence["rules_triggered"]
    assert "optimal_pathogen_temperature_range" in pest_risk.evidence["rules_triggered"]
    assert "recent_rainfall_leaf_wetness" in pest_risk.evidence["rules_triggered"]


@pytest.mark.asyncio
async def test_08_pest_disease_risk_does_not_claim_definitive_diagnosis(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Explainable Pest Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"air_humidity": 85.0, "air_temperature": 25.0},
    )
    pest_risk = next(r for r in risks if r.risk_type == "pest_disease")
    explanation = pest_risk.evidence["explanation"]

    # Must contain risk / microclimate favorability wording and NOT claim definitive illness
    assert "risk" in explanation.lower() or "favorable" in explanation.lower()
    assert "crop definitely has" not in explanation.lower()
    assert "definitively diagnosed" not in explanation.lower()


# ==============================================================================
# 4. NUTRIENT DEFICIENCY DETECTION
# ==============================================================================

@pytest.mark.asyncio
async def test_09_nutrient_risk_detected_for_low_nitrogen(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Low N Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"nitrogen": 10.0, "soil_moisture": 40.0},
    )
    nutrient_risks = [r for r in risks if r.risk_type == "nutrient_deficiency"]
    assert len(nutrient_risks) == 1
    evidence = nutrient_risks[0].evidence
    assert any(s["name"] == "nitrogen" and s["value"] == 10.0 for s in evidence["signals"])
    assert "low_soil_nitrogen" in evidence["rules_triggered"]


@pytest.mark.asyncio
async def test_10_nutrient_risk_detected_for_low_phosphorus(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Low P Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"phosphorus": 6.5, "soil_moisture": 40.0},
    )
    nutrient_risks = [r for r in risks if r.risk_type == "nutrient_deficiency"]
    assert len(nutrient_risks) == 1
    evidence = nutrient_risks[0].evidence
    assert any(s["name"] == "phosphorus" and s["value"] == 6.5 for s in evidence["signals"])
    assert "low_soil_phosphorus" in evidence["rules_triggered"]


@pytest.mark.asyncio
async def test_11_nutrient_risk_detected_for_low_potassium(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Low K Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"potassium": 8.0, "soil_moisture": 40.0},
    )
    nutrient_risks = [r for r in risks if r.risk_type == "nutrient_deficiency"]
    assert len(nutrient_risks) == 1
    evidence = nutrient_risks[0].evidence
    assert any(s["name"] == "potassium" and s["value"] == 8.0 for s in evidence["signals"])
    assert "low_soil_potassium" in evidence["rules_triggered"]


@pytest.mark.asyncio
async def test_12_missing_npk_does_not_create_nutrient_risk(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "No NPK Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Only soil moisture and air temp provided (no N/P/K or pH)
    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 40.0, "air_temperature": 22.0},
    )
    nutrient_risks = [r for r in risks if r.risk_type == "nutrient_deficiency"]
    assert len(nutrient_risks) == 0


# ==============================================================================
# 5. DATA FRESHNESS & CONFIDENCE SCORING
# ==============================================================================

@pytest.mark.asyncio
async def test_13_stale_data_lowers_confidence(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Freshness Test Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(f"/api/v1/farms/{farm_id}/devices", json={"device_type": "soil_moisture"}, headers=auth_headers)
    assert dev_res.status_code == 201
    dev_id = dev_res.json()["data"]["id"]

    now = datetime.now(timezone.utc)

    # 1. Fresh event (10 minutes old)
    fresh_event = SensorEvent(
        device_id=dev_id,
        farm_id=farm_id,
        metric="soil_moisture",
        value=18.0,
        measurements={"soil_moisture": 18.0},
        event_at=now - timedelta(minutes=10),
        sequence=1,
    )
    db_session.add(fresh_event)
    await db_session.commit()

    fresh_risks = await RiskDetectionService.evaluate_zone(session=db_session, farm_id=farm_id, zone_id=None)
    fresh_confidence = fresh_risks[0].confidence
    assert fresh_risks[0].evidence["freshness"] == "fresh"

    # 2. Stale event (30 hours old)
    stale_event = SensorEvent(
        device_id=dev_id,
        farm_id=farm_id,
        metric="soil_moisture",
        value=18.0,
        measurements={"soil_moisture": 18.0},
        event_at=now - timedelta(hours=30),
        sequence=2,
    )
    # Clear and insert stale
    db_session.add(stale_event)
    fresh_risk_record = fresh_risks[0]
    await db_session.delete(fresh_risk_record)
    await db_session.delete(fresh_event)
    await db_session.commit()

    stale_risks = await RiskDetectionService.evaluate_zone(session=db_session, farm_id=farm_id, zone_id=None)
    assert len(stale_risks) == 1
    stale_risk = stale_risks[0]
    assert stale_risk.evidence["freshness"] == "very_stale"
    assert stale_risk.confidence < fresh_confidence


@pytest.mark.asyncio
async def test_14_evidence_is_structured_and_serializable(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Evidence Test Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 19.0, "air_temperature": 34.0},
    )
    evidence = risks[0].evidence
    assert isinstance(evidence, dict)
    assert "signals" in evidence
    assert "rules_triggered" in evidence
    assert "freshness" in evidence
    assert "explanation" in evidence

    # Must be 100% JSON serializable without error
    dumped = json.dumps(evidence)
    assert len(dumped) > 0


@pytest.mark.asyncio
async def test_15_confidence_remains_within_zero_to_one(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Confidence Bounds Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    test_cases = [
        {"soil_moisture": 15.0, "air_temperature": 38.0, "air_humidity": 15.0},
        {"soil_moisture": 34.0},
        {"air_humidity": 95.0, "air_temperature": 25.0, "rainfall": 10.0},
        {"nitrogen": 5.0, "phosphorus": 3.0, "potassium": 4.0},
    ]

    for tc in test_cases:
        risks = await RiskDetectionService.evaluate_zone(
            session=db_session,
            farm_id=farm_id,
            zone_id=None,
            telemetry_override=tc,
        )
        for r in risks:
            assert 0.0 <= r.confidence <= 1.0
            assert 0.0 <= r.score <= 1.0


# ==============================================================================
# 6. DEDUPLICATION & LIFECYCLE MANAGEMENT
# ==============================================================================

@pytest.mark.asyncio
async def test_16_duplicate_open_risks_are_controlled(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Dedupe Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Evaluation 1: creates risk
    risks_1 = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 21.0},
    )
    assert len(risks_1) == 1
    risk_id_1 = risks_1[0].id

    # Evaluation 2: updates existing open risk in-place
    risks_2 = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 17.0},
    )
    assert len(risks_2) == 1
    risk_id_2 = risks_2[0].id

    assert risk_id_1 == risk_id_2

    # Verify total rows in database is 1
    all_db_risks = (await db_session.execute(select(RiskAssessment).where(RiskAssessment.farm_id == farm_id))).scalars().all()
    assert len(all_db_risks) == 1
    assert all_db_risks[0].severity == "critical"  # Updated from high to critical in place


@pytest.mark.asyncio
async def test_17_repeated_telemetry_does_not_create_endless_risk_rows(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Telemetry Ingest Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    dev_res = await client.post(f"/api/v1/farms/{farm_id}/devices", json={"device_type": "soil_moisture"}, headers=auth_headers)
    assert dev_res.status_code == 201
    dev_id = dev_res.json()["data"]["id"]

    # Ingest 5 consecutive telemetry events with low moisture
    for seq in range(1, 6):
        tel_res = await client.post(
            "/api/v1/telemetry/events",
            json={
                "device_id": dev_id,
                "sequence": seq,
                "event_timestamp": datetime.now(timezone.utc).isoformat(),
                "measurements": {"soil_moisture": 20.0 - (seq * 0.5)},
            },
            headers=auth_headers,
        )
        assert tel_res.status_code in [200, 201]

    # Verify only 1 open water_stress risk assessment exists for this farm
    list_res = await client.get(f"/api/v1/farms/{farm_id}/risks", headers=auth_headers)
    assert list_res.status_code == 200
    risks = list_res.json()["data"]
    assert len(risks) == 1
    assert risks[0]["risk_type"] == "water_stress"


@pytest.mark.asyncio
async def test_18_resolved_reappearing_risk_lifecycle_behaves_deterministically(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Lifecycle Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # 1. Open initial risk
    risks_initial = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 20.0},
    )
    first_risk = risks_initial[0]
    assert first_risk.status == "open"

    # 2. Mark risk resolved (e.g. after irrigation completed)
    first_risk.status = "resolved"
    await db_session.commit()

    # 3. New detection triggered again -> creates a new open assessment since previous was resolved
    risks_reappeared = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 18.0},
    )
    assert len(risks_reappeared) == 1
    new_risk = risks_reappeared[0]
    assert new_risk.id != first_risk.id
    assert new_risk.status == "open"

    # Total in DB = 2 (1 resolved, 1 open)
    all_db = (await db_session.execute(select(RiskAssessment).where(RiskAssessment.farm_id == farm_id))).scalars().all()
    assert len(all_db) == 2


# ==============================================================================
# 7. EXTERNAL OBSERVATIONS & AUDIT LOGGING
# ==============================================================================

@pytest.mark.asyncio
async def test_19_external_observations_can_contribute_to_risk(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Observation Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Ingest external weather observation indicating pest alert & heavy rainfall forecast
    obs_res = await client.post(
        "/api/v1/observations",
        json={
            "farm_id": farm_id,
            "observation_type": "weather_forecast",
            "source": "openmeteo",
            "source_reference": "station_obs_99",
            "payload": {
                "humidity": 92.0,
                "rainfall_mm": 15.0,
                "pest_risk_alert": True,
            },
        },
        headers=auth_headers,
    )
    assert obs_res.status_code == 201

    # Run detection with ambient temp
    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"air_temperature": 26.0},
    )
    pest_risk = next(r for r in risks if r.risk_type == "pest_disease")
    assert "external_pest_surveillance_alert" in pest_risk.evidence["rules_triggered"]
    assert pest_risk.evidence["context"]["external_alert"] is True


@pytest.mark.asyncio
async def test_20_audit_event_created_for_risk_creation(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Audit Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    risks = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 19.0},
    )
    risk_id = risks[0].id

    # Verify audit event in database
    audit_res = await db_session.execute(
        select(AuditEvent).where(
            AuditEvent.farm_id == farm_id,
            AuditEvent.entity_id == risk_id,
            AuditEvent.event_type == "risk_created",
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None
    assert audit.source == "rule_engine"
    assert audit.entity_type == "risk_assessment"


@pytest.mark.asyncio
async def test_21_invalid_missing_zone_handled_safely(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Safe Zone Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Zone ID is None -> evaluates at farm level safely
    risks_none_zone = await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={"soil_moisture": 22.0},
    )
    assert len(risks_none_zone) == 1
    assert risks_none_zone[0].zone_id is None

    # Farm-wide evaluate_farm
    all_risks = await RiskDetectionService.evaluate_farm(
        session=db_session,
        farm_id=farm_id,
        telemetry_override={"soil_moisture": 22.0},
    )
    assert len(all_risks) >= 1


# ==============================================================================
# 8. PAGINATION, FILTERS & OPENAPI
# ==============================================================================

@pytest.mark.asyncio
async def test_22_pagination_works(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Pagination Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Trigger all 3 risk types (water, pest, nutrient)
    await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={
            "soil_moisture": 18.0,
            "air_humidity": 85.0,
            "air_temperature": 25.0,
            "nitrogen": 10.0,
        },
    )

    # Page 1, page_size=2
    p1_res = await client.get(f"/api/v1/farms/{farm_id}/risks?page=1&page_size=2", headers=auth_headers)
    assert p1_res.status_code == 200
    p1_data = p1_res.json()["data"]
    assert len(p1_data) == 2

    # Page 2, page_size=2
    p2_res = await client.get(f"/api/v1/farms/{farm_id}/risks?page=2&page_size=2", headers=auth_headers)
    assert p2_res.status_code == 200
    p2_data = p2_res.json()["data"]
    assert len(p2_data) == 1


@pytest.mark.asyncio
async def test_23_filters_work(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    farm_res = await client.post("/api/v1/farms", json={"name": "Filter Risk Farm"}, headers=auth_headers)
    farm_id = farm_res.json()["data"]["id"]

    # Trigger multiple risks
    await RiskDetectionService.evaluate_zone(
        session=db_session,
        farm_id=farm_id,
        zone_id=None,
        telemetry_override={
            "soil_moisture": 15.0,  # critical water stress
            "air_humidity": 85.0,   # high pest
            "nitrogen": 10.0,       # nutrient
        },
    )

    # Filter by risk_type=water_stress
    f_water = await client.get(f"/api/v1/farms/{farm_id}/risks?risk_type=water_stress", headers=auth_headers)
    assert f_water.status_code == 200
    assert len(f_water.json()["data"]) == 1
    assert f_water.json()["data"][0]["risk_type"] == "water_stress"

    # Filter by severity=critical
    f_crit = await client.get(f"/api/v1/farms/{farm_id}/risks?severity=critical", headers=auth_headers)
    assert f_crit.status_code == 200
    assert all(r["severity"] == "critical" for r in f_crit.json()["data"])

    # Filter by status=resolved (should be 0)
    f_res = await client.get(f"/api/v1/farms/{farm_id}/risks?status=resolved", headers=auth_headers)
    assert f_res.status_code == 200
    assert len(f_res.json()["data"]) == 0


@pytest.mark.asyncio
async def test_24_openapi_documentation_exists(client: AsyncClient):
    res = await client.get(f"{settings.API_V1_STR}/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    paths = schema.get("paths", {})

    # Ensure required risk endpoints are documented in OpenAPI schema
    assert "/api/v1/farms/{farm_id}/risks" in paths
    assert "get" in paths["/api/v1/farms/{farm_id}/risks"]
    assert "/api/v1/risks/{risk_id}" in paths
    assert "get" in paths["/api/v1/risks/{risk_id}"]
