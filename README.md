# ChronosOps — Enterprise Autonomous SRE (MVP)

ChronosOps investigates production incidents by reasoning over deployments and telemetry using **Gemini 3 Flash Preview**, producing evidence-backed root-cause hypotheses, explainable reasoning, scenario-aware runbooks, and exportable postmortems (Markdown + JSON).

## What's in this MVP
- Monorepo (pnpm workspace)
  - `apps/api` — NestJS API with authentication, persistence, and incident analysis
  - `apps/web` — Next.js Web Console with **enterprise-grade UI** showcasing all features
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
- **Gemini API Key** (optional, for AI reasoning) - Get one at https://aistudio.google.com/app/apikey

## Quick Start

### Option 1: Docker Compose (Recommended)

One-command bring-up:

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env if needed (defaults work for local dev)
#    - Set GEMINI_API_KEY for AI reasoning (optional)
#    - GEMINI_MODEL defaults to "gemini-3-flash-preview"

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
# Edit .env and set:
#   - DATABASE_URL (required)
#   - GEMINI_API_KEY (optional, for AI reasoning)
#   - GEMINI_MODEL (optional, defaults to "gemini-3-flash-preview")

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
- **Login Page**: http://localhost:3000/login (Sign in with Keycloak)
- **User Profile**: http://localhost:3000/profile (View user details and roles)
- **Create Incident**: http://localhost:3000/analyze (Scenarios & Google Cloud import)
- **Incident List**: http://localhost:3000/incidents
- **Incident Workspace**: http://localhost:3000/incidents/:id (Full feature showcase)
- **Analysis Comparison**: http://localhost:3000/incidents/:id/compare/:a/:b (Drift detection)
- **Export Center**: http://localhost:3000/exports
- **API**: http://localhost:4000 (or your configured port)
- **API health**: http://localhost:4000/v1/health (public)
- **API readiness**: http://localhost:4000/v1/ready (public)
- **API version**: http://localhost:4000/v1/version (public)

## Core API Surface

### Public Endpoints (No Authentication Required)
- `GET /v1/health` — Health check (includes database connectivity)
- `GET /v1/ready` — Readiness check (database + migrations)
- `GET /v1/version` — API version info (includes git SHA, build time, prompt version)

### Protected Endpoints (JWT Required)

#### Scenarios
- `GET /v1/scenarios` — List available scenarios
- `GET /v1/scenarios/:id` — Get scenario details

#### Incidents
- `POST /v1/incidents/analyze` — Analyze a new incident
- `GET /v1/incidents` — List incidents
- `GET /v1/incidents/:id` — Get incident details with analyses and postmortems
- `POST /v1/incidents/:id/reanalyze` — Re-run analysis for an existing incident
- `GET /v1/incidents/:id/analyses/:a/compare/:b` — Compare two analyses (drift detection)
- `GET /v1/incidents/:incidentId/analyses/:analysisId/explainability-graph` — Get explainability graph
- `GET /v1/incidents/:id/verify` — Verify audit chain integrity

#### Investigation (Analyst/Admin only)
- `POST /v1/incidents/:id/investigate` — Start autonomous investigation session
- `GET /v1/investigations/incident/:incidentId` — Get all investigation sessions for an incident
- `GET /v1/investigations/:sessionId` — Get investigation session status

#### Evidence & Traces
- `GET /v1/incidents/:id/prompt-traces` — List prompt traces for an incident
- `GET /v1/incidents/prompt-traces/:id` — Get specific prompt trace
- `GET /v1/incidents/evidence-bundles/:bundleId` — Get evidence bundle

#### Postmortems
- `GET /v1/incidents/:id/postmortems` — List postmortems for an incident
- `GET /v1/incidents/postmortems/:id` — Get postmortem details
- `GET /v1/incidents/postmortems/:id/markdown` — Get postmortem markdown

## Authentication

The API uses JWT/OIDC authentication with JWKS validation. By default, all routes require a valid JWT token except `/v1/health` and `/v1/version`.

### Configuration
Set these environment variables:
- `CHRONOSOPS_AUTH_REQUIRED=true` (or `false` to disable auth)
- `CHRONOSOPS_AUTH_ISSUER_URL` — OIDC issuer URL (e.g., Keycloak realm)
- `CHRONOSOPS_AUTH_AUDIENCE` — Expected audience claim
- `CHRONOSOPS_AUTH_JWKS_URI` — JWKS endpoint for public key validation

