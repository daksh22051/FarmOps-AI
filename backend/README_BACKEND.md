# FarmOps AI — Backend Documentation & API Contracts

Welcome to the backend service of **FarmOps AI**, an autonomous multi-agent agricultural operations and IoT telemetry intelligence platform.

---

## 1. Technology Stack

- **Framework**: Python 3.13+ with **FastAPI**
- **Data Validation**: **Pydantic v2**
- **Database**: **Supabase PostgreSQL** via **SQLAlchemy 2.0 (Async)** and **`asyncpg`**
- **Database Migrations**: **Alembic** (Async engine runner)
- **Authentication**: **Supabase Auth** (JWT validation)
- **AI Orchestration**: **Google Gemini API** (`google-genai`) with fallback to **MockAIProvider**
- **IoT Streaming**: **MQTT** (`aiomqtt`) + HTTP ingestion endpoints
- **Testing**: **pytest**, **pytest-asyncio**, **httpx** (`AsyncClient`)
- **Specification**: **OpenAPI 3.1**

---

## 2. Directory Architecture

```
backend/
├── pyproject.toml              # Modern Python packaging & tool configs
├── requirements.txt            # Locked dependencies
├── .env.example                # Configuration template
├── alembic.ini                 # Database migration config
├── alembic/                    # Async Alembic migrations
│   ├── env.py
│   └── versions/
│       └── 82b833e2d064_initial_tables.py
├── app/
│   ├── main.py                 # Application factory, lifespan, CORS, middleware
│   ├── config.py               # Pydantic v2 Settings (environment variables)
│   ├── core/
│   │   ├── database.py         # Async engine, sessionmaker, get_db dependency
│   │   ├── security.py         # Supabase JWT token verification & AuthUser
│   │   ├── exceptions.py       # Custom domain exceptions
│   │   └── logging.py          # Structured logging & audit instrumentation
│   ├── models/                 # SQLAlchemy 2.0 Declarative Models
│   │   ├── farm.py             # Farm, Field, Crop
│   │   ├── sensor.py           # SensorNode
│   │   ├── telemetry.py        # TelemetryReading
│   │   ├── alert.py            # AlertRule, TriggeredAlert
│   │   ├── agent.py            # AgentSession, AgentMessage, Recommendation
│   │   └── audit.py            # AuditLog
│   ├── schemas/                # Pydantic v2 DTOs (Request / Response models)
│   ├── services/               # Business logic & domain services
│   │   ├── farm_service.py
│   │   ├── telemetry_service.py
│   │   ├── alert_service.py
│   │   └── audit_service.py
│   ├── ai/                     # Isolated AI Provider & Multi-Agent Orchestration
│   │   ├── provider.py         # Gemini client & MockAIProvider
│   │   ├── prompts.py          # Agronomic system instructions
│   │   ├── orchestrator.py     # Supervisor router & session manager
│   │   └── agents/
│   │       ├── irrigation.py   # Precision Irrigation Specialist
│   │       ├── pest_disease.py # Pest & Pathogen Advisory
│   │       └── harvest_yield.py# Phenology & Yield Optimization
│   ├── mqtt/                   # IoT Telemetry Ingestion Bridge
│   │   ├── client.py           # Background aiomqtt subscriber
│   │   └── handlers.py         # Sensor topic parsers & dispatch
│   └── api/
│       └── v1/
│           ├── router.py       # Aggregated v1 Router
│           └── endpoints/      # REST API endpoints
│               ├── health.py
│               ├── auth.py
│               ├── farms.py
│               ├── telemetry.py
│               ├── alerts.py
│               ├── agents.py
│               └── audit.py
└── tests/                      # pytest test suite
    ├── conftest.py             # Isolated async DB & client fixtures
    ├── test_health.py
    ├── test_farms.py
    ├── test_telemetry.py
    ├── test_alerts.py
    ├── test_agents.py
    └── test_security.py
```

---

## 3. Quickstart & Local Setup

### 1. Prerequisites
- Python 3.11+
- Virtual environment tool (`uv` or `venv`)

### 2. Environment Configuration
Copy `.env.example` to `.env` in the `backend/` directory:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
- `DATABASE_URL`: `postgresql+asyncpg://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
- `SUPABASE_JWT_SECRET`: Found in Supabase Dashboard -> Project Settings -> API -> JWT Secret.
- `GEMINI_API_KEY`: (Optional for local testing; without it, `MockAIProvider` activates automatically).

### 3. Install Dependencies
```bash
# Using uv (fastest)
uv pip install -r requirements.txt

