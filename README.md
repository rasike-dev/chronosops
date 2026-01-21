# ChronosOps — Enterprise Autonomous SRE (MVP)

ChronosOps investigates production incidents by reasoning over deployments and telemetry, producing evidence-backed root-cause hypotheses, explainable reasoning, scenario-aware runbooks, and exportable postmortems (Markdown + JSON).

## What's in this MVP
- Monorepo (pnpm workspace)
  - `apps/api` — NestJS API
  - `apps/web` — Next.js Web Console
  - `packages/contracts` — shared TypeScript + Zod schemas (single source of truth)
- Scenarios
  - `latency-spike` (post-deploy latency regression)
  - `error-spike-config` (config-driven error spike)
- Timeline UI: Before → Deploy → Spike → Peak
- Incident analysis: evidence table + explainability object
- Runbook panel (scenario-aware)
- Exports: incident brief / postmortem markdown / incident JSON

## Prerequisites
- Node.js (LTS recommended)
- pnpm (workspace)
- No external dependencies required for MVP (telemetry is scenario-simulated)

## Quick Start
1) Install dependencies:
```bash
pnpm install
```

2) Configure environment:
```bash
cp .env.example .env
```

3) Run API + Web:
```bash
pnpm -r dev
```

## URLs
- **Web Console**: http://localhost:3000
- **API**: http://localhost:4000 (or your configured port)
- **API health**: http://localhost:4000/v1/health
- **API version**: http://localhost:4000/v1/version

## Core API Surface
- `GET /v1/health`
- `GET /v1/version`
- `GET /v1/scenarios`
- `GET /v1/scenarios/:id`
- `POST /v1/incidents/analyze`

## MVP Behavior Notes
- **Evidence-first**: analysis is deterministic and derived from scenario telemetry
- **Read-only by default**: no auto-remediation actions
- **Strict validation**: contracts are shared via `packages/contracts`

## Repo Structure
- `apps/api` — modular NestJS services
- `apps/web` — Next.js console + `/api` proxy to backend
- `packages/contracts` — Zod schemas + shared types

## Troubleshooting
- If web loads but shows API offline:
  - confirm API is running
  - confirm `NEXT_PUBLIC_API_BASE_URL` or proxy configuration is correct
  - check `GET /v1/version` directly

### Verification
- A new contributor can clone, run `pnpm install`, `cp .env.example .env`, `pnpm -r dev`, and see the web UI + `/v1/version` green.
