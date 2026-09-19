# FarmOps AI — Frontend API Contract (v1.0.0)

This document is the authoritative API contract between the **FarmOps AI Backend** and the **Frontend Dashboard (Next.js / Vite / React)**.
All endpoints adhere strictly to version `v1` located under `/api/v1`.

---

## 1. Global Conventions & Architecture

### A. Base URL
- **Local Development**: `http://localhost:8000/api/v1`
- **Staging / Production**: `https://<api-domain>/api/v1`
- **Interactive Swagger Documentation**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **OpenAPI 3.1 JSON Specification**: `http://localhost:8000/api/v1/openapi.json`

---

### B. Authentication & Authorization
All endpoints (except `/health`, `/health/db`, and `/demo/status`) require standard Supabase Auth JWTs.

- **Header**:
  ```http
  Authorization: Bearer <supabase_access_token>
  ```
- **Token Source**: Retrieved from `@supabase/supabase-js` via `supabase.auth.getSession()` / `session.access_token`.
- **Identity & RBAC**: The backend extracts `sub` (User UUID), `email`, and roles (`owner`, `manager`, `agronomist`, `operator`, `viewer`).
- **Farm Isolation**: Every resource is strictly scoped to `farm_id`. Access to another farm's data yields `403 Forbidden` or `404 Not Found`.

---

### C. Standard Response Envelope (`APIResponse<T>`)
Every successful JSON response is wrapped in a consistent generic envelope:

```json
{
  "success": true,
  "message": "Operation description or null",
  "data": { ... }
}
```

- When returning collections/lists, `data` contains an array `[...]`.
- When returning single entity resources, `data` contains an object `{ ... }`.

---

### D. Standard Error Envelope (`APIError`)
When an error occurs (HTTP 4xx / 5xx), the backend returns:

```json
{
  "success": false,
  "message": "Human-readable error explanation",
  "data": null,
  "error": {
    "code": "ERROR_CODE_ENUM",
    "message": "Detailed error message",
    "details": null
  }
}
```

#### Standard Error Codes
| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `BAD_REQUEST` | Malformed parameters or invalid payload constraints |
| `401` | `AUTHENTICATION_REQUIRED` | Missing, expired, or malformed Bearer token |
| `403` | `FORBIDDEN` | Caller lacks membership or necessary role for the farm |
| `404` | `NOT_FOUND` | Requested entity (farm, zone, device, task, plan, etc.) does not exist |
| `409` | `CONFLICT` | Resource collision (e.g. duplicate unique key, invalid state transition) |
| `422` | `UNPROCESSABLE_ENTITY` | Pydantic validation error (e.g. soil moisture < 0 or > 100) |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected backend error |
| `502` | `AI_PROVIDER_ERROR` | Upstream AI provider (e.g. Gemini) service failure |
| `503` | `SERVICE_UNAVAILABLE` | Database or essential infrastructure unreachable |

---

### E. Pagination & Filtering Conventions
Endpoints supporting pagination use 1-indexed query parameters:
- `page`: Integer $\ge 1$ (default: `1`)
- `page_size`: Integer between $1$ and $100$ (default: `20` or `50`)
- `limit` / `offset`: Supported on time-series telemetry and audit queries.

---

### F. Date/Time Format
- All timestamps in request bodies and responses are strict **ISO-8601 UTC strings** formatted as `YYYY-MM-DDTHH:MM:SSZ` or `YYYY-MM-DDTHH:MM:SS.mmmmmmZ` (e.g., `2026-09-19T10:00:00Z`).

---

## 2. Dashboard Data Mappings

