# ChronosOps Testing Guide - Day 15 Complete

This guide provides step-by-step instructions to test all available features after Day 15 completion.

## Prerequisites

1. **API Server Running**: Ensure the API is running on `http://localhost:4000`
2. **Database**: PostgreSQL database with migrations applied
3. **Authentication**: You'll need a valid JWT token (or use `@Public` endpoints if available)
4. **Environment Variables**: `DATABASE_URL`, `GEMINI_API_KEY`, etc. configured

## Base URL
```
http://localhost:4000/v1
```

## Authentication
Most endpoints require authentication. Include the JWT token in headers:
```bash
Authorization: Bearer <your-jwt-token>
```

---

# Scenario 1: Analysis Comparison Workflow (Day 15 Feature)

## Purpose
**Why this feature exists**: Compare two analyses of the same incident to detect drift over time. This helps understand:
- How evidence changes between analyses
- How hypotheses evolve as more data is collected
- Whether confidence improves with additional evidence
- What actions were added/removed/changed

This is critical for **auditability** and **replayability** - understanding why an analysis changed.

---

## Step 1: Create a Scenario (if needed)

**Purpose**: Scenarios provide test data for incident analysis.

```bash
# List available scenarios
GET /v1/scenarios

# Response:
[
  {
    "scenarioId": "scenario-001",
    "title": "Latency Spike Scenario"
  },
  ...
]
```

**Why**: Scenarios simulate real incidents with controlled data, allowing reproducible testing.

---

## Step 2: Analyze an Incident (First Analysis)

**Purpose**: Create an incident and perform initial analysis.

```bash
POST /v1/incidents/analyze
Content-Type: application/json

{
  "scenarioId": "scenario-001",
  "windowMinutesBefore": 15,
  "windowMinutesAfter": 15
}
```

**Expected Response**:
```json
{
  "incidentId": "clx123abc...",
  "summary": "Incident analysis summary...",
  "likelyRootCauses": [
    {
      "rank": 1,
      "title": "Recent deployment caused latency spike",
      "confidence": 0.75,
      "evidence": [...],
      "nextActions": [...]
    }
  ],
  "explainability": {
    "primarySignal": "latency",
    "latencyFactor": 2.5,
    "errorFactor": 0.1,
    "rationale": "..."
  },
  ...
}
```

**Why**: This creates an incident from scenario data, collects evidence (metrics, logs, traces, deploys), and generates an AI-powered analysis with hypotheses and recommended actions.

**Save for later**:
- `incidentId`: `clx123abc...`
- `analysisId`: Get from `GET /v1/incidents/:incidentId` → `analyses[0].id`

---

## Step 3: Get Incident Details (to find Analysis IDs)

```bash
GET /v1/incidents/clx123abc...
```

**Expected Response**:
```json
{
  "id": "clx123abc...",
  "scenarioId": "scenario-001",
  "title": "Latency Spike Incident",
  "status": "analyzed",
  "createdAt": "2024-02-07T08:00:00Z",
  "analyses": [
    {
      "id": "analysis-001",
      "createdAt": "2024-02-07T08:00:00Z",
      "evidenceBundleId": "bundle-001",
      ...
    }
  ],
  "postmortems": [...]
}
```

**Save**: `analysisId` from `analyses[0].id` = `analysis-001`

---

## Step 4: Re-analyze the Same Incident (Second Analysis)

**Purpose**: Generate a second analysis, possibly with updated evidence or different reasoning.

```bash
POST /v1/incidents/clx123abc.../analyze
```

**Expected Response**: Similar to Step 2, but may have:
- Different confidence scores
- Updated hypotheses
- New or removed actions
- Different evidence completeness

**Why**: Re-analysis allows:
- **Iterative improvement**: As more evidence becomes available
- **A/B testing**: Compare different analysis strategies
- **Drift detection**: See how analysis changes over time

**Save**: New `analysisId` = `analysis-002`

---

## Step 5: Compare the Two Analyses (Day 15 Feature)

**Purpose**: Detect and explain differences between two analyses.

```bash
GET /v1/incidents/clx123abc.../analyses/analysis-001/compare/analysis-002
```

