# ChronosOps Ship Checklist

Use this checklist to verify all features are working before shipping.

## Setup & Infrastructure

- [ ] Fresh clone → `docker compose up -d --build` works
- [ ] Environment variables documented in `.env.example`
- [ ] Database migrations run successfully
- [ ] Health endpoint (`/v1/health`) returns 200
- [ ] Readiness endpoint (`/v1/ready`) returns 200
- [ ] Version endpoint (`/v1/version`) returns version info

## Authentication

- [ ] Auth can be disabled for development (`CHRONOSOPS_AUTH_REQUIRED=false`)
- [ ] Auth works with Keycloak/OIDC provider
- [ ] JWT tokens are validated correctly
- [ ] RBAC roles are enforced (Viewer, Analyst, Admin)
- [ ] Public endpoints (`/v1/health`, `/v1/version`) don't require auth

## Incident Import

- [ ] Scenario-based incidents can be created
- [ ] Google Cloud incidents can be imported
- [ ] Import endpoint validates input
- [ ] Import creates incident record in database

## Incident Analysis

- [ ] Analyze endpoint creates analysis
- [ ] Evidence bundle is built correctly
- [ ] Evidence completeness is computed
- [ ] Reasoning adapter calls Gemini (or stub in safe mode)
- [ ] Analysis result includes hypotheses and explainability
- [ ] Re-analyze endpoint works for existing incidents
- [ ] Analysis comparison endpoint works (`/v1/incidents/:id/analyses/:a/compare/:b`)

## Investigation Loop

- [ ] Start investigation endpoint works (`POST /v1/incidents/:id/investigate`)
- [ ] Investigation session is created
- [ ] Investigation loop runs with bounded iterations
- [ ] Stop conditions work (confidence target, max iterations, no progress)
- [ ] Model-directed evidence requests work (Day 17)
- [ ] Fallback to deterministic plan works
- [ ] Investigation iterations are recorded
- [ ] Get investigation status endpoint works (`GET /v1/investigations/:sessionId`)

## Postmortem Generation

- [ ] Postmortem is generated after analysis
- [ ] Postmortem includes markdown and JSON
- [ ] Postmortem export endpoints work
- [ ] Postmortem history is preserved

## Explainability Graph

- [ ] Explainability graph endpoint works (`GET /v1/incidents/:incidentId/analyses/:analysisId/explainability-graph`)
- [ ] Graph includes evidence nodes
- [ ] Graph includes hypothesis nodes
- [ ] Graph includes action nodes
- [ ] Graph includes conclusion node
- [ ] Edges connect via evidenceRefs

## Audit & Integrity

- [ ] Audit events are emitted for bundle creation
- [ ] Audit events are emitted for analysis creation
- [ ] Audit events are emitted for prompt traces
- [ ] Audit events are emitted for postmortems
- [ ] Audit events are emitted for investigation iterations
- [ ] Audit chain is continuous (prevHash links)
- [ ] Verification endpoint works (`GET /v1/incidents/:id/verify`)
- [ ] Verification detects tampering (if hash is modified)

## Safety & Policy

- [ ] Safe mode defaults to ON (`CHRONOSOPS_SAFE_MODE=true`)
- [ ] Collectors run in STUB mode in safe mode
- [ ] Collectors can be allowlisted for REAL mode
- [ ] Evidence request policy enforces bounds
- [ ] Evidence request policy enforces allowlist
- [ ] Data redaction works (sourcePayload, prompt traces, evidence bundles)
- [ ] RBAC is enforced in service layer
- [ ] Request size limits are enforced (2MB)

## Observability

- [ ] Structured logs include requestId
- [ ] Structured logs include incidentId when available
- [ ] Structured logs include analysisId when available
- [ ] Structured logs include sessionId for investigations
- [ ] User subject is redacted in logs
- [ ] Error responses are normalized

## Reliability

- [ ] External API calls have timeouts
- [ ] Gemini API calls have timeout (30s)
- [ ] Error handling returns proper HTTP status codes
- [ ] Rate limiting is configured (if applicable)

## Security

- [ ] Safe mode is ON by default
- [ ] Prompt trace content is admin-only
- [ ] SourcePayload is admin-only
- [ ] No raw tokens/headers logged
- [ ] CORS is configured correctly
- [ ] Request body size is limited

## CI/CD

- [ ] CI pipeline runs on push/PR
- [ ] CI pipeline installs dependencies
- [ ] CI pipeline runs lint/typecheck
- [ ] CI pipeline builds contracts
- [ ] CI pipeline builds API
- [ ] CI pipeline builds web
- [ ] CI pipeline runs migrations
- [ ] CI pipeline runs smoke tests (health, version, ready)

## Documentation

- [ ] README has quickstart instructions
- [ ] Environment variables are documented
- [ ] API endpoints are documented
- [ ] Ship checklist exists (this file)

---

**Last Updated**: Day 21
**Status**: Ready for production deployment