| Dashboard View | Primary Endpoint(s) | Data Returned |
| :--- | :--- | :--- |
| **Farm Overview** | `GET /api/v1/farms/{farm_id}`<br>`GET /api/v1/farms/{farm_id}/zones`<br>`GET /api/v1/farms/{farm_id}/devices` | Farm boundary/metadata, active zones, device statuses, battery/last-seen |
| **Zone Monitoring** | `GET /api/v1/zones/{zone_id}`<br>`GET /api/v1/telemetry/{farm_id}/events?zone_id={zone_id}` | Soil moisture, temperature, humidity, rainfall, pH, N/P/K, reading timestamps |
| **Risk Monitoring** | `GET /api/v1/farms/{farm_id}/risks`<br>`GET /api/v1/risks/detail/{risk_id}` | Active risks, severity, score, confidence, rule evidence signals, timestamps |
| **Weather & External** | `GET /api/v1/observations/farm/{farm_id}` | Weather forecasts, satellite NDVI, drone surveys, market context, freshness |
| **AI Advisory** | `POST /api/v1/ai/evaluate-risk` | Structured advisory proposal, agronomic rationale, confidence, SafetyGuard decision |
| **Action Plans** | `GET /api/v1/farms/{farm_id}/action-plans`<br>`GET /api/v1/action-plans/{plan_id}` | Plan title, objective, priority, safety state, approval state, ordered steps |
| **Field Tasks** | `GET /api/v1/farms/{farm_id}/tasks`<br>`GET /api/v1/tasks/detail/{task_id}` | Pending/in-progress/completed tasks, assignees, checklists, due dates, execution logs |
| **Alerts & Alarms** | `GET /api/v1/alerts/{farm_id}`<br>`POST /api/v1/alerts/{alert_id}/acknowledge` | Active alerts, severity (`info`/`warning`/`critical`), deduplication key, ack status |
| **Audit Timeline** | `GET /api/v1/audit?farm_id={farm_id}` | Immutable audit events, actor ID, before/after states, source, model version |
| **One-Click Demo** | `POST /api/v1/demo/run`<br>`GET /api/v1/demo/status` | Instant end-to-end execution of the full multi-agent pipeline with step artifacts |

---

## 3. Comprehensive Endpoint Specifications & Examples

---

### AUTHENTICATION / CURRENT USER

#### `GET /api/v1/auth/me`
Retrieves authenticated user profile and metadata from the validated Supabase JWT.

- **Auth**: Required (`Bearer <token>`)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": null,
    "data": {
      "id": "usr_94b415a7-742a-4384-8802-123456789abc",
      "email": "operator@farmops.ai",
      "role": "authenticated",
      "user_metadata": {
        "full_name": "Elena Rostova",
        "organization": "Greenfield Ag"
      },
      "app_metadata": {
        "provider": "email"
      }
    }
  }
  ```

---

### FARMS MANAGEMENT

#### `POST /api/v1/farms`
Creates a new farm. Caller is automatically assigned as `owner`.

- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "Salinas Precision Valley Farm",
    "location": "Salinas, CA",
    "address": "1000 Harvest Way, Salinas, CA 93901",
    "timezone": "America/Los_Angeles",
    "total_area": 120.5,
    "area_unit": "hectare",
    "boundary_geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [-121.6555, 36.6777],
          [-121.6500, 36.6777],
          [-121.6500, 36.6700],
          [-121.6555, 36.6700],
          [-121.6555, 36.6777]
        ]
      ]
    },
    "crop_profile": {
      "primary_crop": "Lettuce",
      "soil_type": "Loam"
    },
    "policies": {
      "max_irrigation_rate_mm_hr": 25.0,
      "chemical_safety_checks": true
    },
    "is_demo": false
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Farm created successfully",
    "data": {
      "id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
      "name": "Salinas Precision Valley Farm",
      "location": "Salinas, CA",
      "address": "1000 Harvest Way, Salinas, CA 93901",
      "timezone": "America/Los_Angeles",
      "total_area": 120.5,
      "area_unit": "hectare",
      "boundary_geometry": { ... },
      "crop_profile": { ... },
      "policies": { ... },
      "is_demo": false,
      "owner_id": "usr_94b415a7-742a-4384-8802-123456789abc",
      "zones": [],
      "created_at": "2026-09-19T10:00:00Z",
      "updated_at": "2026-09-19T10:00:00Z"
    }
  }
  ```

