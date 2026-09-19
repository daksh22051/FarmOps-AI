# FarmOps-AI

Autonomous Farm-to-Field Advisory & Multi-Agent Action Orchestration System.

---

## Monorepo Architecture

```text
FarmOps-AI/
├── backend/       # FastAPI backend, Supabase PostgreSQL, Alembic, MQTT, Gemini multi-agent orchestration
├── frontend/      # Next.js App Router dashboard UI, dataset adapters, telemetry visualization
├── data/          # Research datasets (gitignored)
└── docs/          # Architecture, dataset provenance, and versioned frontend API contracts
```

---

## Quick Start

### 1. Backend (FastAPI + Supabase PostgreSQL)

```bash
cd backend
python -m venv .venv
# On Windows:
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Frontend API Contract**: [`backend/docs/frontend-api-contract.md`](backend/docs/frontend-api-contract.md)
- **Frontend TypeScript Types**: [`backend/docs/frontend-types.ts`](backend/docs/frontend-types.ts)
- **Integration Guide**: [`backend/docs/frontend-integration.md`](backend/docs/frontend-integration.md)

---

### 2. Frontend (Next.js App Router)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To run quality checks:
```bash
cd frontend
npm run lint
npm run type-check
npm run build
```