**Note**: Legacy `AUTH_REQUIRED`, `OIDC_ISSUER_URL`, etc. are also supported for backward compatibility.

### Using the API
Include the JWT token in the `Authorization` header:
```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:4000/v1/incidents
```

## Database Schema

- **Incident**: Stores incident metadata (scenarioId, title, status, sourceType, sourcePayload)
- **IncidentAnalysis**: Stores analysis request and result JSON (enables replayability)
- **EvidenceBundle**: Content-addressed evidence bundles (immutable, hash-based)
- **PromptTrace**: Full prompt/request/response traces with hashes for integrity
- **Postmortem**: Stores postmortem markdown and JSON snapshots
- **InvestigationSession**: Autonomous investigation session metadata
- **InvestigationIteration**: Per-iteration records with decision JSON
- **AuditEvent**: Tamper-evident audit chain (hash-linked events)

All records are insert-only (never overwritten) to maintain a full audit trail.

## Key Features

### Safety & Policy
- **Safe Mode**: Default ON - collectors run in STUB mode unless explicitly allowlisted
- **Policy Gating**: Evidence requests validated with bounds (time windows, max items, allowlists)
- **RBAC Enforcement**: Role-based access control (Viewer, Analyst, Admin)
- **Data Redaction**: Sensitive data (sourcePayload, prompt traces) redacted for non-admins
- **Request Limits**: Body size limits (2MB), rate limiting configured

### Autonomous Investigation
- **Investigation Loop**: Bounded iterations with stop conditions (confidence target, max iterations, no progress)
- **Model-Directed**: **Gemini 3 Flash Preview** can request specific evidence types (Day 17)
- **Deterministic Fallback**: Falls back to completeness-based plan if model requests unavailable
- **Full Audit**: Every iteration recorded with decision JSON

### Explainability & Traceability
- **Explainability Graph**: Visual trace from evidence → reasoning → conclusion
- **Analysis Comparison**: Compare two analyses to detect drift
- **Audit Chain**: Hash-linked audit log for tamper detection
- **Integrity Verification**: Verify audit chain continuity and detect tampering

### Observability
- **Structured Logging**: Request IDs, correlation IDs, incident context
- **Health Checks**: Database connectivity, migration status
- **Version Info**: Git SHA, build time, prompt version, generator version

### Enterprise-Grade UI
- **Login & Authentication**: Dedicated login page with Keycloak integration
- **User Profile Page**: Comprehensive user details, roles, and permissions display
- **Unified Incident Creation**: Source tabs for Scenarios and Google Cloud incidents
- **Visual Timeline Preview**: Interactive timeline showing deployment → spike → peak
- **Source Traceability**: Clear badges and metadata showing incident origin
- **Evidence Bundle Viewer**: Completeness scores, evidence type grid, hash display
- **Analysis Dashboard**: Gemini 3 reasoning results with hypothesis ranking and confidence scores
- **Investigation Loop Timeline**: Real-time iteration tracking with model requests and stop conditions
- **Explainability Graph**: Visual trace from evidence → reasoning → conclusion (ready for interactive visualization)
- **Analysis Comparison Page**: Full comparison view with detailed drift detection
- **Export Center**: Enhanced postmortem and JSON bundle exports with feature highlights
- **Audit Chain Verification**: One-click integrity verification with tamper detection status
- **Filtering & Search**: Source and status filters on incident list
- **Responsive Design**: Enterprise-grade UI with consistent styling and clear visual hierarchy

## Repo Structure
- `apps/api` — NestJS API with modules:
  - `auth/` — JWT/OIDC authentication (strategy, guard, decorators)
  - `config/` — Configuration loaders (auth config)
  - `modules/health/` — Health check endpoint
  - `modules/version/` — Version endpoint
  - `modules/scenario/` — Scenario service
  - `modules/incidents/` — Incident analysis and persistence
  - `prisma/` — Prisma service and module
- `apps/web` — Next.js console with enterprise-grade UI
  - Reusable UI components (SourceBadge, EvidenceGrid, HypothesisCard, etc.)
  - Enhanced pages: `/analyze`, `/incidents`, `/incidents/[id]`, `/exports`
  - Feature-rich incident workspace showcasing all capabilities
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