#### `GET /api/v1/farms`
Lists all farms accessible to the caller.
- **Parameters**: `page` (int, default: 1), `page_size` (int, default: 50)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Retrieved 1 of 1 farms",
    "data": [
      {
        "id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
        "name": "Salinas Precision Valley Farm",
        "location": "Salinas, CA",
        "timezone": "America/Los_Angeles",
        "total_area": 120.5,
        "area_unit": "hectare",
        "is_demo": false,
        "owner_id": "usr_94b415a7-742a-4384-8802-123456789abc",
        "zones": [],
        "created_at": "2026-09-19T10:00:00Z",
        "updated_at": "2026-09-19T10:00:00Z"
      }
    ]
  }
  ```

#### `GET /api/v1/farms/{farm_id}`
- **Success Response (200 OK)**: Single `FarmResponse` object with nested `zones`.

#### `PATCH /api/v1/farms/{farm_id}`
- **Request Body**: Partial `FarmUpdate` fields (`name`, `timezone`, `total_area`, `crop_profile`, `policies`, etc.).
- **Success Response (200 OK)**: Updated `FarmResponse`.

#### `DELETE /api/v1/farms/{farm_id}`
- **Success Response (200 OK)**: `{"success": true, "message": "Farm deleted successfully", "data": true}`

---

### FARM MEMBERSHIPS

#### `POST /api/v1/farms/{farm_id}/members`
- **Request Body**: `{"user_id": "usr_target_uuid", "role": "agronomist"}` (roles: `owner`, `manager`, `agronomist`, `operator`, `viewer`)
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Membership granted",
    "data": {
      "id": "mem_12345",
      "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
      "user_id": "usr_target_uuid",
      "role": "agronomist",
      "created_at": "2026-09-19T10:05:00Z",
      "updated_at": "2026-09-19T10:05:00Z"
    }
  }
  ```

#### `GET /api/v1/farms/{farm_id}/members`
- **Success Response (200 OK)**: List of `FarmMembershipResponse`.

---

### ZONES MANAGEMENT

#### `POST /api/v1/farms/{farm_id}/zones`
- **Request Body**:
  ```json
  {
    "name": "Sector Alpha - Drip Block 1",
    "area": 15.5,
    "area_unit": "hectare",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[-121.655, 36.677], [-121.652, 36.677], [-121.652, 36.674], [-121.655, 36.674], [-121.655, 36.677]]]
    },
    "crop": "Tomato",
    "crop_stage": "vegetative",
    "soil_type": "Loam",
    "status": "active",
    "is_demo": false
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Zone created successfully",
    "data": {
      "id": "zone_a1b2c3d4-0001",
      "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
      "name": "Sector Alpha - Drip Block 1",
      "area": 15.5,
      "area_unit": "hectare",
      "crop": "Tomato",
      "crop_stage": "vegetative",
      "soil_type": "Loam",
      "status": "active",
      "is_demo": false,
      "created_at": "2026-09-19T10:00:00Z",
      "updated_at": "2026-09-19T10:00:00Z"
    }
  }
  ```

#### `GET /api/v1/farms/{farm_id}/zones`
- **Success Response (200 OK)**: List of `ZoneResponse`.

#### `GET /api/v1/zones/{zone_id}`
*(Alias: `GET /api/v1/farms/zones/{zone_id}`)*
- **Success Response (200 OK)**: Single `ZoneResponse`.

#### `PATCH /api/v1/zones/{zone_id}`
- **Request Body**: Partial `ZoneUpdate` (`name`, `crop`, `crop_stage`, `status`, `area`, etc.).
- **Success Response (200 OK)**: Updated `ZoneResponse`.

---

### DEVICES & SENSOR NODES

#### `POST /api/v1/farms/{farm_id}/devices`
*(Alias: `POST /api/v1/devices/{farm_id}`)*
- **Request Body**:
  ```json
  {
    "zone_id": "zone_a1b2c3d4-0001",
    "device_type": "soil_moisture",
    "calibration": {
      "depth_cm": 30,
      "baseline_dry": 10.0,
      "field_capacity": 38.0
    },
    "credential_reference": "SN-ESP32-SOIL-001",
    "enabled": true,
    "is_demo": false
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Device registered successfully",
    "data": {
      "id": "dev_99887766-0001",
      "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
      "zone_id": "zone_a1b2c3d4-0001",
      "device_type": "soil_moisture",
      "calibration": { ... },
      "credential_reference": "SN-ESP32-SOIL-001",
      "enabled": true,
      "is_demo": false,
      "last_seen_at": null,
      "created_at": "2026-09-19T10:00:00Z",
      "updated_at": "2026-09-19T10:00:00Z"
    }
  }
  ```

#### `GET /api/v1/farms/{farm_id}/devices`
*(Alias: `GET /api/v1/devices/farm/{farm_id}`)*
- **Parameters**: `zone_id` (optional)
- **Success Response (200 OK)**: List of `DeviceResponse`.

#### `GET /api/v1/devices/{device_id}`
- **Success Response (200 OK)**: Single `DeviceResponse`.

#### `PATCH /api/v1/devices/{device_id}`
- **Request Body**: Partial `DeviceUpdate` (`zone_id`, `device_type`, `calibration`, `enabled`).
- **Success Response (200 OK)**: Updated `DeviceResponse`.

