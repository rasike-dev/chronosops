# ChronosOps Incident Ingestion Integration Guide

## Overview

ChronosOps provides a unified API for ingesting incidents from various sources. This guide explains how to integrate your incident management system with ChronosOps.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Generic Ingestion API](#generic-ingestion-api)
3. [Source-Specific Integration](#source-specific-integration)
4. [Webhook Integration](#webhook-integration)
5. [Examples](#examples)
6. [Best Practices](#best-practices)

---

## Quick Start

### Endpoint

```
POST /v1/incidents/ingest
```

### Authentication

Requires `CHRONOSOPS_ANALYST` or `CHRONOSOPS_ADMIN` role.

Include JWT token in `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

### Basic Request

```json
{
  "sourceType": "CUSTOM",
  "sourceRef": "incident-12345",
  "title": "Service outage in payment-service",
  "severity": "high",
  "timeline": {
    "start": "2024-01-15T10:00:00Z",
    "end": "2024-01-15T11:00:00Z"
  },
  "metadata": {
    "service": "payment-service",
    "region": "us-east-1",
    "environment": "production"
  }
}
```

### Response

```json
{
  "incidentId": "clx...",
  "evidenceBundleId": "bundle-...",
  "analysisId": "anl-...",
  "status": "analyzed",
  "message": "Incident ingested and analyzed successfully"
}
```

---

## Generic Ingestion API

### Request Schema

```typescript
{
  // Required
  sourceType: "SCENARIO" | "GOOGLE_CLOUD" | "PAGERDUTY" | "DATADOG" | "NEW_RELIC" | "CUSTOM",
  sourceRef: string, // Unique identifier from source system (max 512 chars)
  title: string, // Incident title (max 500 chars)
  timeline: {
    start: string, // ISO 8601 datetime (required)
    end?: string, // ISO 8601 datetime (optional, null if ongoing)
    detectedAt?: string, // When incident was first detected
    resolvedAt?: string // When incident was resolved
  },
  
  // Optional
  description?: string, // Detailed description (max 5000 chars)
  severity?: "critical" | "high" | "medium" | "low" | "info",
  metadata?: {
    service?: string, // Service name/ID
    region?: string, // Region/zone
    environment?: string, // e.g., "production", "staging"
    team?: string, // Team/owner
    tags?: Record<string, string>, // Key-value tags
    customFields?: Record<string, unknown> // Source-specific fields
  },
  evidenceLite?: {
    metrics?: Array<{ name: string; value: number; timestamp: string; labels?: Record<string, string> }>,
    logs?: Array<{ message: string; level?: string; timestamp: string; service?: string }>,
    traces?: Array<{ traceId: string; spanId: string; service: string; operation: string; duration?: number; timestamp: string }>,
    events?: Array<{ type: string; description: string; timestamp: string; metadata?: Record<string, unknown> }>
  },
  sourcePayload?: unknown, // Raw payload from source (for audit/replay)
  collectionContext?: {
    windowMinutesBefore?: number, // Default: 15, Range: 1-120
    windowMinutesAfter?: number, // Default: 15, Range: 1-120
    forceCollect?: boolean // Force evidence collection even if evidenceLite provided (default: false)
  }
}
```

### Response Schema

```typescript
{
  incidentId: string, // CUID of created incident
  evidenceBundleId?: string, // Content-addressed bundle ID
  analysisId?: string, // Analysis record ID
  status: "created" | "analyzed" | "failed",
  message?: string // Status message
}
```

---

## Source-Specific Integration

### 1. PagerDuty

#### Webhook Format

PagerDuty sends webhooks in a specific format. You can either:

**Option A:** Normalize in your integration layer and send to `/v1/incidents/ingest`

**Option B:** Send raw PagerDuty webhook to a custom endpoint (future enhancement)

#### Example Normalization

```typescript
// PagerDuty webhook payload structure
const pagerDutyPayload = {
  incident: {
    id: "P123456",
    title: "High error rate in payment-service",
    urgency: "high",
    status: "triggered",
    created_at: "2024-01-15T10:00:00Z",
    resolved_at: null,
    service: {
      id: "P123",
      name: "payment-service"
    },
    assigned_to: [{
      summary: "on-call-team"
    }]
  }
};

// Normalize to ChronosOps format
const ingestRequest = {
  sourceType: "PAGERDUTY",
  sourceRef: pagerDutyPayload.incident.id,
  title: pagerDutyPayload.incident.title,
  severity: mapPagerDutyUrgency(pagerDutyPayload.incident.urgency), // "high"
  timeline: {
    start: pagerDutyPayload.incident.created_at,
    end: pagerDutyPayload.incident.resolved_at || null,
    detectedAt: pagerDutyPayload.incident.created_at,
    resolvedAt: pagerDutyPayload.incident.resolved_at || null
  },
  metadata: {
    service: pagerDutyPayload.incident.service.name,
    team: pagerDutyPayload.incident.assigned_to[0]?.summary,
    tags: {
      urgency: pagerDutyPayload.incident.urgency,
      status: pagerDutyPayload.incident.status
    },
    customFields: {
      priority: pagerDutyPayload.incident.priority?.name,
      incidentKey: pagerDutyPayload.incident.incident_key
    }
  },
  sourcePayload: pagerDutyPayload
};
```

#### Mapping PagerDuty Severity

```typescript
function mapPagerDutyUrgency(urgency: string): string {
  const mapping = {
    "critical": "critical",
    "high": "high",
    "low": "low",
    "urgent": "critical",
    "normal": "medium"
  };
  return mapping[urgency?.toLowerCase()] || "medium";
}
```

### 2. Datadog

#### Example Normalization

```typescript
const datadogPayload = {
  incident: {
    id: "abc123",
    attributes: {
      title: "High error rate detected",
      severity: "SEV-2",
      created: "2024-01-15T10:00:00Z",
      resolved: null,
      customer_impact_scope: "payment-service",
      region: "us-east-1",
      tags: ["production", "critical"]
    },
    state: "active"
  }
};

const ingestRequest = {
  sourceType: "DATADOG",
  sourceRef: datadogPayload.incident.id,
  title: datadogPayload.incident.attributes.title,
  severity: mapDatadogSeverity(datadogPayload.incident.attributes.severity), // "high"
  timeline: {
    start: datadogPayload.incident.attributes.created,
    end: datadogPayload.incident.attributes.resolved || null,
    detectedAt: datadogPayload.incident.attributes.detected,
    resolvedAt: datadogPayload.incident.attributes.resolved || null
  },
  metadata: {
    service: datadogPayload.incident.attributes.customer_impact_scope,
    region: datadogPayload.incident.attributes.region,
    tags: Object.fromEntries(
      datadogPayload.incident.attributes.tags.map(tag => tag.split(':'))
    ),
    customFields: {
      state: datadogPayload.incident.state
    }
  },
  sourcePayload: datadogPayload
};
```

#### Mapping Datadog Severity

```typescript
function mapDatadogSeverity(severity: string): string {
  const mapping = {
    "SEV-1": "critical",
    "SEV-2": "high",
    "SEV-3": "medium",
    "SEV-4": "low"
  };
  return mapping[severity?.toUpperCase()] || "medium";
}
```

### 3. New Relic

#### Example Normalization

```typescript
const newRelicPayload = {
  incident: {
    id: "12345",
    title: "Service degradation",
    priority: "P1",
    createdAt: "2024-01-15T10:00:00Z",
    resolvedAt: null,
    entityName: "payment-service",
    region: "us-east-1",
    environment: "production",
    state: "open"
  }
};

const ingestRequest = {
  sourceType: "NEW_RELIC",
  sourceRef: newRelicPayload.incident.id,
  title: newRelicPayload.incident.title,
  severity: mapNewRelicPriority(newRelicPayload.incident.priority), // "critical"
  timeline: {
    start: newRelicPayload.incident.createdAt,
    end: newRelicPayload.incident.resolvedAt || null,
    detectedAt: newRelicPayload.incident.openedAt,
    resolvedAt: newRelicPayload.incident.resolvedAt || null
  },
  metadata: {
    service: newRelicPayload.incident.entityName,
    region: newRelicPayload.incident.region,
    environment: newRelicPayload.incident.environment,
    customFields: {
      state: newRelicPayload.incident.state,
      policyId: newRelicPayload.incident.policyId
    }
  },
  sourcePayload: newRelicPayload
};
```

#### Mapping New Relic Priority

```typescript
function mapNewRelicPriority(priority: string): string {
  const mapping = {
    "P1": "critical",
    "P2": "high",
    "P3": "medium",
    "P4": "low"
  };
  return mapping[priority?.toUpperCase()] || "medium";
}
```

### 4. Custom Sources

For custom sources, use `sourceType: "CUSTOM"` and provide all relevant information:

```json
{
  "sourceType": "CUSTOM",
  "sourceRef": "my-system-incident-123",
  "title": "Custom incident",
  "description": "Incident from our internal system",
  "severity": "high",
  "timeline": {
    "start": "2024-01-15T10:00:00Z",
    "end": "2024-01-15T11:00:00Z"
  },
  "metadata": {
    "service": "my-service",
    "team": "platform-team",
    "tags": {
      "environment": "production",
      "component": "api"
    },
    "customFields": {
      "internalId": "INT-12345",
      "category": "performance"
    }
  },
  "sourcePayload": {
    "originalFormat": "internal",
    "data": "..."
  }
}
```

---

## Webhook Integration

### Setting Up Webhooks

1. **Configure your source system** to send webhooks to ChronosOps
2. **Create a webhook endpoint** in your integration layer (or use ChronosOps webhook endpoint - future)
3. **Normalize the payload** to ChronosOps format
4. **Send to `/v1/incidents/ingest`**

### Example Webhook Handler (Node.js)

```typescript
import express from 'express';
import { IncidentNormalizer } from './incident-normalizer'; // Your normalization logic

const app = express();
app.use(express.json());

app.post('/webhook/pagerduty', async (req, res) => {
  try {
    // 1. Verify webhook signature (recommended)
    // verifyPagerDutySignature(req);
    
    // 2. Normalize payload
    const normalizer = new IncidentNormalizer();
    const normalized = normalizer.normalizePagerDuty(req.body);
    
    // 3. Send to ChronosOps
    const response = await fetch('https://chronosops.example.com/v1/incidents/ingest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHRONOSOPS_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(normalized)
    });
    
    const result = await response.json();
    
    // 4. Return success
    res.json({ success: true, incidentId: result.incidentId });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});
```

---

## Examples

### Example 1: Simple Incident Ingestion

```bash
curl -X POST https://chronosops.example.com/v1/incidents/ingest \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "CUSTOM",
    "sourceRef": "incident-2024-001",
    "title": "API latency spike",
    "severity": "high",
    "timeline": {
      "start": "2024-01-15T10:00:00Z",
      "end": "2024-01-15T10:30:00Z"
    },
    "metadata": {
      "service": "api-gateway",
      "region": "us-east-1",
      "environment": "production"
    }
  }'
```

### Example 2: With Pre-collected Evidence

```json
{
  "sourceType": "CUSTOM",
  "sourceRef": "incident-2024-002",
  "title": "Database connection pool exhaustion",
  "severity": "critical",
  "timeline": {
    "start": "2024-01-15T11:00:00Z",
    "end": "2024-01-15T11:15:00Z"
  },
  "metadata": {
    "service": "database-service",
    "environment": "production"
  },
  "evidenceLite": {
    "metrics": [
      {
        "name": "connection_pool_active",
        "value": 100,
        "timestamp": "2024-01-15T11:00:00Z",
        "labels": { "pool": "main" }
      }
    ],
    "logs": [
      {
        "message": "Connection pool exhausted",
        "level": "ERROR",
        "timestamp": "2024-01-15T11:00:05Z",
        "service": "database-service"
      }
    ]
  }
}
```

### Example 3: Force Evidence Collection

```json
{
  "sourceType": "PAGERDUTY",
  "sourceRef": "PD-123456",
  "title": "Service outage",
  "timeline": {
    "start": "2024-01-15T12:00:00Z"
  },
  "collectionContext": {
    "windowMinutesBefore": 30,
    "windowMinutesAfter": 30,
    "forceCollect": true
  }
}
```

---

## Best Practices

### 1. Idempotency

Use `sourceRef` as a unique identifier. If you send the same `sourceRef` multiple times, ChronosOps will create separate incidents (idempotency can be added as a future enhancement).

**Recommendation:** Include a deduplication check in your integration layer.

### 2. Timeline Accuracy

Provide accurate timestamps:
- `start`: When the incident actually started (not when detected)
- `end`: When the incident was resolved (null if ongoing)
- `detectedAt`: When your system first detected the issue

### 3. Evidence Collection

- **If you have evidence:** Include it in `evidenceLite` to speed up analysis
- **If you don't have evidence:** Leave `evidenceLite` empty and ChronosOps will collect it
- **To force collection:** Set `forceCollect: true` in `collectionContext`

### 4. Metadata

Include as much metadata as possible:
- `service`: Helps collectors target the right service
- `region`: Helps collectors target the right region
- `environment`: Helps collectors target the right environment
- `tags`: Useful for filtering and grouping

### 5. Error Handling

```typescript
try {
  const response = await fetch('/v1/incidents/ingest', { ... });
  
  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 400) {
      // Validation error - check error.errors
      console.error('Validation failed:', error.errors);
    } else if (response.status === 401 || response.status === 403) {
      // Auth error - check token
      console.error('Authentication failed');
    } else {
      // Server error - retry with backoff
      console.error('Server error:', error.message);
    }
  }
} catch (error) {
  // Network error - retry
  console.error('Network error:', error);
}
```

### 6. Rate Limiting

ChronosOps may rate limit requests. Implement exponential backoff:

```typescript
async function ingestWithRetry(request: IngestIncidentRequest, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/v1/incidents/ingest', { ... });
      if (response.ok) return await response.json();
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## Next Steps

1. **Test the integration** with a few sample incidents
2. **Monitor the results** - check incident detail pages in ChronosOps
3. **Set up webhooks** for real-time ingestion
4. **Configure collectors** - ensure evidence collection works for your services
5. **Review analysis results** - verify that Gemini reasoning is accurate

---

## Support

For questions or issues:
- Check the [Complete Flow Documentation](./COMPLETE_FLOW_DOCUMENTATION.md)
- Review API responses for error messages
- Check ChronosOps logs for detailed error information

---

*Last Updated: Based on Generic Ingestion API implementation*
