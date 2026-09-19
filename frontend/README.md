# FarmOps AI — Frontend

Autonomous Farm-to-Field Advisory & Action Orchestration Next.js Application.

## Overview

FarmOps AI provides agricultural monitoring, risk analysis, advisory plans, and human-in-the-loop task execution following the PS-6 workflow cycle:
\text{Monitor} \longrightarrow \text{Detect} \longrightarrow \text{Plan} \longrightarrow \text{Farmer Decision} \longrightarrow \text{Task} \longrightarrow \text{Verify/Reassess} \longrightarrow \text{Repeat}

## Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- npm or pnpm

### Installation

`ash
npm install
`

### Development Server

`ash
npm run dev
`

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Quality Checks

`ash
npm run lint
npm run type-check
npm run build
`

## Application Routes
- /dashboard — Multi-dataset overview and dataset explorer
- /farm — Farm hierarchy and parcel acreage management
- /risks — Agronomic risk center and edge sensor statistics
- /plans — Autonomous advisory plans with farmer decision gates
- /tasks — Crew work dispatch and execution checklist
- /alerts — Operational data quality alerts and hardware warnings
- /timeline — Activity audit trail and dataset provenance
- /settings — Measurement units (ha/ac), locale grouping, and workflow preferences