**Expected Response**:
```json
{
  "kind": "CHRONOSOPS_ANALYSIS_COMPARE_V1",
  "incidentId": "clx123abc...",
  "a": {
    "analysisId": "analysis-001",
    "createdAt": "2024-02-07T08:00:00Z",
    "evidenceBundleId": "bundle-001",
    "confidence": 0.75
  },
  "b": {
    "analysisId": "analysis-002",
    "createdAt": "2024-02-07T08:05:00Z",
    "evidenceBundleId": "bundle-002",
    "confidence": 0.82
  },
  "evidence": {
    "bundleChanged": true,
    "artifactDiffs": [
      {
        "type": "ADDED",
        "key": "artifact:metrics_summary_001",
        "after": {
          "kind": "metrics_summary",
          "title": "GCP Metrics Summary",
          "summary": "..."
        },
        "note": "New metrics evidence added"
      },
      {
        "type": "CHANGED",
        "key": "artifact:logs_summary_001",
        "before": { "summary": "Old summary..." },
        "after": { "summary": "Updated summary..." },
        "note": "Logs summary updated"
      }
    ]
  },
  "reasoning": {
    "primarySignalDiff": {
      "type": "UNCHANGED",
      "key": "primarySignal",
      "before": "latency",
      "after": "latency"
    },
    "hypothesisDiffs": [
      {
        "type": "CHANGED",
        "key": "hypothesis:deployment-rollback",
        "before": { "rank": 1, "confidence": 0.75 },
        "after": { "rank": 1, "confidence": 0.82 },
        "note": "Confidence increased from 0.75 to 0.82"
      },
      {
        "type": "ADDED",
        "key": "hypothesis:database-connection-pool",
        "after": { "rank": 3, "confidence": 0.45 },
        "note": "New hypothesis added"
      }
    ],
    "actionsDiffs": [
      {
        "type": "ADDED",
        "key": "action:check-database-pool",
        "after": {
          "title": "Check database connection pool",
          "priority": "P1",
          "steps": [...]
        },
        "note": "New action recommended"
      },
      {
        "type": "CHANGED",
        "key": "action:rollback-deployment",
        "before": { "priority": "P0" },
        "after": { "priority": "P1" },
        "note": "Priority downgraded from P0 to P1"
      }
    ]
  },
  "completeness": {
    "scoreDiff": {
      "type": "CHANGED",
      "key": "completenessScore",
      "before": 65,
      "after": 80,
      "note": "Completeness improved from 65 to 80"
    },
    "missingDiffs": [
      {
        "type": "REMOVED",
        "key": "missing:TRACES",
        "before": { "need": "TRACES", "priority": "P1" },
        "note": "Traces evidence now available"
      }
    ]
  },
  "summary": {
    "headline": "Analysis improved: confidence increased 0.75 → 0.82, completeness 65 → 80",
    "keyChanges": [
      "Evidence bundle changed: added metrics_summary",
      "Top hypothesis confidence increased 0.75 → 0.82",
      "New hypothesis added: database-connection-pool (rank 3)",
      "Completeness score improved 65 → 80",
      "Traces evidence now available (was missing)",
      "New action recommended: check-database-pool"
    ]
  }
}
```

**Why this feature exists**:
1. **Auditability**: Understand why analysis changed
2. **Debugging**: Identify what evidence or reasoning caused changes
3. **Quality assurance**: Verify analysis improvements over time
4. **Compliance**: Track analysis evolution for regulatory requirements
5. **Learning**: Understand which evidence types improve confidence most

**Key Insights from Response**:
- `evidence.bundleChanged`: Did new evidence arrive?
- `evidence.artifactDiffs`: What specific evidence changed?
- `reasoning.hypothesisDiffs`: How did hypotheses evolve?
- `reasoning.actionsDiffs`: What actions were added/removed/modified?
- `completeness.scoreDiff`: Did evidence completeness improve?
- `summary.keyChanges`: Human-readable summary of changes

---

# Scenario 2: Evidence Audit Trail

## Purpose
**Why this feature exists**: Provide full traceability of evidence collection, storage, and usage. Critical for:
- **Forensics**: Understand what evidence was available when
- **Reproducibility**: Replay analysis with same evidence
- **Compliance**: Prove evidence integrity and chain of custody
- **Debugging**: Identify missing or incorrect evidence