---

### TELEMETRY INGESTION & TIME-SERIES

#### `POST /api/v1/telemetry/events`
Canonical edge/frontend telemetry ingestion endpoint. Normalizes measurement keys, bounds check values, guarantees idempotency per `(device_id, sequence)`.

- **Request Body**:
  ```json
  {
    "device_id": "dev_99887766-0001",
    "sequence": 1042,
    "event_timestamp": "2026-09-19T10:15:00Z",
    "measurements": {
      "soil_moisture": 14.2,
      "temperature": 28.5,
      "humidity": 45.0,
      "ph": 6.8,
      "nitrogen": 18.0,
      "phosphorus": 8.5,
      "potassium": 110.0
    },
    "unit_system": "metric",
    "metadata": {
      "battery_v": 3.95,
      "rssi_dbm": -68
    }
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Telemetry event ingested successfully",
    "data": {
      "id": "evt_55443322-0001",
      "device_id": "dev_99887766-0001",
      "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
      "zone_id": "zone_a1b2c3d4-0001",
      "sequence": 1042,
      "event_timestamp": "2026-09-19T10:15:00Z",
      "received_at": "2026-09-19T10:15:01Z",
      "measurements": {
        "soil_moisture": 14.2,
        "temperature": 28.5,
        "humidity": 45.0,
        "ph": 6.8,
        "nitrogen": 18.0,
        "phosphorus": 8.5,
        "potassium": 110.0
      },
      "unit_system": "metric",
      "duplicate": false,
      "status": "accepted",
      "metadata": { "battery_v": 3.95, "rssi_dbm": -68 }
    }
  }
  ```

#### `GET /api/v1/telemetry/{farm_id}/events`
Queries historical time-series sensor events for charts and graphs.
- **Parameters**:
  - `zone_id` (string, optional)
  - `device_id` (string, optional)
  - `metric` (string, optional, e.g. `soil_moisture`)
  - `start_time` (ISO-8601 string, optional)
  - `end_time` (ISO-8601 string, optional)
  - `limit` (int, default: 100, max: 1000)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": null,
    "data": [
      {
        "id": "evt_55443322-0001",
        "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
        "zone_id": "zone_a1b2c3d4-0001",
        "device_id": "dev_99887766-0001",
        "sequence": 1042,
        "event_timestamp": "2026-09-19T10:15:00Z",
        "soil_moisture": 14.2,
        "temperature": 28.5,
        "humidity": 45.0,
        "ph": 6.8,
        "nitrogen": 18.0,
        "phosphorus": 8.5,
        "potassium": 110.0,
        "battery_level": 3.95
      }
    ]
  }
  ```

---

### EXTERNAL OBSERVATIONS (WEATHER / SATELLITE / MARKET)

#### `POST /api/v1/observations`
Ingests external context data (e.g. Open-Meteo weather forecasts, Sentinel-2 NDVI imagery indices).

- **Request Body**:
  ```json
  {
    "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
    "zone_id": "zone_a1b2c3d4-0001",
    "source": "openmeteo",
    "observation_type": "rainfall_forecast",
    "observed_at": "2026-09-19T10:00:00Z",
    "payload": {
      "precipitation_next_24h_mm": 0.0,
      "precipitation_probability": 5,
      "temp_max_c": 33.2,
      "wind_speed_kmh": 14.5
    },
    "source_reference": "STATION-SALINAS-NORTH",
    "freshness": "fresh"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Observation ingested successfully",
    "data": {
      "id": "obs_77665544-0001",
      "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
      "zone_id": "zone_a1b2c3d4-0001",
      "source": "openmeteo",
      "observation_type": "rainfall_forecast",
      "observed_at": "2026-09-19T10:00:00Z",
      "payload": { ... },
      "source_reference": "STATION-SALINAS-NORTH",
      "freshness": "fresh",
      "status": "active",
      "fetched_at": "2026-09-19T10:00:01Z",
      "created_at": "2026-09-19T10:00:01Z",
      "duplicate": false
    }
  }
  ```

#### `GET /api/v1/observations/farm/{farm_id}`
- **Parameters**: `zone_id` (optional), `source` (optional), `observation_type` (optional), `page` (default: 1), `page_size` (default: 50)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": null,
    "data": {
      "items": [ { ... } ],
      "total": 1,
      "page": 1,
      "page_size": 50
    }
  }
  ```

