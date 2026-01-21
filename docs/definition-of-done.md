# ChronosOps — Definition of Done (MVP v1 Baseline)

**Tag:** mvp-v1

## Purpose
Freeze the MVP scope for ChronosOps so future enterprise work can be validated against a stable baseline.

## MVP Scope (Must Have)
### Product
- Web Console (Next.js) loads and renders incident workflow
- API (NestJS) serves version + scenario data + analysis results

### Scenarios
- `latency-spike`
- `error-spike-config`

### Telemetry & Timeline
- 30-minute timeline simulation
- Clickable timeline phases: Before → Deploy → Spike → Peak
- Metrics shown:
  - p95 latency
  - error rate
  - RPS

### Incident Analysis
- Evidence derived from telemetry (baseline vs after)
- Adaptive hypothesis selection (latency vs errors)
- Explainability object includes:
  - `primarySignal`
  - `latencyFactor`
  - `errorFactor`
  - `rationale`
- Evidence table includes:
  - baseline / after / delta / factor

### Runbooks
- Scenario-aware runbook panel renders with actionable steps

### Exports
- Copy incident brief
- Copy postmortem (Markdown)
- Copy incident JSON

### UX & Reliability
- Toast feedback on copy/export actions
- API connectivity indicator using `GET /v1/version`
- Strict schema validation via shared contracts (`packages/contracts`)

## Non-Goals (Explicitly Out of Scope for MVP)
- Persistence / database storage
- Authentication / RBAC / tenant model
- Audit logs / correlation IDs
- Webhooks / integrations
- Auto-remediation or write actions
- Real telemetry ingestion (OTel, Datadog, Prometheus)
- Background jobs / schedulers
- SLO management / alert routing

## Build & Run Requirements
- `pnpm install` succeeds
- `pnpm -r build` succeeds
- `pnpm -r dev` runs web + api locally

## Known Limitations
- Scenario telemetry is simulated
- Analysis is deterministic, not LLM-driven in MVP baseline
- No long-term storage, incidents are ephemeral

## Acceptance Checklist
- [ ] `/v1/health` returns OK
- [ ] `/v1/version` returns version payload
- [ ] Web console loads and shows API connectivity as online
- [ ] Both scenarios are selectable and analyzable
- [ ] Evidence table renders baseline/after/delta/factor
- [ ] Explainability object renders with primarySignal + rationale
- [ ] Runbook panel renders for selected scenario
- [ ] Postmortem markdown and incident JSON are copyable

## Verification
This doc matches what exists today exactly (no promises).

Everything listed in "Must Have" can be demonstrated right now.
