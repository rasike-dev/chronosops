# ChronosOps Complete Flow Documentation

## Overview
This document provides a comprehensive step-by-step guide to the complete ChronosOps workflow, from incident creation to full completion. This is the definitive reference for understanding how all components work together.

---

## Table of Contents
1. [Phase 1: Incident Ingestion](#phase-1-incident-ingestion)
2. [Phase 2: Initial Analysis](#phase-2-initial-analysis)
3. [Phase 3: Autonomous Investigation Loop](#phase-3-autonomous-investigation-loop)
4. [Phase 4: Postmortem Generation](#phase-4-postmortem-generation)
5. [Phase 5: Export & Verification](#phase-5-export--verification)

---

## Phase 1: Incident Ingestion

### Step 1.1: User Initiates Incident Creation
**Location:** `/analyze` page (Web UI)

**User Actions:**
- User navigates to "Create Incident" page
- Chooses one of two sources:
  - **Tab 1: Scenarios** - Pre-defined test scenarios
  - **Tab 2: Google Cloud** - Real Google Cloud Status incidents

**For Scenarios:**
1. User selects a scenario from dropdown (e.g., "latency-spike")
2. Configures time window:
   - `windowMinutesBefore` (default: 15 minutes)
   - `windowMinutesAfter` (default: 15 minutes)
3. Clicks "Analyze Incident" button

**For Google Cloud:**
1. User clicks "Fetch Google Cloud Incidents" button
2. System fetches recent incidents from `status.cloud.google.com`
3. User selects an incident from the list
4. Clicks "Import & Analyze" button

### Step 1.2: API Request - Analyze Endpoint
**Endpoint:** `POST /v1/incidents/analyze`
**Controller:** `IncidentsController.analyze()`

**Request Body (Scenario):**
```json
{
  "scenarioId": "latency-spike",
  "windowMinutesBefore": 15,
  "windowMinutesAfter": 15
}
```

**Request Body (Google Cloud):**
```json
{
  "evidence": {
    "googleEvidenceLite": {
      "headline": "...",
      "status": "investigating",
      "severity": "high",
      "timeline": { ... },
      "service": "...",
      "region": "..."
    }
  }
}
```

### Step 1.3: Evidence Collection (First Pass)
**Location:** `IncidentsController.analyze()`

**Process:**
1. **For Scenarios:**
   - Load scenario data from `ScenarioService`
   - Extract telemetry (metrics, logs, traces)
   - Build `scenarioTelemetrySummary`

2. **For Google Cloud:**
   - Extract `googleEvidenceLite` from request
   - Parse timeline, service, region information

3. **Collector Execution:**
   - All collectors run in parallel:
     - `GcpMetricsCollector.collect()` - Metrics data
     - `DeploysCollector.collect()` - Deployment history
     - `ConfigDiffCollector.collect()` - Configuration changes
     - `LogsCollector.collect()` - Log entries
     - `TracesCollector.collect()` - Distributed traces
   - Each collector respects:
     - **Safe Mode** (default: ON) - Forces STUB mode unless allowlisted
     - **Policy Gating** - Checks `CHRONOSOPS_ALLOW_REAL_*` env vars
     - **Time Window** - Bounded by incident timeline

4. **Collector Results:**
   - Each collector returns an artifact or `null`
   - Artifacts are structured with:
     - `artifactId` (unique ID)
     - `kind` (e.g., "metrics_summary", "logs_summary")
     - `title`, `summary`, `payload`

### Step 1.4: Evidence Bundle Creation
**Location:** `buildEvidenceBundle()`

**Process:**
1. Combine all evidence sources:
   - Scenario telemetry OR Google Evidence Lite
   - Collector artifacts (5 types)
   - Source metadata

2. Generate bundle:
   - `bundleId` - Content-addressed ID (deterministic)
   - `hash` - SHA256 hash of canonical JSON
   - `hashAlgo` - "sha256"
   - `hashInputVersion` - "v1"
   - `sources` - Array of source types (e.g., ["SCENARIO", "GCP_METRICS"])
   - `artifacts` - Array of all collected artifacts

3. **Idempotency:** If bundle with same hash exists, reuse it

### Step 1.5: Evidence Bundle Persistence
**Location:** `IncidentsPersistenceService.upsertEvidenceBundle()`

**Process:**
1. Check if bundle with same `bundleId` exists
2. If exists: Return existing bundle (idempotent)
3. If new: Insert into `EvidenceBundle` table
4. **Audit Event:** Emit `EVIDENCE_BUNDLE_CREATED` to audit chain

### Step 1.6: Incident Record Creation
**Location:** `IncidentsController.analyze()`

**Process:**
1. Create `Incident` record in database:
   - `id` - CUID
   - `scenarioId` (if scenario) OR `sourceType: "GOOGLE_CLOUD"`
   - `sourceRef` - Reference to original source
   - `sourceUrl` - Link to source (if available)
   - `sourcePayload` - Raw JSON (admin-only)
   - `status` - "OPEN"
   - `title` - Extracted from scenario or Google incident
   - `createdAt` - Timestamp

2. Link bundle to incident

---

## Phase 2: Initial Analysis

### Step 2.1: Evidence Completeness Calculation
**Location:** `computeEvidenceCompleteness()`

**Process:**
1. Analyze bundle artifacts
2. Determine `primarySignal`:
   - "latency" - If latency metrics present
   - "errors" - If error logs/traces present
   - "UNKNOWN" - Default

3. Calculate completeness score (0-100):
   - Checks for presence of:
     - Metrics (P0)
     - Logs (P0)
     - Traces (P1)
     - Deploys (P1)
     - Config (P2)
     - Google Status (P0 if Google Cloud incident)

4. Identify `missing` evidence needs:
   - Array of `{ need: "METRICS" | "LOGS" | ..., priority: "P0" | "P1" | "P2" }`

### Step 2.2: Hypothesis Candidate Selection
**Location:** `selectHypothesisCandidates()`

**Process:**
1. Based on:
   - `primarySignal` (latency/errors/unknown)
   - `completenessScore`
   - Available evidence types
   - Flags (recentDeploy, configChanged, etc.)

2. Returns array of hypothesis candidates:
   - Each candidate has:
     - `id`, `title`, `rationale`
     - `confidence` (initial estimate)
     - `evidenceRefs` (which artifacts support it)

### Step 2.3: Reasoning Request Building
**Location:** `buildReasoningRequest()`

**Process:**
1. Construct structured request for Gemini:
   - Incident summary
   - Timeline (start/end)
   - Artifact summaries (bounded, normalized)
   - Hypothesis candidates
   - Evidence completeness info

2. Request structure:
   ```json
   {
     "incidentId": "...",
     "evidenceBundleId": "...",
     "incidentSummary": "...",
     "timeline": { "start": "...", "end": "..." },
     "artifacts": [...],
     "candidates": [...],
     "evidenceCompleteness": { "score": 75, "missing": [...] }
   }
   ```

### Step 2.4: Gemini Reasoning Call
**Location:** `GeminiReasoningAdapter.reason()`

**Process:**
1. **Model:** `gemini-3-flash-preview` (configurable via `GEMINI_MODEL`)
2. **Timeout:** 30 seconds (with AbortController)
3. **Prompt:** System prompt + reasoning request (structured JSON)
4. **Response Parsing:**
   - Parse JSON response
   - Validate against `ReasoningResponseSchema`
   - Extract:
     - `hypotheses` - Ranked list with confidence scores
     - `actions` - Recommended actions (P0/P1/P2)
     - `overallConfidence` - 0.0 to 1.0
     - `explainability` - Primary signal, factors, rationale
     - `missingEvidenceRequests` - Model-requested evidence (Day 17)

### Step 2.5: Prompt Trace Creation
**Location:** `IncidentsController.analyze()`

**Process:**
1. Hash prompt components:
   - `promptHash` - SHA256 of system prompt
   - `requestHash` - SHA256 of reasoning request
   - `responseHash` - SHA256 of model response

2. Create `PromptTrace` record:
   - Links to analysis
   - Stores hashes (not full content for non-admins)
   - `model` - "gemini-3-flash-preview"
   - `promptVersion` - Version identifier

3. **Audit Event:** Emit `PROMPT_TRACE_CREATED` to audit chain

### Step 2.6: Analysis Record Creation
**Location:** `IncidentsPersistenceService.saveAnalysis()`

**Process:**
1. Create `IncidentAnalysis` record:
   - `id` - CUID
   - `incidentId` - Link to incident
   - `evidenceBundleId` - Link to bundle
   - `requestJson` - Full reasoning request (replayable)
   - `resultJson` - Full reasoning response
   - `createdAt` - Timestamp

2. **Audit Event:** Emit `ANALYSIS_CREATED` to audit chain

### Step 2.7: Response to User
**Location:** `IncidentsController.analyze()`

**Response:**
```json
{
  "incidentId": "clx...",
  "evidenceBundleId": "bundle-...",
  "analysisId": "anl-...",
  "completenessScore": 75,
  "overallConfidence": 0.82
}
```

**Frontend Action:**
- Redirects to `/incidents/{incidentId}` page
- Displays initial analysis results

---

## Phase 3: Autonomous Investigation Loop

### Step 3.1: User Initiates Investigation
**Location:** `/incidents/{id}` page

**User Actions:**
1. User clicks "Start Investigation" button
2. System checks if investigation already running:
   - **Backend Check:** `InvestigationService.startInvestigation()`
   - Queries for existing `RUNNING` session
   - If found: Returns HTTP 409 Conflict
   - If not: Proceeds

3. **Button State:**
   - Disabled if session is RUNNING
   - Shows progress: "Investigation Running (1/5)"

### Step 3.2: Investigation Session Creation
**Location:** `InvestigationService.startInvestigation()`

**Process:**
1. **RBAC Check:** `assertCanInvestigate(user)` - Analyst/Admin only
2. **Conflict Check:** Verify no RUNNING session exists
3. Create `InvestigationSession` record:
   - `id` - CUID
   - `incidentId` - Link to incident
   - `status` - "RUNNING"
   - `maxIterations` - User-specified (default: 5, max: 10)
   - `confidenceTarget` - User-specified (default: 0.8, range: 0.5-0.99)
   - `currentIteration` - 0 (initial)
   - `createdBy` - User subject

4. **Async Loop Start:** `runInvestigationLoop()` starts in background
5. **Immediate Response:** Returns `{ sessionId, status: "RUNNING" }`

### Step 3.3: Investigation Loop - Iteration Start
**Location:** `InvestigationService.runInvestigationLoop()`

**Process (per iteration):**

#### 3.3.1: Update Session Status
- Update `currentIteration` to current iteration number

#### 3.3.2: Load Existing Bundle
- First iteration: Load latest bundle for incident
- Subsequent iterations: Load bundle from previous iteration
- Extract `existingSources` to track what's been collected

#### 3.3.3: Compute Completeness
- Calculate current completeness score
- Identify missing evidence needs
- Compare with previous score (for progress tracking)

#### 3.3.4: Run Reasoning (Before Collection - Day 17)
**Location:** `GeminiReasoningAdapter.reason()`

**Process:**
1. Build reasoning request with current bundle state
2. Call Gemini API
3. Parse response:
   - Extract `missingEvidenceRequests` (if any)
   - Extract hypotheses, actions, confidence

#### 3.3.5: Evidence Request Policy Gating (Day 17)
**Location:** `applyEvidenceRequestPolicy()`

**Process:**
1. Validate model requests:
   - Check allowlist (METRICS, LOGS, TRACES, DEPLOYS, CONFIG, GOOGLE_STATUS)
   - Enforce time window bounds:
     - Safe mode: max 2 hours
     - Normal mode: max 6 hours
   - Enforce `maxItems` cap:
     - Safe mode: max 50
     - Normal mode: max 200
   - Enforce per-iteration limits:
     - Safe mode: max 1 evidence type
     - Normal mode: max 2 evidence types

2. Return:
   - `approvedRequests[]` - Requests that passed policy
   - `rejectedRequests[]` - Requests that failed (with reason codes)

#### 3.3.6: Map Requests to Collectors
**Location:** `mapRequestsToCollectors()`

**Process:**
1. Convert approved evidence requests to collector execution plans
2. Mapping:
   - `METRICS` → `GcpMetricsCollector`
   - `LOGS` → `LogsCollector`
   - `TRACES` → `TracesCollector`
   - `DEPLOYS` → `DeploysCollector`
   - `CONFIG` → `ConfigDiffCollector`
   - `GOOGLE_STATUS` → (no-op, already present)

3. Build `collectContext`:
   - Time window (from request scope or incident timeline)
   - Service/region hints
   - `maxItems` limit

#### 3.3.7: Collector Execution
**Location:** `InvestigationService.runInvestigationLoop()`

**Process:**
1. **Policy Check:** `checkCollectorPolicy()` for each collector:
   - Safe mode: Force STUB unless allowlisted
   - Check `CHRONOSOPS_ALLOW_REAL_*` env vars

2. Execute collectors (parallel):
   - Each collector respects:
     - `forcedMode` (STUB if policy requires)
     - `maxItems` limit
     - Time window bounds

3. Collect new artifacts

#### 3.3.8: Bundle Augmentation
**Location:** `buildEvidenceBundle()`

**Process:**
1. Merge existing bundle with new artifacts
2. Generate new bundle:
   - New `bundleId` (if artifacts changed)
   - New `hash` (if content changed)
   - Updated `sources` array
   - Combined `artifacts` array

3. **Idempotency:** If hash matches existing bundle, reuse it

#### 3.3.9: Bundle Persistence
**Location:** `IncidentsPersistenceService.upsertEvidenceBundle()`

**Process:**
1. Upsert bundle (create or reuse)
2. **Audit Event:** Emit `EVIDENCE_BUNDLE_CREATED` (if new)

#### 3.3.10: Re-run Reasoning with New Bundle
**Location:** `InvestigationService.runInvestigationLoop()`

**Process:**
1. Build new reasoning request with augmented bundle
2. Call Gemini API again
3. Parse updated hypotheses, confidence, actions

#### 3.3.11: Analysis Record Creation
**Location:** `IncidentsPersistenceService.saveAnalysis()`

**Process:**
1. Create new `IncidentAnalysis` record for this iteration
2. **Audit Event:** Emit `ANALYSIS_CREATED`

#### 3.3.12: Iteration Record Creation
**Location:** `InvestigationService.runInvestigationLoop()`

**Process:**
1. Create `InvestigationIteration` record:
   - `sessionId` - Link to session
   - `iteration` - Current iteration number
   - `evidenceBundleId` - Link to bundle
   - `analysisId` - Link to analysis
   - `completenessScore` - Current score
   - `overallConfidence` - From reasoning response
   - `decisionJson` - Records:
     - `useModelRequests` - Boolean
     - `modelRequests` - Raw model requests
     - `approvedRequests` - Approved requests
     - `rejectedRequests` - Rejected requests (with codes)
     - `executedCollectors` - Which collectors ran
     - `collectorPlan` - Fallback plan (if used)

2. **Audit Event:** Emit `INVESTIGATION_ITERATION_RECORDED` to audit chain

#### 3.3.13: Stop Condition Evaluation
**Location:** `InvestigationService.runInvestigationLoop()`

**Stop Conditions (checked in order):**

1. **Confidence Target Met:**
   - If `overallConfidence >= confidenceTarget`
   - Status: `COMPLETED`
   - Reason: `CONFIDENCE_TARGET_REACHED`

2. **Max Iterations Reached:**
   - If `iteration >= maxIterations`
   - Status: `STOPPED`
   - Reason: `MAX_ITERATIONS_REACHED`

3. **No Progress:**
   - If completeness score didn't improve AND no new collectors could run
   - Status: `STOPPED`
   - Reason: `NO_PROGRESS`

4. **All Requests Rejected:**
   - If model requested evidence but all requests were rejected
   - Status: `STOPPED`
   - Reason: `NO_APPROVED_EVIDENCE_REQUESTS`

5. **Exception:**
   - If any error occurs
   - Status: `FAILED`
   - Reason: Error message

#### 3.3.14: Session Status Update
**Location:** `InvestigationService.runInvestigationLoop()`

**Process:**
1. Update `InvestigationSession`:
   - `status` - COMPLETED | STOPPED | FAILED
   - `reason` - Stop reason

2. Loop ends

### Step 3.4: Frontend Auto-Refresh
**Location:** `/incidents/{id}` page

**Process:**
1. React Query auto-refreshes every 3 seconds when session is RUNNING
2. Updates:
   - Session status
   - Current iteration
   - Iteration details (confidence, completeness)
   - Button state (disabled when running)

3. Visual indicators:
   - Blue banner: "Investigation in progress... Auto-refreshing every 3 seconds"
   - Spinner animation
   - "● Running" indicator next to iteration count

---

## Phase 4: Postmortem Generation

### Step 4.1: User Initiates Postmortem
**Location:** `/incidents/{id}` page

**User Actions:**
1. User clicks "Generate Postmortem" button (if not already generated)
2. System checks if postmortem exists:
   - If exists: Show existing postmortem
   - If not: Generate new

### Step 4.2: Postmortem Generation
**Location:** `generatePostmortemV2()`

**Process:**
1. Load latest analysis and evidence bundle
2. Extract:
   - Hypotheses (ranked)
   - Actions (prioritized)
   - Evidence artifacts
   - Timeline
   - Root cause (top hypothesis)

3. Generate structured postmortem:
   - **Markdown Format:**
     - Executive Summary
     - Timeline
     - Root Cause Analysis
     - Impact Assessment
     - Actions Taken
     - Prevention Measures
   - **JSON Format:**
     - Structured data for programmatic access

4. **Version:** `POSTMORTEM_GENERATOR_VERSION` (tracked for replayability)

### Step 4.3: Postmortem Persistence
**Location:** `IncidentsPersistenceService.savePostmortem()`

**Process:**
1. Create `Postmortem` record:
   - `id` - CUID
   - `analysisId` - Link to analysis
   - `markdown` - Rendered markdown
   - `json` - Structured JSON
   - `generatorVersion` - Version identifier
   - `createdAt` - Timestamp

2. **Audit Event:** Emit `POSTMORTEM_CREATED` to audit chain

### Step 4.4: Postmortem Display
**Location:** `/incidents/{id}` page

**Features:**
- Markdown rendering
- Export options:
  - Download Markdown
  - Download JSON
  - Copy to clipboard

---

## Phase 5: Export & Verification

### Step 5.1: Explainability Graph
**Location:** `/incidents/{id}/analyses/{analysisId}/explainability-graph`

**Process:**
1. **Graph Builder:** `buildExplainabilityGraph()`
   - Loads analysis, bundle, postmortem
   - Constructs nodes:
     - Evidence nodes (one per artifact)
     - Claim nodes (primary signal)
     - Hypothesis nodes (ranked)
     - Action nodes (prioritized)
     - Conclusion node (root cause)
   - Constructs edges:
     - Evidence → Hypothesis (via `evidenceRefs`)
     - Hypothesis → Conclusion
     - Missing evidence edges

2. **Visualization:**
   - Interactive SVG graph
   - Node selection for details
   - Filter: "Show only paths to conclusion"
   - Color-coded by type

### Step 5.2: Analysis Comparison
**Location:** `/incidents/{id}/compare/{analysisIdA}/{analysisIdB}`

**Process:**
1. **Comparison Service:** `AnalysisCompareService.compare()`
   - Loads two analyses
   - Computes drift:
     - Hypothesis ranking changes
     - Confidence score changes
     - New/missing hypotheses
     - Action priority changes

2. **Display:**
   - Side-by-side comparison
   - Highlighted differences
   - Drift indicators

### Step 5.3: Audit Chain Verification
**Location:** `/incidents/{id}/verify`

**Process:**
1. **Verification Service:** `AuditVerifyService.verifyIncidentChain()`
   - Loads all audit events for incident
   - Checks sequential continuity:
     - Each `prevHash` matches previous `hash`
   - Recomputes hashes:
     - For each event, recompute hash from canonical JSON
     - Compare with stored hash
   - Detects tampering:
     - If any hash mismatch → tampering detected
     - If sequence gap → missing events

2. **Response:**
   ```json
   {
     "ok": true,
     "verifiedCount": 15,
     "firstFailure": null
   }
   ```

3. **UI Display:**
   - ✅ "Verified (15 events)" badge
   - ❌ "Failed at seq X" if tampering detected

### Step 5.4: Export Options
**Location:** `/exports` page

**Export Formats:**
1. **Evidence Bundle:**
   - JSON (full bundle)
   - Filtered by evidence type

2. **Analysis:**
   - JSON (full analysis)
   - Markdown summary

3. **Postmortem:**
   - Markdown file
   - JSON file

4. **Investigation Session:**
   - JSON (all iterations)
   - CSV (iteration summary)

5. **Audit Chain:**
   - JSON (all events)
   - Verification report

---

## Data Flow Diagram

```
User Action
    ↓
[Incident Ingestion]
    ├─→ Scenario OR Google Cloud
    ├─→ Evidence Collection (Collectors)
    ├─→ Evidence Bundle Creation
    └─→ Incident Record
         ↓
[Initial Analysis]
    ├─→ Completeness Calculation
    ├─→ Hypothesis Selection
    ├─→ Gemini Reasoning
    ├─→ Prompt Trace
    └─→ Analysis Record
         ↓
[Investigation Loop] (Optional, Iterative)
    ├─→ Session Creation
    ├─→ Iteration Loop:
    │    ├─→ Reasoning (with current bundle)
    │    ├─→ Model Evidence Requests
    │    ├─→ Policy Gating
    │    ├─→ Collector Execution
    │    ├─→ Bundle Augmentation
    │    ├─→ Re-reasoning
    │    └─→ Iteration Record
    └─→ Stop Conditions
         ↓
[Postmortem Generation]
    ├─→ Extract from Analysis
    ├─→ Generate Markdown/JSON
    └─→ Postmortem Record
         ↓
[Export & Verification]
    ├─→ Explainability Graph
    ├─→ Analysis Comparison
    ├─→ Audit Verification
    └─→ Export Downloads
```

---

## Key Concepts

### 1. Idempotency
- **Evidence Bundles:** Same content → same `bundleId` and `hash`
- **Re-analysis:** Can replay with same inputs → deterministic results

### 2. Content-Addressed Storage
- Bundles identified by hash, not ID
- Prevents duplicates
- Enables verification

### 3. Audit Chain
- Every critical operation emits audit event
- Hash-chained for tamper detection
- Sequential integrity verification

### 4. Safe Mode (Default: ON)
- Collectors forced to STUB unless allowlisted
- Stricter bounds on evidence requests
- Data redaction for non-admins

### 5. RBAC Enforcement
- **Viewer:** Read-only, no sensitive data
- **Analyst:** Can analyze, investigate
- **Admin:** Full access, including raw payloads

### 6. Model-Directed Evidence Collection
- Gemini requests specific evidence
- Policy gating ensures safety
- Fallback to deterministic plan if needed

---

## Common Questions

### Q1: What happens if I start multiple investigations?
**A:** The backend prevents this. If a RUNNING session exists, you'll get HTTP 409 Conflict. The button is disabled in the UI.

### Q2: How long does an investigation take?
**A:** Depends on:
- Number of iterations (max 10)
- Collector execution time (STUB is instant, REAL depends on API)
- Gemini API response time (30s timeout)
- Typically: 1-5 minutes for 3-5 iterations

### Q3: Can I stop an investigation?
**A:** Currently, investigations run to completion (stop conditions). Future enhancement: manual stop.

### Q4: What if Gemini API fails?
**A:** Investigation session status → `FAILED`, reason stored. User can retry.

### Q5: How is data protected?
**A:**
- Safe Mode (default ON) prevents real data collection
- RBAC restricts access
- Data redaction for non-admins
- Audit chain for tamper detection

### Q6: Can I replay an analysis?
**A:** Yes! `requestJson` is stored, enabling deterministic replay.

### Q7: What's the difference between "Analyze" and "Investigation"?
**A:**
- **Analyze:** One-time analysis with current evidence
- **Investigation:** Iterative loop that collects more evidence and re-analyzes until confidence target or max iterations

---

## Next Steps for Users

1. **Start Simple:** Create incident from scenario, analyze, review results
2. **Investigate:** Run investigation loop, observe iterations
3. **Deep Dive:** Generate postmortem, view explainability graph
4. **Verify:** Check audit chain integrity
5. **Export:** Download data for external analysis

---

*Last Updated: Based on Day 16-21 implementation*