### Quick Verification (Docker Compose)
```bash
# 1. Clone the repo
git clone <repo-url>
cd chronosops

# 2. Copy environment template
cp .env.example .env

# 3. Start all services
docker compose up -d --build

# 4. Verify endpoints
curl http://localhost:4000/v1/health    # Should return {"ok":true,"database":"connected"}
curl http://localhost:4000/v1/ready    # Should return {"ready":true,"migrations":"applied"}
curl http://localhost:4000/v1/version  # Should return version info with git SHA

# 5. Access web UI
open http://localhost:3000
```

### Manual Verification
A new contributor can:
1. Clone the repo
2. Run `pnpm install`
3. Copy `.env.example` to `.env` and configure `DATABASE_URL`
4. Start PostgreSQL (via Docker Compose or local instance)
5. Run `cd apps/api && pnpm prisma migrate dev`
6. Run `pnpm -r dev`
7. See the web UI at http://localhost:3000/demo and verify `/v1/version` returns 200

### Complete Feature Verification
See `docs/ship-checklist.md` for a comprehensive checklist of all features.

## Current Status

✅ **Completed Features (Days 1-21):**

**Core Functionality:**
- Incident analysis with evidence table and explainability
- Scenario-aware runbook generation
- Postmortem export (Markdown + JSON)
- Database persistence with Prisma
- Replayable analysis (re-analyze incidents)
- Analysis comparison (drift detection)

**Authentication & Authorization:**
- JWT/OIDC authentication with JWKS validation
- Global auth guard with public endpoint allowlist
- Role-based access control (RBAC) - Viewer, Analyst, Admin
- Service-layer RBAC enforcement

**Autonomous Investigation (Days 16-17):**
- Investigation loop orchestration with bounded iterations
- Model-directed evidence requests using **Gemini 3 Flash Preview** (tool protocol)
- Deterministic fallback planning
- Stop conditions (confidence target, max iterations, no progress)
- Full iteration audit trail

**Safety & Policy (Day 18):**
- Safe mode (default ON)
- Collector policy gating (STUB mode enforcement)
- Evidence request policy (bounds, allowlists, per-iteration limits)
- Data redaction (sourcePayload, prompt traces, evidence bundles)
- Request size limits and rate limiting

**Explainability (Day 19):**
- Explainability graph (evidence → reasoning → conclusion)
- Interactive graph visualization
- Traceability via evidenceRefs

**Audit & Integrity (Day 20):**
- Hash-chained audit log
- Tamper-evident event chain
- Integrity verification endpoint
- Full audit trail for all critical operations

**Production Readiness (Day 21):**
- Docker Compose one-command setup
- Health, readiness, and version endpoints
- Structured logging with correlation IDs
- Timeouts for external API calls
- CI pipeline with smoke tests
- Comprehensive documentation

**Enterprise-Grade UI (Production Workflow Showcase):**
- **Incident Creation Page** (`/analyze`):
  - Source tabs (Scenarios / Google Cloud)
  - Timeline preview with deployment markers
  - Google Cloud incident fetcher and importer
  - Source badges and traceability indicators
  - Idempotency detection
  
- **Incident Workspace** (`/incidents/[id]`):
  - Evidence Bundle section with completeness scoring and type grid
  - Analysis Results section with Gemini 3 reasoning and hypothesis ranking
  - Investigation Loop section with iteration timeline and model requests
  - Explainability Graph section (ready for interactive visualization)
  - Analysis Comparison section with drift detection
  - Postmortem section with Markdown/JSON export
  - Audit Chain section with integrity verification
  
- **Incident List** (`/incidents`):
  - Source badges on each incident
  - Filters by source type and status
  - Quick stats and metadata display
  
- **Export Center** (`/exports`):
  - Feature highlights and bundle information
  - Enhanced export options with detailed breakdowns
  - Copy and download functionality for postmortems and JSON bundles
  
- **Reusable Components**:
  - SourceBadge, StatusBadge, EvidenceCompleteness, EvidenceTypeGrid
  - FeatureSection, HypothesisCard, and more
  - Consistent enterprise-grade styling throughout

📋 **See `docs/ship-checklist.md` for complete feature verification checklist.**