# Or using standard pip
pip install -r requirements.txt
```

### 4. Apply Database Migrations
```bash
alembic upgrade head
```

### 5. Run the Server
```bash
uvicorn app.main:app --reload --port 8000
```
Interactive Documentation is immediately available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/api/v1/openapi.json`

### 6. Run Automated Tests
```bash
pytest tests -v
```

---

## 4. Frontend API Contract Reference

The frontend can interact with the backend using standard JSON HTTP calls with Bearer JWT tokens:

### Headers
```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
Content-Type: application/json
```

### Response Envelope Format
All endpoints return a uniform response envelope:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional status message"
}
```

### Key Endpoints

| Area | Method | Path | Description |
| :--- | :--- | :--- | :--- |
| **Health** | `GET` | `/api/v1/health` | Database ping and version check |
| **Auth** | `GET` | `/api/v1/auth/me` | Current user profile and claims |
| **Farms** | `POST` | `/api/v1/farms` | Register new farm |
| | `GET` | `/api/v1/farms` | List user's farms |
| | `GET` | `/api/v1/farms/{farm_id}` | Get farm details with fields and nodes |
| | `PUT` | `/api/v1/farms/{farm_id}` | Update farm metadata |
| | `DELETE` | `/api/v1/farms/{farm_id}` | Remove farm |
| **Fields & Crops** | `POST` | `/api/v1/farms/{farm_id}/fields` | Add field parcel to farm |
| | `GET` | `/api/v1/farms/{farm_id}/fields` | List fields |
| | `POST` | `/api/v1/farms/fields/{field_id}/crops` | Register crop with target thresholds |
| **Sensor Nodes** | `POST` | `/api/v1/farms/{farm_id}/nodes` | Register hardware node |
| | `GET` | `/api/v1/farms/{farm_id}/nodes` | List active sensors & battery levels |
| **Telemetry** | `POST` | `/api/v1/telemetry/{farm_id}` | Ingest sensor data point (auto-registers node) |
| | `POST` | `/api/v1/telemetry/{farm_id}/batch` | Ingest batch of telemetry |
| | `GET` | `/api/v1/telemetry/{farm_id}` | Time-series query with date range & limits |
| | `GET` | `/api/v1/telemetry/{farm_id}/summary` | Aggregate statistics (min, max, avg, latest) |
| **Alerts** | `POST` | `/api/v1/alerts/rules` | Configure threshold alert rules |
| | `GET` | `/api/v1/alerts/rules/{farm_id}` | List active alert rules |
| | `GET` | `/api/v1/alerts/triggered/{farm_id}` | List triggered alerts (unresolved or all) |
| | `POST` | `/api/v1/alerts/triggered/{alert_id}/resolve` | Mark alert resolved |
| **AI Agents** | `POST` | `/api/v1/agents/query` | Consult multi-agent AI system |
| | `GET` | `/api/v1/agents/sessions/{session_id}` | Fetch session chat history |
| | `GET` | `/api/v1/agents/recommendations/{farm_id}` | List agronomic recommendations |
| | `PATCH` | `/api/v1/agents/recommendations/{rec_id}` | Update status (`accepted`, `rejected`, `executed`) |
| **Audit** | `GET` | `/api/v1/audit/logs` | Query administrative and system audit events |

---

## 5. Multi-Agent AI Orchestration

When queries or telemetry anomalies arrive at `POST /api/v1/agents/query`:
1. **Context Aggregation**: The orchestrator gathers recent telemetry (soil moisture, air temp, humidity, pH) and crop requirements.
2. **Supervisor Router**: Classifies intent and routes to:
   - **Irrigation Specialist**: Calculates water deficit and scheduling.
   - **Pest & Disease Advisory**: Evaluates humidity and temperature spore germination risk.
   - **Harvest & Yield Optimizer**: Calculates growing degree days and maturity index.
3. **Structured Recommendation**: A formal `Recommendation` record is persisted with category, urgency priority, and actionable parameters.

---

## 6. MQTT Telemetry Protocol

Sensor gateways can stream telemetry over MQTT:
- **Topic**: `farmops/{farm_id}/nodes/{hardware_id}/telemetry`
- **Payload**:
```json
{
  "soil_moisture": 31.4,
  "soil_temperature": 22.1,
  "air_temperature": 26.5,
  "air_humidity": 65.0,
  "soil_ph": 6.8,
  "battery_level": 95.0
}
```
The MQTT worker automatically deserializes readings, updates sensor heartbeats, and evaluates alert thresholds in real-time.
