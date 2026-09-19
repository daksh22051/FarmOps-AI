# FarmOps-AI

Autonomous Farm-to-Field Advisory & Action Orchestration System (PS-6).

## Monorepo Architecture

`
FarmOps-AI/
├── backend/       # FastAPI backend, PostgreSQL/Alembic, MQTT, AI orchestration agents
├── frontend/      # Next.js App Router frontend, FarmContext, dataset adapters
├── data/          # Research datasets (gitignored)
└── docs/          # Architecture, dataset provenance, and API documentation
`

## Quick Start

### Frontend (Next.js)

`ash
cd frontend
npm install
npm run dev
`

Open [http://localhost:3000](http://localhost:3000).

### Backend (FastAPI)

`ash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
`