---

## Step 1: Get Incident Details

```bash
GET /v1/incidents/clx123abc...
```

**Response**: See Scenario 1, Step 3

---

## Step 2: List Evidence Bundles for Incident

**Purpose**: See all evidence bundles collected for this incident.

```bash
GET /v1/incidents/clx123abc.../evidence-bundles
```

**Expected Response**:
```json
[
  {
    "id": "bundle-001",
    "bundleId": "eb_abc123...",
    "incidentId": "clx123abc...",
    "createdAt": "2024-02-07T08:00:00Z",
    "createdBy": "user-123",
    "sources": ["GCP_METRICS", "GCP_LOGS", "DEPLOYS"],
    "hashAlgo": "sha256",
    "hashInputVersion": "v1"
  },
  {
    "id": "bundle-002",
    "bundleId": "eb_def456...",
    "incidentId": "clx123abc...",
    "createdAt": "2024-02-07T08:05:00Z",
    "createdBy": "user-123",
    "sources": ["GCP_METRICS", "GCP_LOGS", "GCP_TRACES", "DEPLOYS"],
    "hashAlgo": "sha256",
    "hashInputVersion": "v1"
  }
]
```

**Why**: 
- **Content-addressed storage**: Each bundle has a unique `bundleId` (hash) for immutability
- **Source tracking**: `sources` array shows what evidence types were collected
- **Versioning**: `hashInputVersion` ensures bundle structure compatibility
- **Audit trail**: `createdAt` and `createdBy` track who collected what and when

**Key Observations**:
- Bundle 2 has `GCP_TRACES` that Bundle 1 doesn't → evidence improved
- Both bundles are immutable (content-addressed by hash)

---

## Step 3: Get Specific Evidence Bundle

**Purpose**: View the full evidence bundle payload.

```bash
GET /v1/incidents/evidence-bundles/eb_abc123...
```

**Expected Response**:
```json
{
  "bundleId": "eb_abc123...",
  "incidentId": "clx123abc...",
  "createdAt": "2024-02-07T08:00:00Z",
  "createdBy": "user-123",
  "sources": ["GCP_METRICS", "GCP_LOGS", "DEPLOYS"],
  "payload": {
    "bundleId": "eb_abc123...",
    "incidentId": "clx123abc...",
    "artifacts": [
      {
        "artifactId": "metrics_001",
        "kind": "metrics_summary",
        "title": "GCP Metrics Summary",
        "summary": "P95 latency increased 200ms → 800ms at 08:00",
        "collectedAt": "2024-02-07T08:00:00Z"
      },
      {
        "artifactId": "logs_001",
        "kind": "logs_summary",
        "title": "GCP Logs Summary",
        "summary": "Error rate: 0.1% → 2.5%",
        "collectedAt": "2024-02-07T08:00:00Z"
      },
      {
        "artifactId": "deploys_001",
        "kind": "deploys_summary",
        "title": "Deployments Summary",
        "summary": "Service v1.2.3 deployed at 07:55",
        "collectedAt": "2024-02-07T08:00:00Z"
      }
    ],
    "googleEvidenceLite": null,
    "scenarioTelemetrySummary": null
  },
  "hashAlgo": "sha256",
  "hashInputVersion": "v1"
}
```

**Why**:
- **Immutable evidence**: Bundle content is hashed, ensuring integrity
- **Replayability**: Can replay analysis with exact same evidence
- **Artifact tracking**: Each artifact has unique ID and collection timestamp
- **Source diversity**: Shows metrics, logs, deploys, traces, config diffs

**Key Observations**:
- Each artifact has `kind`, `title`, `summary` for quick understanding
- `collectedAt` timestamps show when evidence was gathered
- Bundle is content-addressed (hash-based) for immutability

---

## Step 4: List Prompt Traces for Incident

**Purpose**: See all AI reasoning traces (prompts and responses) for this incident.

```bash
GET /v1/incidents/clx123abc.../prompt-traces
```

