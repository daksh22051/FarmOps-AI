# FarmOps-AI 🌿🚜

> **Autonomous Farm-to-Field Advisory & Multi-Agent Action Orchestration System**  
> *Developed for Bit N Build '26 — Problem Statement PS-6: Autonomous Farm-to-Field Advisory & Action Orchestration Agents*

---

## 📌 Overview

**FarmOps-AI** is an enterprise-grade, multi-agent AI orchestration platform that bridges the gap between raw agricultural IoT telemetry and field-level execution. By integrating real-time sensor streams (soil moisture, NPK levels, micro-climate weather metrics) with Google Gemini multi-agent reasoning, FarmOps-AI enables autonomous risk detection, precision agronomic advisory, and automated action plan dispatching with human-in-the-loop auditability.

---

## 🌟 Key Features

- 🤖 **Multi-Agent AI Advisory Pipeline (Google Gemini)**
  - **Nutrient & Soil Health Agent**: Analyzes N-P-K balances, pH, and electrical conductivity to generate precision fertilization plans.
  - **Irrigation & Water Stress Agent**: Evaluates soil moisture trends, evapotranspiration rates, and weather forecasts to optimize irrigation schedules.
  - **Pest & Disease Detection Agent**: Correlates humidity, leaf wetness, and ambient temperature to flag early fungal and pest risks.
  - **Market Context & Economic Agent**: Evaluates local market crop pricing and yield impact to prioritize cost-effective advisory recommendations.

- 📊 **Real-Time Operational Dashboard**
  - **Live Telemetry & Weather**: Streamed sensor telemetry charts (Recharts) and live weather integrations via OpenWeather API.
  - **Interactive Zone Mapping**: Field-level zone visualization using Leaflet maps with dynamic health status scoring.
  - **Manual Reading Ingestion**: Field form interface allowing manual telemetry inputs for off-grid or offline observations.

- ⚠️ **Automated Risk Engine & Action Orchestration**
  - Continuous anomaly detection with automated severity classification (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
  - Automated action plan synthesis and worker task dispatching.
  - Escalation handling for unresolved critical field alerts.

- 🛡️ **Human-in-the-Loop Audit System**
  - Full audit logging for AI agent recommendations, plan approvals, and field operator task execution.

- ⚡ **Telemetry Simulation Service**
  - Built-in asynchronous simulation engine for continuous real-time telemetry streaming and testing without physical hardware.

---

## 🏗️ Architecture & Monorepo Structure

```text
FarmOps-AI/
├── backend/                  # FastAPI Microservice Backend
│   ├── app/
│   │   ├── ai/               # Gemini multi-agent implementations & provider
│   │   ├── api/v1/           # API v1 REST Endpoints (Dashboard, AI, Telemetry, Risks, Plans)
│   │   ├── core/             # Database connection (Supabase PostgreSQL) & security
│   │   ├── models/           # SQLAlchemy ORM Models
│   │   ├── schemas/          # Pydantic validation schemas
│   │   └── services/         # Domain services (Risk Engine, Action Plan, Telemetry Sim)
│   ├── alembic/              # Database migration scripts
│   └── scripts/              # Realistic database seeding & maintenance scripts
├── frontend/                 # Next.js 15 (App Router) Dashboard UI
│   ├── app/                  # App Router pages (Dashboard, Analytics, Risks, Plans, Tasks, Zones)
│   ├── components/           # Reusable UI components & App Shell
│   ├── context/              # Global Farm Context state provider
│   └── lib/api/              # API clients for FastAPI backend & OpenWeather
├── docs/                     # API contracts, architecture guides, and type definitions
└── data/                     # Agricultural research datasets & historical benchmarks
```

---

## 🛠️ Tech Stack

| Component | Technologies Used |
| :--- | :--- |
| **Frontend Framework** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling & UI** | Tailwind CSS, Lucide Icons, Recharts, Leaflet / React-Leaflet |
| **Backend Framework** | Python 3.13+, FastAPI, Pydantic v2 |
| **AI Orchestration** | Google Gemini SDK (`google-genai`), Multi-Agent Advisory Framework |
| **Database & ORM** | Supabase PostgreSQL, Asyncpg, SQLAlchemy 2.0 (Async), Alembic |
| **IoT & Ingestion** | AIOMQTT (MQTT Broker), Live Telemetry Simulation Engine |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python** 3.11+
- **Node.js** 18+ & `npm`
- **Git**

---

### 1. Backend Setup (FastAPI + Supabase)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # On Windows (PowerShell):
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # On Linux/macOS:
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration**:
   Create a `.env` file in `backend/` (or copy `.env.example`):
   ```env
   PROJECT_NAME="FarmOps AI Backend"
   ENVIRONMENT="development"
   DATABASE_URL="postgresql+asyncpg://<user>:<password>@<host>:6543/postgres"
   SUPABASE_URL="https://<your-supabase-id>.supabase.co"
   SUPABASE_PUBLISHABLE_KEY="<your-publishable-key>"
   GEMINI_API_KEY="<your-gemini-api-key>"
   GEMINI_MODEL="gemini-2.5-flash"
   ```

5. **Run Database Migrations & Seed Data**:
   ```bash
   alembic upgrade head
   python scripts/seed_realistic_farms.py
   ```

6. **Start the Backend Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   - **API Base URL**: `http://localhost:8000/api/v1`
   - **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Frontend Setup (Next.js Dashboard)

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env.local` file in `frontend/`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-id>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
   NEXT_PUBLIC_OPENWEATHER_API_KEY=<your-openweather-api-key>
   ```

4. **Start the Next.js Development Server**:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to view the operational dashboard.

---

## 📡 API Reference & Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Health check for backend service & Supabase database connection |
| `/api/v1/dashboard/overview` | `GET` | Unified operational payload for telemetry, active risks, & farm zones |
| `/api/v1/ai/advisories` | `POST` | Multi-agent Gemini advisory synthesis pipeline |
| `/api/v1/telemetry/stream` | `GET` | Real-time SSE / telemetry stream |
| `/api/v1/risks` | `GET / POST` | List active crop/field risks or trigger manual risk evaluations |
| `/api/v1/plans` | `GET / POST` | Action plan generation and execution management |
| `/api/v1/tasks` | `GET / PATCH` | Worker task dispatching and field status updates |

---

## 🧪 Testing & Quality Assurance

### Backend Tests
Run the automated test suite:
```bash
cd backend
python -m pytest
```

### Frontend Type-Checking & Linting
```bash
cd frontend
npm run type-check
npm run lint
```

---

## 🔗 Useful Links & Documentation

- **GitHub Repository**: [https://github.com/daksh22051/FarmOps-AI](https://github.com/daksh22051/FarmOps-AI)
- **Frontend API Contract**: [`backend/docs/frontend-api-contract.md`](backend/docs/frontend-api-contract.md)
- **TypeScript Interface Definitions**: [`backend/docs/frontend-types.ts`](backend/docs/frontend-types.ts)

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.