---

### RISK DETECTION & EVALUATION

#### `POST /api/v1/risks/detect`
Executes the deterministic agronomic risk detection engine across latest telemetry and observations.

- **Request Body**:
  ```json
  {
    "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
    "zone_id": "zone_a1b2c3d4-0001",
    "telemetry_override": null
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Deterministic risk evaluation complete. 1 active risks assessed.",
    "data": [
      {
        "id": "risk_33221100-0001",
        "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
        "zone_id": "zone_a1b2c3d4-0001",
        "risk_type": "water_stress",
        "severity": "high",
        "score": 0.85,
        "confidence": 0.95,
        "evidence": {
          "signals": [
            { "name": "soil_moisture", "value": 14.2, "unit": "%", "observed_at": "2026-09-19T10:15:00Z" },
            { "name": "temperature", "value": 28.5, "unit": "°C", "observed_at": "2026-09-19T10:15:00Z" }
          ],
          "rules_triggered": ["CRITICAL_SOIL_MOISTURE_DEPLETION", "NO_IMMINENT_RAINFALL"],
          "freshness": "fresh",
          "explanation": "Soil moisture is critically below the 18.0% threshold with zero forecasted rain in next 24h."
        },
        "missing_information": [],
        "status": "open",
        "agent": "deterministic_risk_engine",
        "agent_version": "1.0.0",
        "created_at": "2026-09-19T10:15:05Z",
        "updated_at": "2026-09-19T10:15:05Z"
      }
    ]
  }
  ```

#### `GET /api/v1/farms/{farm_id}/risks`
*(Alias: `GET /api/v1/risks/{farm_id}`)*
- **Parameters**: `zone_id`, `risk_type`, `severity` (`low`, `medium`, `high`, `critical`), `status` (`open`, `acknowledged`, `resolved`, `dismissed`), `page`, `page_size`
- **Success Response (200 OK)**: List of `RiskAssessmentResponse`.

#### `GET /api/v1/risks/detail/{risk_id}`
*(Alias: `GET /api/v1/risks/{risk_id}`)*
- **Success Response (200 OK)**: Single `RiskAssessmentResponse`.

---

### AI ADVISORY & SAFETY EVALUATION

#### `POST /api/v1/ai/evaluate-risk`
Specialized AI Agent (Water / Pest / Nutrient / Market) reasons over agronomic context and subjects the generated recommendation to the deterministic SafetyGuard.

- **Request Body**:
  ```json
  {
    "risk_id": "risk_33221100-0001"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "AI evaluation complete by WATER_AGENT. Safety policy: ALLOW.",
    "data": {
      "risk": {
        "id": "risk_33221100-0001",
        "risk_type": "water_stress",
        "severity": "high",
        "score": 0.85
      },
      "proposal": {
        "agent_type": "WATER_AGENT",
        "risk_type": "water_stress",
        "recommendation": "Execute drip irrigation cycle in Sector Alpha for 45 minutes delivering approximately 18mm equivalent water.",
        "rationale": "Soil moisture at 14.2% is below the wilting threshold for Tomato in vegetative stage. High ambient temperature (28.5°C) and zero forecast rain necessitate immediate soil replenishment.",
        "confidence": 0.94,
        "urgency": "high",
        "evidence_refs": ["soil_moisture:14.2%", "temp:28.5C", "rain_forecast_24h:0mm"],
        "assumptions": ["Drip emitter flow rate nominal at 2.2 L/hr", "Root zone depth 30cm"],
        "uncertainty": "Low uncertainty. Sensor telemetry is fresh and corroborated.",
        "requires_human_review": false,
        "safety_notes": "Application rate 18mm is within safe zone limit of 25mm/hr."
      },
      "safety": {
        "decision": "allow",
        "approval_required": false,
        "safety_flags": [],
        "rationale": "Irrigation rate within certified limits. No restricted chemical application.",
        "requires_escalation": false
      }
    }
  }
  ```

---

### ACTION PLANS & HUMAN APPROVALS

#### `POST /api/v1/action-plans`
*(Alias: `POST /api/v1/plans`)*
Creates a safety-gated Action Plan. If safety decision is `ALLOW`, an executable Task is automatically generated. If `APPROVAL_REQUIRED`, status is set to `pending_approval`.