**Expected Response**:
```json
[
  {
    "id": "trace-001",
    "incidentId": "clx123abc...",
    "analysisId": "analysis-001",
    "evidenceBundleId": "eb_abc123...",
    "createdAt": "2024-02-07T08:00:00Z",
    "model": "gemini-pro",
    "promptVersion": "v1",
    "promptHash": "sha256:abc123...",
    "requestHash": "sha256:def456...",
    "responseHash": "sha256:ghi789..."
  },
  {
    "id": "trace-002",
    "incidentId": "clx123abc...",
    "analysisId": "analysis-002",
    "evidenceBundleId": "eb_def456...",
    "createdAt": "2024-02-07T08:05:00Z",
    "model": "gemini-pro",
    "promptVersion": "v1",
    "promptHash": "sha256:jkl012...",
    "requestHash": "sha256:mno345...",
    "responseHash": "sha256:pqr678..."
  }
]
```

**Why**:
- **AI transparency**: Track what prompts were sent to AI
- **Reproducibility**: Hash-based tracking ensures prompt integrity
- **Debugging**: Understand why AI made specific decisions
- **Compliance**: Prove AI reasoning process for audits
- **Versioning**: `promptVersion` tracks prompt template changes

**Key Observations**:
- Each trace links to specific `analysisId` and `evidenceBundleId`
- Hashes ensure prompt/response integrity (can't be tampered with)
- Multiple traces show analysis evolution over time

---

## Step 5: Get Full Prompt Trace (Admin Only)

**Purpose**: View complete prompt and response for detailed audit.

```bash
GET /v1/incidents/prompt-traces/trace-001
```

**Expected Response**:
```json
{
  "id": "trace-001",
  "incidentId": "clx123abc...",
  "analysisId": "analysis-001",
  "evidenceBundleId": "eb_abc123...",
  "createdAt": "2024-02-07T08:00:00Z",
  "model": "gemini-pro",
  "promptVersion": "v1",
  "promptHash": "sha256:abc123...",
  "requestHash": "sha256:def456...",
  "responseHash": "sha256:ghi789...",
  "systemPrompt": "You are an expert incident analyst...",
  "userPrompt": "Analyze this incident:\n\nIncident ID: clx123abc...\n\nEvidence:\n- Metrics: P95 latency increased...\n- Logs: Error rate increased...\n\nHypothesis candidates:\n1. Recent deployment...",
  "requestJson": {
    "incidentId": "clx123abc...",
    "evidenceBundleId": "eb_abc123...",
    "artifacts": [...],
    "candidates": [...]
  },
  "responseJson": {
    "overallConfidence": 0.75,
    "explainability": {
      "primarySignal": "latency",
      "latencyFactor": 2.5,
      "errorFactor": 0.1,
      "rationale": "The primary signal is latency..."
    },
    "hypotheses": [...],
    "recommendedActions": [...]
  }
}
```

**Why**:
- **Full transparency**: See exact prompts sent to AI
- **Reproducibility**: Can replay exact same prompt to verify results
- **Debugging**: Understand AI reasoning process
- **Compliance**: Full audit trail for regulatory requirements
- **Learning**: Improve prompts based on actual AI responses

**Key Observations**:
- `systemPrompt`: Instructions to AI (role, behavior)
- `userPrompt`: Actual incident data and evidence
- `requestJson`: Structured request data
- `responseJson`: AI's structured response
- All hashed for integrity verification

---

# Scenario 3: Postmortem Generation

## Purpose
**Why this feature exists**: Automatically generate postmortem documents from incident analysis. Benefits:
- **Documentation**: Capture incident details automatically
- **Knowledge sharing**: Share learnings across team
- **Compliance**: Required documentation for many organizations
- **Time savings**: Auto-generate instead of manual writing
- **Consistency**: Standardized postmortem format

---

## Step 1: Analyze Incident (if not already done)

```bash
POST /v1/incidents/analyze
{
  "scenarioId": "scenario-001",
  "windowMinutesBefore": 15,
  "windowMinutesAfter": 15
}
```

**Note**: Postmortem is automatically generated during analysis.

---

## Step 2: List Postmortems for Incident

**Purpose**: See all postmortems generated for this incident.

```bash
GET /v1/incidents/clx123abc.../postmortems
```

**Expected Response**:
```json
[
  {
    "id": "postmortem-001",
    "incidentId": "clx123abc...",
    "createdAt": "2024-02-07T08:00:00Z",
    "generatorVersion": "v2"
  }
]
```

**Why**:
- **Version tracking**: `generatorVersion` tracks postmortem template changes
- **Multiple postmortems**: Can regenerate as analysis improves
- **Timeline**: `createdAt` shows when postmortem was generated

---

## Step 3: Get Postmortem Markdown

**Purpose**: Get human-readable postmortem document.

```bash
GET /v1/incidents/postmortems/postmortem-001/markdown
```

**Expected Response** (Markdown text):
```markdown
# Postmortem: Latency Spike Incident

**Incident ID**: clx123abc...
**Created**: 2024-02-07T08:00:00Z
**Status**: analyzed

## Executive Summary

This incident involved a significant latency spike affecting the main API service...

## Timeline

- **07:55**: Service v1.2.3 deployed
- **08:00**: P95 latency increased from 200ms to 800ms
- **08:05**: Error rate increased from 0.1% to 2.5%
- **08:15**: Incident detected and analyzed

## Root Causes

### 1. Recent Deployment (Confidence: 0.82)

The deployment of service v1.2.3 at 07:55 directly preceded the latency spike...

**Evidence**:
- Deployment timestamp matches incident start
- Metrics show latency increase immediately after deployment
- No other significant changes detected

### 2. Database Connection Pool Exhaustion (Confidence: 0.45)

Potential connection pool issues may have contributed...

## Impact

- **Services Affected**: api-service
- **Routes Affected**: /api/users, /api/orders
- **User Impact**: ~5% of requests experienced >1s latency

## Actions Taken

1. **Rollback Deployment** (Priority: P1)
   - Rolled back service v1.2.3 to v1.2.2
   - Latency returned to baseline within 5 minutes

2. **Check Database Connection Pool** (Priority: P1)
   - Verified connection pool settings
   - Increased pool size as preventive measure

## Lessons Learned

- Deployment process should include gradual rollout
- Database connection pool monitoring needed
- Need better pre-deployment testing

## Evidence Completeness

**Score**: 80/100

**Present**:
- Metrics: ✓
- Logs: ✓
- Traces: ✓
- Deploys: ✓

**Missing**:
- Config diffs: Not available

## Analysis Metadata

- **Analysis ID**: analysis-002
- **Evidence Bundle**: eb_def456...
- **Model**: gemini-pro
- **Prompt Version**: v1
- **Overall Confidence**: 0.82
```

**Why**:
- **Human-readable**: Markdown format is easy to read and share
- **Structured**: Consistent format across all postmortems
- **Complete**: Includes timeline, root causes, actions, evidence
- **Shareable**: Can be exported to wiki, docs, or email

---

## Step 4: Get Postmortem JSON

**Purpose**: Get structured postmortem data for programmatic use.

```bash
GET /v1/incidents/postmortems/postmortem-001/json
```

**Expected Response**:
```json
{
  "kind": "CHRONOSOPS_POSTMORTEM_V2",
  "incident": {
    "id": "clx123abc...",
    "title": "Latency Spike Incident",
    "sourceType": "SCENARIO",
    "sourceRef": "scenario-001",
    "createdAt": "2024-02-07T08:00:00Z"
  },
  "analysis": {
    "id": "analysis-002",
    "createdAt": "2024-02-07T08:05:00Z",
    "evidenceBundleId": "eb_def456...",
    "evidenceCompleteness": {
      "score": 80,
      "present": ["METRICS", "LOGS", "TRACES", "DEPLOYS"],
      "missing": [{"need": "CONFIG", "priority": "P2"}]
    },
    "reasoningJson": {
      "overallConfidence": 0.82,
      "explainability": {...},
      "hypotheses": [...],
      "recommendedActions": [...]
    }
  },
  "evidenceBundle": {
    "bundleId": "eb_def456...",
    "artifacts": [...]
  },
  "timeline": {
    "start": "2024-02-07T07:45:00Z",
    "end": "2024-02-07T08:15:00Z"
  },
  "promptTrace": {
    "id": "trace-002",
    "promptHash": "sha256:jkl012...",
    "responseHash": "sha256:pqr678..."
  }
}
```

**Why**:
- **Programmatic access**: Structured data for automation
- **Integration**: Can be imported into other systems
- **Analysis**: Can be processed by scripts or tools
- **Versioning**: `kind` field tracks postmortem schema version

---

# Scenario 4: Google Cloud Integration

## Purpose
**Why this feature exists**: Import real incidents from Google Cloud Status page. Benefits:
- **Real-world data**: Test with actual production incidents
- **Automation**: No manual incident creation needed
- **Integration**: Connect with Google Cloud monitoring
- **Historical data**: Import past incidents for analysis

---

## Step 1: Import Google Cloud Incidents

**Purpose**: Fetch and import incidents from Google Cloud Status.

```bash
POST /v1/incidents/import/google
Content-Type: application/json

{
  "limit": 5
}
```

**Expected Response**:
```json
{
  "imported": 3,
  "skipped": 2,
  "fetched": 10,
  "fetchedAt": "2024-02-07T08:00:00Z"
}
```

**Why**:
- **Idempotency**: `skipped` count shows incidents that already existed (by `sourceRef`)
- **Limit control**: `limit` prevents importing too many at once
- **Status tracking**: `fetched` shows total available, `imported` shows new ones

**Key Observations**:
- `imported`: New incidents created
- `skipped`: Incidents that already existed (by `sourceRef`)
- `fetched`: Total incidents available from Google Cloud

---

## Step 2: List All Incidents

**Purpose**: See imported incidents along with others.

```bash
GET /v1/incidents
```

**Expected Response**:
```json
[
  {
    "id": "clx123abc...",
    "scenarioId": "scenario-001",
    "title": "Latency Spike Incident",
    "status": "analyzed",
    "createdAt": "2024-02-07T08:00:00Z",
    "sourceType": "SCENARIO",
    "sourceRef": "scenario-001"
  },
  {
    "id": "clx456def...",
    "scenarioId": "google-cloud-incident-001",
    "title": "Google Cloud Compute Engine Issue",
    "status": "analyzed",
    "createdAt": "2024-02-07T07:30:00Z",
    "sourceType": "GOOGLE_CLOUD",
    "sourceRef": "https://status.cloud.google.com/incidents/xyz"
  },
  ...
]
```

**Why**:
- **Unified view**: See both scenario-based and Google Cloud incidents
- **Source tracking**: `sourceType` and `sourceRef` identify origin
- **Status filtering**: Can filter by `status` field

**Key Observations**:
- `sourceType: "GOOGLE_CLOUD"` identifies imported incidents
- `sourceRef` contains the Google Cloud Status URL
- All incidents follow same structure regardless of source

---

## Step 3: View Imported Incident Details

**Purpose**: See full details of imported Google Cloud incident.

```bash
GET /v1/incidents/clx456def...
```

**Expected Response**:
```json
{
  "id": "clx456def...",
  "scenarioId": "google-cloud-incident-001",
  "title": "Google Cloud Compute Engine Issue",
  "status": "analyzed",
  "createdAt": "2024-02-07T07:30:00Z",
  "sourceType": "GOOGLE_CLOUD",
  "sourceRef": "https://status.cloud.google.com/incidents/xyz",
  "sourcePayload": {
    "uri": "https://status.cloud.google.com/incidents/xyz",
    "affected_products": [
      {
        "id": "compute-engine",
        "title": "Compute Engine"
      }
    ],
    "severity": "high",
    "status_impact": "investigating",
    "begin": "2024-02-07T07:00:00Z",
    "most_recent_update": {
      "modified": "2024-02-07T07:30:00Z",
      "status": "investigating",
      "text": "We are investigating..."
    }
  },
  "analyses": [...],
  "postmortems": [...]
}
```

**Why**:
- **Full context**: `sourcePayload` contains original Google Cloud data
- **Traceability**: `sourceRef` links back to original incident
- **Rich metadata**: Google Cloud provides severity, affected products, updates
- **Analysis ready**: Can be analyzed like any other incident

**Key Observations**:
- `sourcePayload` preserves original Google Cloud incident data
- Incident can be analyzed like scenario-based incidents
- Google Cloud evidence is automatically extracted and included

---

# Complete Testing Workflow

## Full End-to-End Test

Here's a complete workflow testing all features:

```bash
# 1. Import Google Cloud incidents
POST /v1/incidents/import/google
{"limit": 3}
# Save: incidentId from response

# 2. List incidents
GET /v1/incidents
# Verify imported incidents appear

# 3. Get incident details
GET /v1/incidents/:incidentId
# Save: analysisId from analyses[0].id

# 4. Analyze incident (creates new analysis)
POST /v1/incidents/:incidentId/analyze
# Save: new analysisId

# 5. Compare analyses (Day 15 feature)
GET /v1/incidents/:incidentId/analyses/:analysisId1/compare/:analysisId2
# Verify drift detection works

# 6. List evidence bundles
GET /v1/incidents/:incidentId/evidence-bundles
# Save: bundleId

# 7. Get evidence bundle
GET /v1/incidents/evidence-bundles/:bundleId
# Verify evidence structure

# 8. List prompt traces
GET /v1/incidents/:incidentId/prompt-traces
# Save: traceId

# 9. Get prompt trace (Admin only)
GET /v1/incidents/prompt-traces/:traceId
# Verify prompt/response integrity

# 10. List postmortems
GET /v1/incidents/:incidentId/postmortems
# Save: postmortemId

# 11. Get postmortem markdown
GET /v1/incidents/postmortems/:postmortemId/markdown
# Verify human-readable format

# 12. Get postmortem JSON
GET /v1/incidents/postmortems/:postmortemId/json
# Verify structured data
```

---

# Feature Summary & Why Each Exists

## Core Features

### 1. Incident Analysis
**Why**: Automate root cause analysis using AI, reducing time from hours to minutes.

### 2. Evidence Collection
**Why**: Centralize evidence from multiple sources (metrics, logs, traces, deploys) for comprehensive analysis.

### 3. Evidence Bundles (Content-Addressed)
**Why**: Immutable, hash-based storage ensures evidence integrity and enables replayability.

### 4. Prompt Traces
**Why**: Full transparency into AI reasoning process for auditability and debugging.

### 5. Postmortem Generation
**Why**: Automatically document incidents, saving time and ensuring consistency.

## Day 15 Feature

### 6. Analysis Comparison (Drift Detection)
**Why**: 
- **Auditability**: Understand why analysis changed
- **Quality assurance**: Verify analysis improvements
- **Debugging**: Identify what evidence caused changes
- **Compliance**: Track analysis evolution
- **Learning**: Understand which evidence improves confidence

## Integration Features

### 7. Google Cloud Integration
**Why**: Import real-world incidents for testing and production use.

---

# Testing Checklist

- [ ] Scenario 1: Analysis Comparison (Day 15)
  - [ ] Create incident via analyze endpoint
  - [ ] Re-analyze same incident
  - [ ] Compare two analyses
  - [ ] Verify drift detection (evidence, hypotheses, actions, completeness)

- [ ] Scenario 2: Evidence Audit Trail
  - [ ] List evidence bundles
  - [ ] Get specific bundle
  - [ ] List prompt traces
  - [ ] Get full prompt trace (Admin)

- [ ] Scenario 3: Postmortem Generation
  - [ ] List postmortems
  - [ ] Get markdown format
  - [ ] Get JSON format

- [ ] Scenario 4: Google Cloud Integration
  - [ ] Import incidents
  - [ ] List incidents (verify imported)
  - [ ] View imported incident details

---

# Troubleshooting

## Common Issues

1. **Authentication Errors**: Ensure JWT token is valid and has correct roles
2. **Missing Evidence**: Check that collectors are configured (GCP credentials, etc.)
3. **Analysis Failures**: Verify GEMINI_API_KEY is set
4. **Database Errors**: Ensure migrations are applied and DATABASE_URL is correct

## Verification Commands

```bash
# Check API health
GET /v1/health

# Check database connection
# (via Prisma Studio or direct query)

# Verify environment variables
echo $DATABASE_URL
echo $GEMINI_API_KEY
```

---

# Next Steps After Testing

1. **Verify Analysis Comparison**: Ensure drift detection works correctly
2. **Test Edge Cases**: Compare analyses with no changes, missing evidence, etc.
3. **Performance Testing**: Test with large evidence bundles
4. **UI Integration**: Test analysis comparison in web UI (if implemented)
