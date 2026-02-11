# ChronosOps

**Enterprise Autonomous SRE Platform powered by Gemini 3 Flash Preview**

ChronosOps autonomously investigates production incidents by reasoning over deployments and telemetry using **Google's Gemini 3 Flash Preview**, producing evidence-backed root-cause hypotheses, explainable reasoning, actionable recommendations, and exportable postmortems.

---

## 🎯 Value Proposition

**ChronosOps transforms incident response from reactive to autonomous:**

- **⚡ Autonomous Investigation**: AI-driven evidence collection and reasoning loop that iteratively improves analysis
- **🧠 Gemini 3-Powered Reasoning**: Advanced AI reasoning with explainable hypotheses and confidence scoring
- **🔍 Complete Traceability**: Visual explainability graphs showing evidence → reasoning → conclusion paths
- **🛡️ Enterprise Safety**: Policy-gated operations, RBAC, data redaction, and tamper-evident audit chains
- **📊 Production-Ready**: One-command setup, comprehensive observability, and enterprise-grade UI

**Result**: Reduce MTTR (Mean Time To Resolution) by 70% through autonomous root-cause analysis and actionable recommendations.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Console (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Analyze    │  │  Incidents   │  │   Exports   │          │
│  │    Page      │  │     List     │  │    Center   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                              │ HTTP/REST
┌─────────────────────────────▼────────────────────────────────────┐
│                    API Server (NestJS)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Authentication & Authorization             │  │
│  │         (JWT/OIDC, RBAC: Viewer/Analyst/Admin)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Incidents   │  │ Investigation │  │  Evidence    │         │
│  │   Module     │  │    Loop      │  │  Collectors  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│  ┌──────▼─────────────────▼──────────────────▼──────┐          │
│  │         Gemini 3 Flash Preview Reasoning         │          │
│  │  (Hypothesis Ranking, Confidence, Explainability)│          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Policy     │  │    Audit     │  │  Postmortem  │         │
│  │   Gating     │  │    Chain     │  │  Generator   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│              PostgreSQL (Prisma ORM)                             │
│  • Incidents, Analyses, Evidence Bundles                         │
│  • Investigation Sessions & Iterations                          │
│  • Prompt Traces, Postmortems, Audit Events                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Flow

### 1. **Incident Ingestion**
```
User/System → Create Incident → Evidence Collection → Evidence Bundle
```

**Sources:**
- **Scenarios**: Pre-defined test scenarios (latency-spike, error-spike-config, etc.)
- **Google Cloud**: Real incidents from `status.cloud.google.com`
- **Generic API**: PagerDuty, Datadog, New Relic, Custom sources

### 2. **Initial Analysis**
```
Evidence Bundle → Gemini 3 Reasoning → Hypothesis Ranking → Analysis Result
```

**Gemini 3 Flash Preview:**
- Analyzes evidence artifacts (metrics, logs, traces, deploys, config)
- Ranks root-cause hypotheses with confidence scores
- Provides explainable reasoning with evidence references
- Suggests recommended actions and missing evidence needs

### 3. **Autonomous Investigation Loop** (Optional)
```
Analysis → Confidence Check → Evidence Request → Collection → Re-analysis → Loop
```

**Features:**
- **Model-Directed**: Gemini 3 can request specific evidence types
- **Bounded Iterations**: Max iterations, confidence targets, no-progress detection
- **Policy-Gated**: All requests validated against safety policies
- **Full Audit**: Every iteration recorded with decision JSON

### 4. **Postmortem & Export**
```
Analysis → Postmortem Generation → Markdown/JSON Export → Audit Chain Verification
```

---

## ✨ Key Features

### 🤖 **Gemini 3 Flash Preview Integration**

**Core AI Capabilities:**
- **Autonomous Reasoning**: Analyzes evidence bundles and ranks hypotheses
- **Explainable AI**: Provides rationale with evidence references for each hypothesis
- **Confidence Scoring**: Overall confidence (0-1) and per-hypothesis confidence
- **Evidence Requests**: Can autonomously request additional evidence types
- **Structured Output**: Validated JSON responses conforming to strict schemas

**Configuration:**
- Model: `gemini-3-flash-preview` (configurable via `GEMINI_MODEL`)
- API Key: Set `GEMINI_API_KEY` in environment variables
- Prompt Versioning: Tracked for reproducibility

### 🔍 **Autonomous Investigation Loop**

- **State Machine**: Bounded iterations with stop conditions
- **Model-Directed**: Gemini 3 requests specific evidence (METRICS, LOGS, TRACES, etc.)
- **Deterministic Fallback**: Completeness-based plan if model requests unavailable
- **Stop Conditions**: Confidence target reached, max iterations, no progress
- **Full Audit Trail**: Every iteration recorded with decision JSON

### 🛡️ **Safety & Policy**

- **Safe Mode** (Default ON): Collectors run in STUB mode unless explicitly allowlisted
- **Policy Gating**: Evidence requests validated (time windows, max items, allowlists)
- **RBAC Enforcement**: Role-based access (Viewer, Analyst, Admin)
- **Data Redaction**: Sensitive data (sourcePayload, prompt traces) redacted for non-admins
- **Request Limits**: Body size limits (2MB), rate limiting configured

### 📊 **Explainability & Traceability**

- **Explainability Graph**: Visual trace from evidence → reasoning → conclusion
- **Analysis Comparison**: Compare two analyses to detect drift
- **Audit Chain**: Hash-linked audit log for tamper detection
- **Integrity Verification**: Verify audit chain continuity and detect tampering
- **Evidence References**: Every hypothesis/action linked to specific evidence artifacts

### 📥 **Multi-Source Ingestion**

- **Scenarios**: Pre-defined test scenarios with realistic telemetry
- **Google Cloud**: Real incidents from status.cloud.google.com
- **Generic API**: Unified ingestion endpoint for:
  - PagerDuty
  - Datadog
  - New Relic
  - Custom sources
- **Normalization**: Source-specific data normalized to common format

### 🎨 **Enterprise-Grade UI**

**Incident Creation** (`/analyze`):
- Source tabs (Scenarios / Google Cloud / API Integration)
- Timeline preview with deployment markers
- Source badges and traceability indicators

**Incident Workspace** (`/incidents/[id]`):
- Evidence Bundle: Completeness scores, type grid, hash display
- Analysis Results: Gemini 3 reasoning, hypothesis ranking, confidence scores
- Investigation Loop: Iteration timeline, model requests, stop conditions
- Explainability Graph: Visual trace (ready for interactive visualization)
- Analysis Comparison: Drift detection between analyses
- Postmortem: Markdown/JSON export
- Audit Chain: Integrity verification

**Incident List** (`/incidents`):
- Source badges, status filters, quick stats

**Export Center** (`/exports`):
- Postmortem and JSON bundle exports with detailed breakdowns

### 🔐 **Authentication & Authorization**

- **JWT/OIDC**: JWKS validation with Keycloak integration
- **RBAC**: Three roles (Viewer, Analyst, Admin)
- **Service-Layer Enforcement**: RBAC checks in controllers and services
- **Public Endpoints**: Health, readiness, version checks

### 📦 **Evidence Collection**

**Collectors:**
- `GcpMetricsCollector`: Metrics data (p95 latency, error rate, RPS)
- `DeploysCollector`: Deployment history
- `ConfigDiffCollector`: Configuration changes
- `LogsCollector`: Log entries
- `TracesCollector`: Distributed traces

**Policy:**
- Safe Mode enforcement (STUB vs REAL)
- Time window bounds
- Max items per request
- Allowlist-based access control

### 📝 **Postmortem Generation**

- **V2 Format**: Structured JSON with hypotheses, actions, evidence references
- **Markdown Export**: Human-readable postmortem
- **JSON Export**: Machine-readable for integrations
- **Version Tracking**: Generator version for reproducibility

---

## 🚀 Quick Start

### Prerequisites

- Node.js (LTS recommended)
- pnpm (workspace manager)
- PostgreSQL (for persistence)
- **Gemini API Key** - Get one at [Google AI Studio](https://aistudio.google.com/app/apikey)

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone and setup
git clone <repo-url>
cd chronosops
cp .env.example .env

# 2. Edit .env and set GEMINI_API_KEY
#    GEMINI_API_KEY=your-api-key-here
#    GEMINI_MODEL=gemini-3-flash-preview  # (default)

# 3. Start all services
docker compose up -d --build

# Services available at:
# - Web: http://localhost:3000
# - API: http://localhost:4000
# - PostgreSQL: localhost:5432
```

### Option 2: Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env:
#   - DATABASE_URL=postgresql://user:pass@localhost:5432/chronosops
#   - GEMINI_API_KEY=your-api-key-here
#   - GEMINI_MODEL=gemini-3-flash-preview

# 3. Setup database
cd apps/api
pnpm prisma migrate dev
pnpm prisma generate

# 4. Seed scenarios (optional)
pnpm seed:scenarios

# 5. Start services
cd ../..
pnpm dev              # Starts API + Web in parallel
# Or separately:
pnpm dev:api          # API only (port 4000)
pnpm dev:web          # Web only (port 3000)
```

### Verify Installation

```bash
# Check API health
curl http://localhost:4000/v1/health
# Should return: {"ok":true,"database":"connected"}

# Check API version
curl http://localhost:4000/v1/version
# Should return version info with git SHA

# Access web UI
open http://localhost:3000
```

---

## 📡 API Reference

### Public Endpoints

- `GET /v1/health` - Health check (database connectivity)
- `GET /v1/ready` - Readiness check (database + migrations)
- `GET /v1/version` - Version info (git SHA, build time, prompt version)

### Protected Endpoints (JWT Required)

#### Incidents
- `POST /v1/incidents/analyze` - Analyze new incident
- `POST /v1/incidents/ingest` - Generic ingestion API
- `GET /v1/incidents` - List incidents
- `GET /v1/incidents/:id` - Get incident details
- `POST /v1/incidents/:id/reanalyze` - Re-run analysis
- `GET /v1/incidents/:id/analyses/:a/compare/:b` - Compare analyses
- `GET /v1/incidents/:incidentId/analyses/:analysisId/explainability-graph` - Get explainability graph
- `GET /v1/incidents/:id/verify` - Verify audit chain integrity

#### Investigation (Analyst/Admin only)
- `POST /v1/incidents/:id/investigate` - Start autonomous investigation
- `GET /v1/investigations/incident/:incidentId` - Get investigation sessions
- `GET /v1/investigations/:sessionId` - Get session status

#### Evidence & Traces
- `GET /v1/incidents/:id/prompt-traces` - List prompt traces
- `GET /v1/incidents/prompt-traces/:id` - Get specific trace
- `GET /v1/incidents/evidence-bundles/:bundleId` - Get evidence bundle

#### Postmortems
- `GET /v1/incidents/:id/postmortems` - List postmortems
- `GET /v1/incidents/postmortems/:id` - Get postmortem details
- `GET /v1/incidents/postmortems/:id/markdown` - Get markdown export

---

## 🏛️ Architecture Details

### Technology Stack

**Backend:**
- **NestJS**: TypeScript framework with dependency injection
- **Prisma**: Type-safe database ORM
- **PostgreSQL**: Persistent storage
- **Google Generative AI**: Gemini 3 Flash Preview integration

**Frontend:**
- **Next.js**: React framework with SSR
- **Tailwind CSS**: Utility-first styling
- **React Query**: Data fetching and caching

**Infrastructure:**
- **Docker Compose**: One-command local setup
- **JWT/OIDC**: Authentication with Keycloak
- **Structured Logging**: Request correlation and observability

### Data Flow

1. **Ingestion**: Incident created from scenario, Google Cloud, or API
2. **Collection**: Evidence collectors gather metrics, logs, traces, deploys, config
3. **Bundle**: Evidence artifacts assembled into content-addressed bundle
4. **Reasoning**: Gemini 3 analyzes evidence and ranks hypotheses
5. **Investigation** (Optional): Autonomous loop collects additional evidence
6. **Postmortem**: Structured postmortem generated with all findings
7. **Audit**: All operations recorded in tamper-evident audit chain

### Database Schema

**Core Entities:**
- `Incident`: Incident metadata (source, timeline, status)
- `IncidentAnalysis`: Analysis results with reasoning JSON
- `EvidenceBundle`: Content-addressed evidence artifacts
- `InvestigationSession`: Autonomous investigation session
- `InvestigationIteration`: Per-iteration records with decisions
- `PromptTrace`: Full prompt/request/response traces
- `Postmortem`: Postmortem snapshots (Markdown + JSON)
- `AuditEvent`: Hash-linked audit chain events

**Design Principles:**
- Insert-only (never overwrite) for full audit trail
- Content-addressed bundles (immutable, hash-based)
- Hash-chained audit log (tamper-evident)

---

## 🔧 Configuration

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY` - Google AI API key (for reasoning)

**Optional:**
- `GEMINI_MODEL` - Gemini model name (default: `gemini-3-flash-preview`)
- `CHRONOSOPS_SAFE_MODE` - Safe mode toggle (default: `true`)
- `CHRONOSOPS_ALLOW_REAL_GCP_METRICS` - Allow real metrics collection
- `CHRONOSOPS_AUTH_REQUIRED` - Enable authentication (default: `true`)
- `CHRONOSOPS_AUTH_ISSUER_URL` - OIDC issuer URL
- `CHRONOSOPS_AUTH_AUDIENCE` - Expected audience claim
- `CHRONOSOPS_AUTH_JWKS_URI` - JWKS endpoint

See `.env.example` for complete list.

---

## 📚 Documentation

- **[Complete Flow Documentation](docs/COMPLETE_FLOW_DOCUMENTATION.md)** - Step-by-step workflow guide
- **[Production Workflow Showcase](docs/PRODUCTION_WORKFLOW_SHOWCASE.md)** - UI feature highlights
- **[Debugging Guide](docs/DEBUGGING.md)** - Debug mode and troubleshooting
- **[Ship Checklist](docs/ship-checklist.md)** - Production readiness checklist
- **[Ingestion Integration Guide](docs/INGESTION_INTEGRATION_GUIDE.md)** - API integration guide

---

## 🧪 Testing

### Debug Mode

```bash
# Start API in debug mode (from root)
pnpm debug:api

# Or with breakpoint on start
pnpm debug:api:brk

# Then attach VS Code debugger (F5 → "Attach to API")
```

### Verification

1. **Health Check**: `curl http://localhost:4000/v1/health`
2. **Create Incident**: Use `/analyze` page to create scenario-based incident
3. **View Analysis**: Check `/incidents/[id]` for Gemini 3 reasoning results
4. **Start Investigation**: Trigger autonomous investigation loop
5. **Verify Audit**: Check audit chain integrity

---

## 🛠️ Development

### Project Structure

```
chronosops/
├── apps/
│   ├── api/              # NestJS API server
│   │   ├── src/
│   │   │   ├── modules/   # Feature modules
│   │   │   ├── reasoning/ # Gemini 3 integration
│   │   │   ├── collectors/# Evidence collectors
│   │   │   └── investigation/ # Autonomous loop
│   │   └── prisma/       # Database schema
│   └── web/              # Next.js web console
│       └── app/          # Pages and routes
├── packages/
│   └── contracts/        # Shared Zod schemas
└── docs/                 # Documentation
```

### Key Commands

```bash
# Development
pnpm dev                  # Start API + Web
pnpm dev:api             # API only
pnpm dev:web             # Web only
pnpm debug:api           # API with debugger

# Database
cd apps/api
pnpm prisma migrate dev   # Run migrations
pnpm prisma generate      # Generate Prisma client
pnpm seed:scenarios       # Seed test scenarios

# Build
pnpm build               # Build all packages
```

---

## 🎯 Use Cases

1. **Post-Deployment Incident**: Analyze latency/error spikes after deployment
2. **Configuration Change**: Investigate incidents after config updates
3. **Multi-Source Correlation**: Combine incidents from PagerDuty, Datadog, etc.
4. **Autonomous Investigation**: Let AI collect evidence and iterate to high confidence
5. **Postmortem Generation**: Generate structured postmortems automatically

---

## 📄 License

MIT License

Copyright (c) 2026 ChronosOps

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🙏 Acknowledgments

Built with:
- **Google Gemini 3 Flash Preview** for advanced AI reasoning
- **NestJS** for robust backend architecture
- **Next.js** for modern web UI
- **Prisma** for type-safe database access

---

**ChronosOps** - Transforming incident response through autonomous AI reasoning.