- **Request Body**:
  ```json
  {
    "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
    "zone_id": "zone_a1b2c3d4-0001",
    "risk_id": "risk_33221100-0001",
    "title": "Irrigation Cycle - Sector Alpha",
    "objective": "Restore root zone soil moisture to target field capacity (25%)",
    "action_type": "irrigation",
    "action_summary": "45-minute precision drip irrigation cycle",
    "priority": "high",
    "confidence": 0.94,
    "rationale": "Root zone moisture below wilting point",
    "estimated_duration_minutes": 45,
    "steps": [
      {
        "step_number": 1,
        "title": "Check main drip line pressure",
        "description": "Ensure line pressure reaches 1.8 bar before opening sub-valves.",
        "status": "pending"
      },
      {
        "step_number": 2,
        "title": "Run Zone 1 irrigation valve",
        "description": "Deliver 18mm irrigation volume over 45 minutes.",
        "status": "pending"
      }
    ]
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Action plan created successfully.",
    "data": {
      "id": "plan_11223344-0001",
      "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
      "zone_id": "zone_a1b2c3d4-0001",
      "risk_id": "risk_33221100-0001",
      "title": "Irrigation Cycle - Sector Alpha",
      "objective": "Restore root zone soil moisture to target field capacity (25%)",
      "action_type": "irrigation",
      "action_summary": "45-minute precision drip irrigation cycle",
      "priority": "high",
      "confidence": 0.94,
      "approval_required": false,
      "requires_human_approval": false,
      "approval_state": "approved",
      "status": "approved",
      "policy_decision": "ALLOW",
      "safety_status": "ALLOW",
      "steps": [ ... ],
      "version": 1,
      "created_at": "2026-09-19T10:15:10Z",
      "updated_at": "2026-09-19T10:15:10Z"
    }
  }
  ```

#### `GET /api/v1/farms/{farm_id}/action-plans`
*(Alias: `GET /api/v1/plans/{farm_id}`)*
- **Parameters**: `zone_id`, `policy_decision` (`ALLOW`, `APPROVAL_REQUIRED`, `ESCALATE`, `REJECT`), `approval_state` (`pending_approval`, `approved`, `rejected`, `completed`), `limit`
- **Success Response (200 OK)**: List of `ActionPlanResponse`.

#### `GET /api/v1/action-plans/{action_plan_id}`
*(Alias: `GET /api/v1/plans/detail/{plan_id}`)*
- **Success Response (200 OK)**: Single `ActionPlanResponse`.

#### `POST /api/v1/action-plans/{action_plan_id}/approve`
*(Alias: `POST /api/v1/plans/{plan_id}/approve`)*
Human sign-off for safety-gated plans (e.g. chemical applications or high-urgency interventions).
- **Request Body**:
  ```json
  {
    "decision": "approved",
    "review_notes": "Checked weather forecast and verified wind speed is calm."
  }
  ```
- **Success Response (200 OK)**: Updated `ActionPlanResponse` in `approved` state. Automatically spawns field task.

#### `POST /api/v1/action-plans/{action_plan_id}/reject`
*(Alias: `POST /api/v1/plans/{plan_id}/reject`)*
- **Request Body**:
  ```json
  {
    "decision": "rejected",
    "review_notes": "Heavy rain unexpected cloudburst occurred."
  }
  ```
- **Success Response (200 OK)**: Updated `ActionPlanResponse` in `rejected` state.

---

### FIELD TASKS LIFECYCLE

