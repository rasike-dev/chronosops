# ChronosOps — Enterprise Autonomous SRE (MVP)

ChronosOps investigates production incidents by reasoning over deployments and telemetry, producing evidence-backed root-cause hypotheses, explainable reasoning, scenario-aware runbooks, and exportable postmortems (Markdown + JSON).

## What's in this MVP
- Monorepo (pnpm workspace)
  - `apps/api` — NestJS API with authentication, persistence, and incident analysis
  - `apps/web` — Next.js Web Console with demo UI
  - `packages/contracts` — shared TypeScript + Zod schemas (single source of truth)
- **Scenarios**
  - `latency-spike` (post-deploy latency regression)
  - `error-spike-config` (config-driven error spike)
- **Timeline UI**: Before → Deploy → Spike → Peak
- **Incident Analysis**: 
  - Evidence table (baseline vs after metrics)
  - Explainability object (primary signal, latency/error factors, rationale)
  - Scenario-aware runbook (immediate mitigations, verification checks, escalation)
- **Persistence**: PostgreSQL database with Prisma ORM
  - Incident records with full audit trail
  - Replayable analysis (re-analyze with stored request data)
  - Postmortem snapshots (Markdown + JSON)
- **Authentication**: JWT/OIDC with JWKS validation
  - Global auth guard (all routes protected by default)
  - Public endpoints: `/v1/health`, `/v1/version`
  - Configurable via `AUTH_REQUIRED` environment variable
- **Exports**: 
  - Incident brief (copy to clipboard)
  - Postmortem Markdown (copy-ready)
  - Incident JSON (integration-ready)

## Prerequisites
- Node.js (LTS recommended)
- pnpm (workspace)
- PostgreSQL (for persistence)
- Docker & Docker Compose (optional, for local PostgreSQL)

## Quick Start

### Option 1: Docker Compose (Recommended)

One-command bring-up:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env if needed (defaults work for local dev)

# 3. Start all services
docker compose up -d --build

# Services will be available at:
# - API: http://localhost:4000
# - Web: http://localhost:3000
# - PostgreSQL: localhost:5432
```

The Docker Compose setup includes:
- PostgreSQL database (with automatic migrations)
- API server (with health checks)
- Web console

### Option 2: Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL

# 3. Start PostgreSQL (if using Docker Compose)
docker-compose -f infra/docker-compose.dev.yml up -d

# 4. Run database migrations
cd apps/api
pnpm prisma migrate dev

# 5. Run API + Web
cd ../..
pnpm -r dev
```

## URLs
- **Web Console**: http://localhost:3000
- **Demo Page**: http://localhost:3000/demo
- **API**: http://localhost:4000 (or your configured port)
- **API health**: http://localhost:4000/v1/health (public)
- **API version**: http://localhost:4000/v1/version (public)

## Core API Surface

### Public Endpoints (No Authentication Required)
- `GET /v1/health` — Health check
- `GET /v1/version` — API version info

### Protected Endpoints (JWT Required)
- `GET /v1/scenarios` — List available scenarios
- `GET /v1/scenarios/:id` — Get scenario details
- `POST /v1/incidents/analyze` — Analyze a new incident
- `GET /v1/incidents` — List incidents
- `GET /v1/incidents/:id` — Get incident details with analyses and postmortems
- `POST /v1/incidents/:id/reanalyze` — Re-run analysis for an existing incident

## Authentication

The API uses JWT/OIDC authentication with JWKS validation. By default, all routes require a valid JWT token except `/v1/health` and `/v1/version`.

### Configuration
Set these environment variables:
- `AUTH_REQUIRED=true` (or `false` to disable auth)
- `OIDC_ISSUER_URL` — OIDC issuer URL (e.g., Keycloak realm)
- `OIDC_AUDIENCE` — Expected audience claim
- `OIDC_JWKS_URI` — JWKS endpoint for public key validation

### Using the API
Include the JWT token in the `Authorization` header:
```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:4000/v1/incidents
```

## Database Schema

- **Incident**: Stores incident metadata (scenarioId, title, status)
- **IncidentAnalysis**: Stores analysis request and result JSON (enables replayability)
- **Postmortem**: Stores postmortem markdown and JSON snapshots

All records are insert-only (never overwritten) to maintain a full audit trail.

## MVP Behavior Notes
- **Evidence-first**: Analysis is deterministic and derived from scenario telemetry
- **Read-only by default**: No auto-remediation actions
- **Strict validation**: Contracts are shared via `packages/contracts`
- **Audit trail**: All analyses and postmortems are persisted with timestamps
- **Replayable**: Re-analyze incidents using stored request data

## Repo Structure
- `apps/api` — NestJS API with modules:
  - `auth/` — JWT/OIDC authentication (strategy, guard, decorators)
  - `config/` — Configuration loaders (auth config)
  - `modules/health/` — Health check endpoint
  - `modules/version/` — Version endpoint
  - `modules/scenario/` — Scenario service
  - `modules/incidents/` — Incident analysis and persistence
  - `prisma/` — Prisma service and module
- `apps/web` — Next.js console with demo UI
- `packages/contracts` — Zod schemas + shared types
- `infra/` — Docker Compose for local development

## Troubleshooting

### API won't start
- Check that `DATABASE_URL` is set correctly in `.env`
- Verify PostgreSQL is running: `psql $DATABASE_URL -c "SELECT 1;"`
- Check that Prisma migrations are applied: `cd apps/api && npx prisma migrate status`

### Authentication errors
- Verify `AUTH_REQUIRED` is set correctly
- Check that OIDC environment variables are set (if `AUTH_REQUIRED=true`)
- For development, set `AUTH_REQUIRED=false` to disable auth

### Web shows API offline
- Confirm API is running on the expected port
- Check `GET /v1/version` directly
- Verify `NEXT_PUBLIC_API_BASE_URL` or proxy configuration

### Database connection issues
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Check network connectivity to database host

## Verification
A new contributor can:
1. Clone the repo
2. Run `pnpm install`
3. Copy `.env.example` to `.env` and configure `DATABASE_URL`
4. Start PostgreSQL (via Docker Compose or local instance)
5. Run `cd apps/api && npx prisma migrate dev`
6. Run `pnpm -r dev`
7. See the web UI at http://localhost:3000/demo and verify `/v1/version` returns 200

## Current Status

✅ **Completed Features:**
- Incident analysis with evidence table and explainability
- Scenario-aware runbook generation
- Postmortem export (Markdown + JSON)
- Database persistence with Prisma
- Replayable analysis (re-analyze incidents)
- JWT/OIDC authentication with JWKS validation
- Global auth guard with public endpoint allowlist
- Web UI with demo script and copy-to-clipboard functionality

🚧 **In Progress:**
- Additional scenario types
- Enhanced runbook actions

📋 **Planned:**
- Role-based access control (RBAC)
- Incident timeline visualization
- Integration with external monitoring systems
