"""
Deterministic Agronomic Risk Detection & Risk Assessment Engine
Evaluates sensor telemetry events and external observations to detect:
- WATER_STRESS
- PEST_DISEASE_RISK
- NUTRIENT_DEFICIENCY

Outputs explainable, traceable, and deduplicated RiskAssessment domain records.
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk import RiskAssessment
from app.models.sensor_event import SensorEvent
from app.models.external_observation import ExternalObservation
from app.models.farm import Zone
from app.services.audit_service import AuditService
from app.core.logging import logger


# =====================================================================
# CONFIGURABLE AGRONOMIC THRESHOLDS & ENGINE CONSTANTS
# =====================================================================

# Water Stress Configuration
WATER_STRESS_SOIL_MOISTURE_CRITICAL = 20.0     # % volumetric water content
WATER_STRESS_SOIL_MOISTURE_HIGH_RISK = 25.0    # % volumetric water content
WATER_STRESS_SOIL_MOISTURE_MEDIUM_RISK = 30.0  # % volumetric water content
WATER_STRESS_SOIL_MOISTURE_LOW_RISK = 35.0     # % volumetric water content
WATER_STRESS_TEMP_HIGH = 32.0                  # °C threshold for heat-induced evapotranspiration
WATER_STRESS_HUMIDITY_LOW = 35.0               # % RH threshold for vapor pressure deficit
WATER_STRESS_LOOKBACK_EVENTS = 10              # Number of historical telemetry events for trend analysis
WATER_STRESS_RECENT_RAIN_HOURS = 48            # Hours to check for recent rainfall

# Pest & Disease Risk Configuration (Favorable micro-climate conditions)
PEST_HUMIDITY_CRITICAL = 88.0                  # % RH sustained high moisture
PEST_HUMIDITY_HIGH = 80.0                      # % RH elevated pathogen favorability
PEST_HUMIDITY_MODERATE = 70.0                  # % RH mild favorability
PEST_TEMP_OPTIMAL_MIN = 20.0                   # °C lower bound for fungal spore germination
PEST_TEMP_OPTIMAL_MAX = 30.0                   # °C upper bound for fungal spore germination
PEST_RAINFALL_THRESHOLD = 2.0                  # mm precipitation promoting leaf wetness

# Nutrient Deficiency Configuration (Critical minimum thresholds)
NUTRIENT_N_LOW = 25.0                          # mg/kg (or ppm) Available Nitrogen
NUTRIENT_N_CRITICAL = 12.0                     # mg/kg Severe Nitrogen deficiency
NUTRIENT_P_LOW = 15.0                          # mg/kg (or ppm) Available Phosphorus
NUTRIENT_P_CRITICAL = 8.0                      # mg/kg Severe Phosphorus deficiency
NUTRIENT_K_LOW = 20.0                          # mg/kg (or ppm) Available Potassium
NUTRIENT_K_CRITICAL = 10.0                     # mg/kg Severe Potassium deficiency
SOIL_PH_ACIDIC = 5.5                           # pH threshold below which nutrient uptake is locked
SOIL_PH_ALKALINE = 8.0                         # pH threshold above which micronutrients are locked

# Telemetry Data Freshness Windows (Hours)
FRESH_THRESHOLD_HOURS = 2.0
STALE_THRESHOLD_HOURS = 12.0
VERY_STALE_THRESHOLD_HOURS = 24.0


class DetectedRisk:
    def __init__(
        self,
        risk_type: str,
        severity: str,
        score: float,
        confidence: float,
        evidence: Dict[str, Any],
        missing_information: Optional[List[str]] = None,
        agent: str = "rule_engine",
        agent_version: str = "1.0.0",
    ):
        self.risk_type = risk_type
        self.severity = severity
        self.score = round(max(0.0, min(1.0, score)), 2)
        self.confidence = round(max(0.0, min(1.0, confidence)), 2)
        self.evidence = evidence
        self.missing_information = missing_information or []
        self.agent = agent
        self.agent_version = agent_version


class RiskDetectionService:
    """
    Deterministic agronomic evaluation engine.
    Calculates water stress, pest/disease risk, and nutrient deficiency indicators.
    """

    @staticmethod
    def calculate_freshness(event_timestamp: Optional[datetime], now_utc: datetime) -> str:
        if not event_timestamp:
            return "very_stale"
        if event_timestamp.tzinfo is None:
            event_timestamp = event_timestamp.replace(tzinfo=timezone.utc)
        age_hours = (now_utc - event_timestamp).total_seconds() / 3600.0
        if age_hours <= FRESH_THRESHOLD_HOURS:
            return "fresh"
        if age_hours <= STALE_THRESHOLD_HOURS:
            return "moderate"
        if age_hours <= VERY_STALE_THRESHOLD_HOURS:
            return "stale"
        return "very_stale"

    @classmethod
    def detect_water_stress(
        cls,
        telemetry_history: List[SensorEvent],
        latest_telemetry: Dict[str, Any],
        observations: List[ExternalObservation],
        now_utc: datetime,
    ) -> Optional[DetectedRisk]:
        """
        Evaluates soil moisture levels, historical moisture trends, and ambient environmental stress.
        """
        # 1. Extract soil moisture
        soil_moisture_val = latest_telemetry.get("soil_moisture")
        if soil_moisture_val is None:
            soil_moisture_val = latest_telemetry.get("moisture")
        
        if soil_moisture_val is None:
            return None

        try:
            soil_moisture = float(soil_moisture_val)
        except (ValueError, TypeError):
            return None

        # If moisture is above low-risk threshold, crop is healthy -> No water stress
        if soil_moisture > WATER_STRESS_SOIL_MOISTURE_LOW_RISK:
            return None

        # 2. Extract ambient environmental stress signals
        temperature_val = latest_telemetry.get("air_temperature") or latest_telemetry.get("temperature") or latest_telemetry.get("temp")
        humidity_val = latest_telemetry.get("air_humidity") or latest_telemetry.get("humidity")
        rainfall_val = latest_telemetry.get("rainfall") or latest_telemetry.get("precipitation") or latest_telemetry.get("rain")

        temp = float(temperature_val) if temperature_val is not None else None
        humidity = float(humidity_val) if humidity_val is not None else None
        rain = float(rainfall_val) if rainfall_val is not None else 0.0

        # Check external observations for rainfall in last 48h
        recent_rain_obs = 0.0
        for obs in observations:
            if obs.type in ["weather_forecast", "rainfall", "weather_observation"]:
                p_rain = obs.payload.get("rainfall_mm") or obs.payload.get("precipitation") or obs.payload.get("rain")
                if p_rain:
                    recent_rain_obs += float(p_rain)

        total_recent_rain = max(rain, recent_rain_obs)

        # 3. Check historical trend from lookback readings
        moisture_series: List[float] = []
        for ev in telemetry_history[:WATER_STRESS_LOOKBACK_EVENTS]:
            m = (ev.measurements or {}).get("soil_moisture")
            if m is not None:
                try:
                    moisture_series.append(float(m))
                except (ValueError, TypeError):
                    pass

        has_declining_trend = False
        if len(moisture_series) >= 3:
            # Check if recent values are steadily dropping
            has_declining_trend = all(
                moisture_series[i] <= moisture_series[i + 1]
                for i in range(min(3, len(moisture_series) - 1))
            )

        # 4. Determine Rules & Severity
        rules_triggered: List[str] = ["low_soil_moisture"]
        signals_list: List[Dict[str, Any]] = [
            {"name": "soil_moisture", "value": soil_moisture, "unit": "%", "threshold": WATER_STRESS_SOIL_MOISTURE_LOW_RISK}
        ]

        high_temp = temp is not None and temp >= WATER_STRESS_TEMP_HIGH
        if high_temp:
            rules_triggered.append("high_ambient_temperature")
            signals_list.append({"name": "air_temperature", "value": temp, "unit": "°C", "threshold": WATER_STRESS_TEMP_HIGH})

        low_humidity = humidity is not None and humidity <= WATER_STRESS_HUMIDITY_LOW
        if low_humidity:
            rules_triggered.append("low_air_humidity")
            signals_list.append({"name": "air_humidity", "value": humidity, "unit": "%", "threshold": WATER_STRESS_HUMIDITY_LOW})

        if has_declining_trend:
            rules_triggered.append("declining_moisture_trend")

        little_or_no_rain = total_recent_rain < 1.0
        if little_or_no_rain:
            rules_triggered.append("zero_or_low_recent_rainfall")
            signals_list.append({"name": "rainfall_recent", "value": total_recent_rain, "unit": "mm"})

        # Severity Assessment
        if soil_moisture <= WATER_STRESS_SOIL_MOISTURE_CRITICAL:
            severity = "critical"
            score = 0.90
        elif soil_moisture <= WATER_STRESS_SOIL_MOISTURE_HIGH_RISK:
            if (high_temp or low_humidity) and little_or_no_rain:
                severity = "critical" if (high_temp and low_humidity) else "high"
                score = 0.85 if severity == "critical" else 0.75
            else:
                severity = "high"
                score = 0.70
        elif soil_moisture <= WATER_STRESS_SOIL_MOISTURE_MEDIUM_RISK:
            if high_temp and low_humidity:
                severity = "high"
                score = 0.70
            elif has_declining_trend or high_temp or low_humidity:
                severity = "medium"
                score = 0.55
            else:
                severity = "medium"
                score = 0.50
        else:  # 30.0 < soil_moisture <= 35.0
            severity = "low"
            score = 0.35

        # 5. Deterministic Confidence Calculation
        base_confidence = 0.70
        if high_temp and low_humidity:
            base_confidence += 0.15
        elif high_temp or low_humidity:
            base_confidence += 0.08

        if has_declining_trend:
            base_confidence += 0.10

        # Freshness adjustment
        latest_event_ts = telemetry_history[0].event_at if telemetry_history else now_utc
        freshness = cls.calculate_freshness(latest_event_ts, now_utc)
        if freshness == "fresh":
            base_confidence += 0.05
        elif freshness == "stale":
            base_confidence -= 0.20
        elif freshness == "very_stale":
            base_confidence -= 0.40

        confidence = max(0.15, min(0.98, base_confidence))

        explanation = (
            f"Soil moisture is critically low ({soil_moisture}%)" if severity in ["high", "critical"]
            else f"Soil moisture is below optimal threshold ({soil_moisture}%)"
        )
        if high_temp or low_humidity:
            explanation += f" with compounding atmospheric stress (temp: {temp or 'N/A'}°C, humidity: {humidity or 'N/A'}%)"
        if has_declining_trend:
            explanation += " and steady downward soil moisture trajectory."

        evidence = {
            "signals": signals_list,
            "rules_triggered": rules_triggered,
            "freshness": freshness,
            "explanation": explanation,
            "context": {
                "recent_rainfall_mm": total_recent_rain,
                "history_points_analyzed": len(moisture_series),
                "declining_trend": has_declining_trend,
            },
        }

        return DetectedRisk(
            risk_type="water_stress",
            severity=severity,
            score=score,
            confidence=confidence,
            evidence=evidence,
            missing_information=[] if (temp is not None and humidity is not None) else ["ambient_weather_context"],
            agent="water_stress_detector",
        )

    @classmethod
    def detect_pest_disease_risk(
        cls,
        latest_telemetry: Dict[str, Any],
        observations: List[ExternalObservation],
        telemetry_history: List[SensorEvent],
        now_utc: datetime,
    ) -> Optional[DetectedRisk]:
        """
        Evaluates microclimate favorability for fungal & bacterial disease proliferation.
        Outputs explainable risk probability without making definitive medical diagnoses.
        """
        humidity_val = latest_telemetry.get("air_humidity") or latest_telemetry.get("humidity")
        temperature_val = latest_telemetry.get("air_temperature") or latest_telemetry.get("temperature") or latest_telemetry.get("temp")
        rainfall_val = latest_telemetry.get("rainfall") or latest_telemetry.get("precipitation") or latest_telemetry.get("rain")

        humidity = float(humidity_val) if humidity_val is not None else None
        temperature = float(temperature_val) if temperature_val is not None else None
        rainfall = float(rainfall_val) if rainfall_val is not None else 0.0

        # Check external observations (weather forecast, drone, satellite)
        obs_humidity = None
        obs_rain = 0.0
        obs_pest_alert = False
        for obs in observations:
            payload = obs.payload or {}
            if "humidity" in payload:
                obs_humidity = float(payload["humidity"])
            if "rainfall_mm" in payload or "precipitation" in payload:
                obs_rain += float(payload.get("rainfall_mm") or payload.get("precipitation") or 0.0)
            if payload.get("pest_risk_alert") or payload.get("disease_warning"):
                obs_pest_alert = True

        effective_humidity = humidity if humidity is not None else obs_humidity
        effective_rain = max(rainfall, obs_rain)

        if effective_humidity is None and temperature is None:
            return None

        # Check conditions
        rules_triggered: List[str] = []
        signals_list: List[Dict[str, Any]] = []

        is_high_humidity = effective_humidity is not None and effective_humidity >= PEST_HUMIDITY_HIGH
        is_moderate_humidity = effective_humidity is not None and effective_humidity >= PEST_HUMIDITY_MODERATE and effective_humidity < PEST_HUMIDITY_HIGH
        is_warm_temp = temperature is not None and (PEST_TEMP_OPTIMAL_MIN <= temperature <= PEST_TEMP_OPTIMAL_MAX)
        has_wet_canopy = effective_rain >= PEST_RAINFALL_THRESHOLD

        if is_high_humidity:
            rules_triggered.append("sustained_high_relative_humidity")
            signals_list.append({"name": "air_humidity", "value": effective_humidity, "unit": "%", "threshold": PEST_HUMIDITY_HIGH})
        elif is_moderate_humidity:
            rules_triggered.append("moderate_relative_humidity")
            signals_list.append({"name": "air_humidity", "value": effective_humidity, "unit": "%", "threshold": PEST_HUMIDITY_MODERATE})

        if is_warm_temp:
            rules_triggered.append("optimal_pathogen_temperature_range")
            signals_list.append({"name": "air_temperature", "value": temperature, "unit": "°C", "range": f"{PEST_TEMP_OPTIMAL_MIN}-{PEST_TEMP_OPTIMAL_MAX}°C"})

        if has_wet_canopy:
            rules_triggered.append("recent_rainfall_leaf_wetness")
            signals_list.append({"name": "precipitation", "value": effective_rain, "unit": "mm", "threshold": PEST_RAINFALL_THRESHOLD})

        if obs_pest_alert:
            rules_triggered.append("external_pest_surveillance_alert")

        # Evaluate severity
        favorable_factors = len(rules_triggered)
        if favorable_factors == 0:
            return None

        if is_high_humidity and is_warm_temp and (has_wet_canopy or obs_pest_alert):
            if effective_humidity >= PEST_HUMIDITY_CRITICAL and (has_wet_canopy and obs_pest_alert):
                severity = "critical"
                score = 0.88
            else:
                severity = "high"
                score = 0.78
        elif is_high_humidity and is_warm_temp:
            severity = "high"
            score = 0.70
        elif (is_high_humidity or is_moderate_humidity) and (is_warm_temp or has_wet_canopy):
            severity = "medium"
            score = 0.50
        elif is_moderate_humidity or is_warm_temp:
            severity = "low"
            score = 0.30
        else:
            return None

        # Confidence calculation
        base_confidence = 0.45
        if favorable_factors >= 3:
            base_confidence += 0.35
        elif favorable_factors == 2:
            base_confidence += 0.20
        elif favorable_factors == 1:
            base_confidence += 0.05

        latest_event_ts = telemetry_history[0].event_at if telemetry_history else now_utc
        freshness = cls.calculate_freshness(latest_event_ts, now_utc)
        if freshness == "fresh":
            base_confidence += 0.08
        elif freshness == "stale":
            base_confidence -= 0.20
        elif freshness == "very_stale":
            base_confidence -= 0.35

        confidence = max(0.15, min(0.95, base_confidence))

        explanation = (
            f"Elevated pest and disease risk due to favorable microclimate conditions: "
            f"relative humidity at {effective_humidity or 'N/A'}% and temperature at {temperature or 'N/A'}°C."
        )

        evidence = {
            "signals": signals_list,
            "rules_triggered": rules_triggered,
            "freshness": freshness,
            "explanation": explanation,
            "context": {
                "favorable_signals_count": favorable_factors,
                "recent_rain_mm": effective_rain,
                "external_alert": obs_pest_alert,
            },
        }

        return DetectedRisk(
            risk_type="pest_disease",
            severity=severity,
            score=score,
            confidence=confidence,
            evidence=evidence,
            missing_information=[] if (temperature is not None and effective_humidity is not None) else ["incomplete_weather_telemetry"],
            agent="pest_disease_detector",
        )

    @classmethod
    def detect_nutrient_deficiency(
        cls,
        latest_telemetry: Dict[str, Any],
        telemetry_history: List[SensorEvent],
        now_utc: datetime,
    ) -> Optional[DetectedRisk]:
        """
        Evaluates N, P, K and soil pH telemetry readings when available.
        Does NOT trigger if N/P/K telemetry is missing.
        Does NOT invent fertilizer dosage or recommend application quantities.
        """
        nitrogen_val = latest_telemetry.get("nitrogen") or latest_telemetry.get("soil_nitrogen") or latest_telemetry.get("n")
        phosphorus_val = latest_telemetry.get("phosphorus") or latest_telemetry.get("soil_phosphorus") or latest_telemetry.get("p")
        potassium_val = latest_telemetry.get("potassium") or latest_telemetry.get("soil_potassium") or latest_telemetry.get("k")
        ph_val = latest_telemetry.get("soil_ph") or latest_telemetry.get("ph")

        # If NO nutrient telemetry is present at all, do NOT create assessment
        if nitrogen_val is None and phosphorus_val is None and potassium_val is None and ph_val is None:
            return None

        rules_triggered: List[str] = []
        signals_list: List[Dict[str, Any]] = []
        deficient_nutrients: List[str] = []

        # Check Nitrogen
        if nitrogen_val is not None:
            try:
                n = float(nitrogen_val)
                if n < NUTRIENT_N_LOW:
                    deficient_nutrients.append("nitrogen")
                    rules_triggered.append("low_soil_nitrogen")
                    signals_list.append({"name": "nitrogen", "value": n, "unit": "mg/kg", "threshold": NUTRIENT_N_LOW})
            except (ValueError, TypeError):
                pass

        # Check Phosphorus
        if phosphorus_val is not None:
            try:
                p = float(phosphorus_val)
                if p < NUTRIENT_P_LOW:
                    deficient_nutrients.append("phosphorus")
                    rules_triggered.append("low_soil_phosphorus")
                    signals_list.append({"name": "phosphorus", "value": p, "unit": "mg/kg", "threshold": NUTRIENT_P_LOW})
            except (ValueError, TypeError):
                pass

        # Check Potassium
        if potassium_val is not None:
            try:
                k = float(potassium_val)
                if k < NUTRIENT_K_LOW:
                    deficient_nutrients.append("potassium")
                    rules_triggered.append("low_soil_potassium")
                    signals_list.append({"name": "potassium", "value": k, "unit": "mg/kg", "threshold": NUTRIENT_K_LOW})
            except (ValueError, TypeError):
                pass

        # Check pH
        if ph_val is not None:
            try:
                ph = float(ph_val)
                if ph < SOIL_PH_ACIDIC or ph > SOIL_PH_ALKALINE:
                    rules_triggered.append("suboptimal_soil_ph_bioavailability")
                    signals_list.append({"name": "soil_ph", "value": ph, "unit": "pH", "optimal_range": f"{SOIL_PH_ACIDIC}-{SOIL_PH_ALKALINE}"})
            except (ValueError, TypeError):
                pass

        # If all measured nutrients are within healthy ranges, no risk
        if not rules_triggered:
            return None

        # Severity
        if len(deficient_nutrients) >= 3 or ("low_soil_nitrogen" in rules_triggered and any(s["value"] < NUTRIENT_N_CRITICAL for s in signals_list if s["name"] == "nitrogen")):
            severity = "high"
            score = 0.80
        elif len(deficient_nutrients) >= 2 or "low_soil_nitrogen" in rules_triggered:
            severity = "medium"
            score = 0.60
        else:
            severity = "low"
            score = 0.40

        # Confidence
        base_confidence = 0.75
        if len(signals_list) >= 2:
            base_confidence += 0.10

        latest_event_ts = telemetry_history[0].event_at if telemetry_history else now_utc
        freshness = cls.calculate_freshness(latest_event_ts, now_utc)
        if freshness == "stale":
            base_confidence -= 0.20
        elif freshness == "very_stale":
            base_confidence -= 0.40

        confidence = max(0.20, min(0.95, base_confidence))

        nutrient_names = ", ".join(deficient_nutrients) if deficient_nutrients else "soil bioavailability (pH)"
        explanation = f"Nutrient deficiency risk detected: suboptimal levels for {nutrient_names}."

        evidence = {
            "signals": signals_list,
            "rules_triggered": rules_triggered,
            "freshness": freshness,
            "explanation": explanation,
            "context": {
                "deficient_nutrients": deficient_nutrients,
                "total_indicators_evaluated": len(signals_list),
            },
        }

        return DetectedRisk(
            risk_type="nutrient_deficiency",
            severity=severity,
            score=score,
            confidence=confidence,
            evidence=evidence,
            missing_information=[],
            agent="nutrient_detector",
        )

    # =====================================================================
    # EVALUATION & LIFECYCLE MANAGEMENT (DEDUPLICATION / PERSISTENCE)
    # =====================================================================

    @classmethod
    async def evaluate_zone(
        cls,
        session: AsyncSession,
        farm_id: str,
        zone_id: Optional[str],
        telemetry_override: Optional[Dict[str, Any]] = None,
        actor_id: str = "rule_engine",
    ) -> List[RiskAssessment]:
        """
        Executes full deterministic risk assessment pipeline for a specific farm & zone.
        Updates existing OPEN risks in-place to prevent duplicate rows.
        """
        now_utc = datetime.now(timezone.utc)

        # 1. Fetch recent telemetry history
        query = select(SensorEvent).where(SensorEvent.farm_id == farm_id)
        if zone_id:
            query = query.where(SensorEvent.zone_id == zone_id)
        query = query.order_by(desc(SensorEvent.event_at)).limit(20)
        res = await session.execute(query)
        telemetry_history = list(res.scalars().all())

        # Construct latest telemetry dictionary
        latest_telemetry: Dict[str, Any] = {}
        for ev in reversed(telemetry_history):
            if ev.measurements:
                latest_telemetry.update(ev.measurements)
            elif ev.metric and ev.metric != "multi":
                latest_telemetry[ev.metric] = ev.value

        if telemetry_override:
            latest_telemetry.update(telemetry_override)

        # 2. Fetch active external observations
        obs_query = select(ExternalObservation).where(
            ExternalObservation.farm_id == farm_id,
            ExternalObservation.status == "active",
        )
        if zone_id:
            obs_query = obs_query.where(
                (ExternalObservation.zone_id == zone_id) | (ExternalObservation.zone_id.is_(None))
            )
        obs_res = await session.execute(obs_query)
        observations = list(obs_res.scalars().all())

        # 3. Run deterministic detectors
        detected_risks: List[DetectedRisk] = []

        water_risk = cls.detect_water_stress(
            telemetry_history=telemetry_history,
            latest_telemetry=latest_telemetry,
            observations=observations,
            now_utc=now_utc,
        )
        if water_risk:
            detected_risks.append(water_risk)

        pest_risk = cls.detect_pest_disease_risk(
            latest_telemetry=latest_telemetry,
            observations=observations,
            telemetry_history=telemetry_history,
            now_utc=now_utc,
        )
        if pest_risk:
            detected_risks.append(pest_risk)

        nutrient_risk = cls.detect_nutrient_deficiency(
            latest_telemetry=latest_telemetry,
            telemetry_history=telemetry_history,
            now_utc=now_utc,
        )
        if nutrient_risk:
            detected_risks.append(nutrient_risk)

        # 4. Deduplicate and persist / update lifecycle
        persisted_risks: List[RiskAssessment] = []

        for detected in detected_risks:
            # Query for an existing OPEN or ACKNOWLEDGED risk assessment
            existing_query = select(RiskAssessment).where(
                RiskAssessment.farm_id == farm_id,
                RiskAssessment.zone_id == zone_id,
                RiskAssessment.risk_type == detected.risk_type,
                RiskAssessment.status.in_(["open", "acknowledged"]),
            )
            existing_res = await session.execute(existing_query)
            existing_risk = existing_res.scalar_one_or_none()

            if existing_risk:
                # Update existing record in-place to avoid duplicate rows
                old_severity = existing_risk.severity
                old_status = existing_risk.status

                existing_risk.severity = detected.severity
                existing_risk.score = detected.score
                existing_risk.confidence = detected.confidence
                existing_risk.evidence = detected.evidence
                existing_risk.missing_information = detected.missing_information
                existing_risk.agent = detected.agent
                existing_risk.agent_version = detected.agent_version
                existing_risk.updated_at = now_utc

                # Only emit audit event if severity changed
                if old_severity != detected.severity:
                    await AuditService.log_event(
                        session=session,
                        event_type="risk_updated",
                        entity_type="risk_assessment",
                        farm_id=farm_id,
                        entity_id=existing_risk.id,
                        actor_id=actor_id,
                        before_state={"severity": old_severity, "status": old_status},
                        after_state={"severity": detected.severity, "status": existing_risk.status},
                        source="rule_engine",
                    )
                persisted_risks.append(existing_risk)
            else:
                # Create brand new risk assessment
                new_risk = RiskAssessment(
                    farm_id=farm_id,
                    zone_id=zone_id,
                    risk_type=detected.risk_type,
                    severity=detected.severity,
                    score=detected.score,
                    confidence=detected.confidence,
                    evidence=detected.evidence,
                    missing_information=detected.missing_information,
                    status="open",
                    agent=detected.agent,
                    agent_version=detected.agent_version,
                )
                session.add(new_risk)
                await session.flush()

                await AuditService.log_event(
                    session=session,
                    event_type="risk_created",
                    entity_type="risk_assessment",
                    farm_id=farm_id,
                    entity_id=new_risk.id,
                    actor_id=actor_id,
                    after_state={
                        "risk_type": new_risk.risk_type,
                        "severity": new_risk.severity,
                        "confidence": new_risk.confidence,
                        "zone_id": zone_id,
                    },
                    source="rule_engine",
                )
                persisted_risks.append(new_risk)

        await session.commit()
        for r in persisted_risks:
            await session.refresh(r)

        return persisted_risks

    @classmethod
    async def evaluate_farm(
        cls,
        session: AsyncSession,
        farm_id: str,
        telemetry_override: Optional[Dict[str, Any]] = None,
        actor_id: str = "rule_engine",
    ) -> List[RiskAssessment]:
        """
        Evaluates farm-level and all zone-level risks for a given farm.
        """
        # Get all zones for this farm
        zones_res = await session.execute(select(Zone).where(Zone.farm_id == farm_id))
        zones = list(zones_res.scalars().all())

        all_risks: List[RiskAssessment] = []

        # Evaluate farm-wide telemetry (zone_id is None)
        farm_risks = await cls.evaluate_zone(
            session=session,
            farm_id=farm_id,
            zone_id=None,
            telemetry_override=telemetry_override,
            actor_id=actor_id,
        )
        all_risks.extend(farm_risks)

        # Evaluate each zone
        for zone in zones:
            z_risks = await cls.evaluate_zone(
                session=session,
                farm_id=farm_id,
                zone_id=zone.id,
                telemetry_override=telemetry_override,
                actor_id=actor_id,
            )
            all_risks.extend(z_risks)

        return all_risks