#### `GET /api/v1/farms/{farm_id}/tasks`
*(Alias: `GET /api/v1/tasks/{farm_id}`)*
- **Parameters**: `zone_id`, `status` (`pending`, `assigned`, `in_progress`, `completed`, `cancelled`, `blocked`), `limit`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": null,
    "data": [
      {
        "id": "task_44556677-0001",
        "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
        "zone_id": "zone_a1b2c3d4-0001",
        "plan_id": "plan_11223344-0001",
        "action_plan_id": "plan_11223344-0001",
        "title": "Irrigation Cycle - Sector Alpha",
        "description": "45-minute precision drip irrigation cycle",
        "priority": "high",
        "status": "pending",
        "assignee_id": null,
        "due_from": "2026-09-19T10:15:00Z",
        "due_until": "2026-09-19T14:00:00Z",
        "checklist": [
          { "step_number": 1, "title": "Check main drip line pressure", "status": "pending" },
          { "step_number": 2, "title": "Run Zone 1 irrigation valve", "status": "pending" }
        ],
        "created_at": "2026-09-19T10:15:10Z",
        "updated_at": "2026-09-19T10:15:10Z"
      }
    ]
  }
  ```

#### `GET /api/v1/tasks/detail/{task_id}`
- **Success Response (200 OK)**: Single `TaskResponse`.

#### `POST /api/v1/tasks/{task_id}/start`
Transitions task from `pending`/`assigned` to `in_progress`.
- **Request Body**: `{"notes": "Field worker arrived at pump house"}`
- **Success Response (200 OK)**: `TaskResponse` with `status: "in_progress"` and `started_at` timestamp.

#### `POST /api/v1/tasks/{task_id}/complete`
Marks task as `completed` and records completion notes. Emits risk reassessment trigger signal.
- **Request Body**:
  ```json
  {
    "completion_notes": "Irrigation delivered 18mm equivalent. Line pressure held steady at 1.9 bar.",
    "completed_by": "usr_94b415a7-742a-4384-8802-123456789abc"
  }
  ```
- **Success Response (200 OK)**: `TaskResponse` with `status: "completed"`, `completed_at` timestamp.

#### `POST /api/v1/tasks/{task_id}/cancel`
- **Request Body**: `{"reason": "Pump power failure"}`
- **Success Response (200 OK)**: `TaskResponse` with `status: "cancelled"`.

#### `PATCH /api/v1/tasks/{task_id}`
- **Request Body**: Partial updates (`assignee_id`, `status`, `checklist`, `notes`).
- **Success Response (200 OK)**: Updated `TaskResponse`.

---

### ALERTS & NOTIFICATIONS

#### `GET /api/v1/alerts/{farm_id}`
- **Parameters**: `zone_id`, `severity` (`info`, `warning`, `critical`), `acknowledged` (boolean), `limit`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": null,
    "data": [
      {
        "id": "alt_88776655-0001",
        "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
        "zone_id": "zone_a1b2c3d4-0001",
        "risk_id": "risk_33221100-0001",
        "severity": "critical",
        "channel": "dashboard",
        "message": "Critical water stress detected in Sector Alpha (Moisture 14.2%). Urgent irrigation required.",
        "delivery_status": "delivered",
        "acknowledged_at": null,
        "dedupe_key": "risk:risk_33221100-0001:critical",
        "created_at": "2026-09-19T10:15:05Z"
      }
    ]
  }
  ```

#### `POST /api/v1/alerts/{alert_id}/acknowledge`
- **Request Body**: `{"acknowledged_by": "operator"}`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Alert acknowledged",
    "data": {
      "id": "alt_88776655-0001",
      "acknowledged_at": "2026-09-19T10:16:00Z",
      ...
    }
  }
  ```

---

### ESCALATIONS & EXPERT AGRONOMIST REVIEW

#### `POST /api/v1/escalations`
- **Request Body**: `{"farm_id": "farm_uuid", "zone_id": "zone_uuid", "risk_id": "risk_uuid", "plan_id": "plan_uuid", "reason": "Unusual fungal symptoms detected"}`
- **Success Response (201 Created)**: `EscalationResponse` in `open` status.

#### `GET /api/v1/escalations/{farm_id}`
- **Parameters**: `status` (`open`, `in_review`, `resolved`, `rejected`), `limit`
- **Success Response (200 OK)**: List of `EscalationResponse`.

#### `POST /api/v1/escalations/{escalation_id}/review`
- **Request Body**:
  ```json
  {
    "assigned_expert_id": "usr_expert_uuid",
    "review_notes": "Sample confirmed as Early Blight. Approved copper fungicide at 2.0 kg/ha.",
    "review_outcome": "approved_with_adjustments",
    "status": "resolved"
  }
  ```
- **Success Response (200 OK)**: Updated `EscalationResponse`.

---

### AUDIT TIMELINE & OBSERVABILITY

#### `GET /api/v1/audit`
*(Alias: `GET /api/v1/audit/events`)*
- **Parameters**: `farm_id` (string, optional), `limit` (int, default: 50), `offset` (int, default: 0)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": null,
    "data": [
      {
        "id": "aud_11002299-0001",
        "farm_id": "farm_88a101-ca12-4e9b-b6d3-987654321001",
        "entity_type": "task",
        "entity_id": "task_44556677-0001",
        "actor_id": "usr_94b415a7-742a-4384-8802-123456789abc",
        "event_type": "complete_task",
        "before_state": { "status": "in_progress" },
        "after_state": { "status": "completed", "completion_notes": "Delivered 18mm." },
        "correlation_id": "corr_9876",
        "timestamp": "2026-09-19T10:45:00Z",
        "source": "user",
        "model_version": null,
        "policy_version": null
      }
    ]
  }
  ```

---

### ONE-CLICK DEMO PIPELINE

#### `POST /api/v1/demo/run`
Executes the full end-to-end multi-agent pipeline deterministically.
- **Request Body**:
  ```json
  {
    "scenario": "water_stress",
    "auto_approve": true,
    "force_approval_required": false,
    "farm_name": "Demo Autonomous Farm",
    "zone_name": "Demo Sector Alpha",
    "device_name": "Demo Moisture Node 01",
    "telemetry_override": null
  }
  ```
- **Supported Scenarios**:
  - `water_stress`: Low soil moisture $\rightarrow$ Irrigation plan $\rightarrow$ ALLOW $\rightarrow$ Task completed.
  - `pest_disease`: Pest pressure $\rightarrow$ Biocontrol plan $\rightarrow$ APPROVAL_REQUIRED $\rightarrow$ Approved $\rightarrow$ Task completed.
  - `nutrient_deficiency`: Low N/P/K $\rightarrow$ Fertigation proposal $\rightarrow$ ALLOW $\rightarrow$ Task completed.
  - `chemical_approval`: Synthetic chemical advisory $\rightarrow$ SafetyGuard flags $\rightarrow$ APPROVAL_REQUIRED $\rightarrow$ Human approval required.
  - `prohibited_actuator`: Uncalibrated autonomous valve actuation $\rightarrow$ REJECTED $\rightarrow$ Escalated.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Demo pipeline 'water_stress' completed successfully.",
    "data": {
      "demo_run_id": "demo_e45372ca-62b1-4d9f-a89c-49fb30352ef1",
      "scenario": "water_stress",
      "success": true,
      "farm_id": "farm_demo_123",
      "zone_id": "zone_demo_123",
      "device_id": "dev_demo_123",
      "telemetry_event_id": "evt_demo_123",
      "telemetry_measurements": { "soil_moisture": 14.5, "temperature": 31.0, "humidity": 38.0 },
      "risk_id": "risk_demo_123",
      "risk_type": "water_stress",
      "risk_severity": "high",
      "risk_score": 0.85,
      "ai_proposal": { ... },
      "safety_decision": "ALLOW",
      "action_plan_id": "plan_demo_123",
      "approval_state": "completed",
      "task_id": "task_demo_123",
      "task_status": "completed",
      "audit_event_ids": ["aud_1", "aud_2", "aud_3"],
      "alert_ids": ["alt_1"],
      "reassessment_requested": true,
      "execution_log": [
        "1. Provisioned / Located Demo Farm 'Demo Autonomous Farm' (ID: ...)",
        "2. Ingested synthetic telemetry event: {'soil_moisture': 14.5, ...}",
        "3. Deterministic Risk Detection Engine detected 'water_stress' (Severity: high)",
        "4. AI Domain Agent 'WATER_AGENT' generated proposal",
        "5. SafetyGuard evaluated proposal: ALLOW",
        "6. Action Plan created (ID: ...)",
        "7. Generated executable Task (ID: ...)",
        "8. Completed Task execution and recorded completion audit",
        "9. Reassessment trigger emitted"
      ],
      "error_message": null
    }
  }
  ```

#### `GET /api/v1/demo/status`
- **Auth**: Public / No Token required
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Demo pipeline is ready.",
    "data": {
      "status": "ready",
      "available_scenarios": [
        "water_stress",
        "pest_disease",
        "nutrient_deficiency",
        "chemical_approval",
        "prohibited_actuator"
      ],
      "supported_providers": ["mock", "gemini"],
      "deterministic_mode": true
    }
  }
  ```

---

### HEALTH & DIAGNOSTICS

#### `GET /api/v1/health`
- **Auth**: Public
- **Success Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "version": "0.1.0",
    "database": "connected",
    "environment": "development",
    "mqtt": { "running": false, "broker": "localhost:1883", "connected": false },
    "timestamp": "2026-09-19T10:00:00Z"
  }
  ```

#### `GET /api/v1/health/db`
- **Auth**: Public
- **Success Response (200 OK)**: `{"status": "ok", "database": "connected"}` (or `503 Service Unavailable` if database disconnected).
