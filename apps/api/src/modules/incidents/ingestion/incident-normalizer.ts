import { Injectable, Logger } from "@nestjs/common";
import type {
  IngestIncidentRequest,
  IncidentSourceType,
} from "@chronosops/contracts";
import { buildGoogleEvidenceLite } from "../evidence/google-evidence-lite";

const logger = new Logger("IncidentNormalizer");

/**
 * Normalized incident data structure (internal)
 */
export interface NormalizedIncident {
  sourceType: IncidentSourceType;
  sourceRef: string;
  title: string;
  description?: string | null;
  severity?: string | null;
  timeline: {
    start: string; // ISO 8601
    end?: string | null; // ISO 8601
    detectedAt?: string;
    resolvedAt?: string | null;
  };
  metadata: {
    service?: string;
    region?: string;
    environment?: string;
    team?: string;
    tags?: Record<string, string>;
    customFields?: Record<string, unknown>;
  };
  evidenceLite?: any; // Can be GoogleEvidenceLite or generic EvidenceLite
  sourcePayload?: unknown;
  collectionContext?: {
    windowMinutesBefore: number;
    windowMinutesAfter: number;
    forceCollect: boolean;
  };
}

/**
 * Normalizes incident data from various sources into a common format
 */
@Injectable()
export class IncidentNormalizer {
  /**
   * Normalize a generic ingestion request
   */
  normalizeIngestRequest(request: IngestIncidentRequest): NormalizedIncident {
    return {
      sourceType: request.sourceType,
      sourceRef: request.sourceRef,
      title: request.title,
      description: request.description ?? null,
      severity: request.severity ?? null,
      timeline: {
        start: request.timeline.start,
        end: request.timeline.end ?? null,
        detectedAt: request.timeline.detectedAt,
        resolvedAt: request.timeline.resolvedAt ?? null,
      },
      metadata: {
        service: request.metadata?.service,
        region: request.metadata?.region,
        environment: request.metadata?.environment,
        team: request.metadata?.team,
        tags: request.metadata?.tags,
        customFields: request.metadata?.customFields,
      },
      evidenceLite: request.evidenceLite,
      sourcePayload: request.sourcePayload,
      collectionContext: request.collectionContext,
    };
  }

  /**
   * Normalize PagerDuty incident format
   * Example PagerDuty webhook payload structure
   */
  normalizePagerDuty(pagerDutyPayload: any): NormalizedIncident {
    const incident = pagerDutyPayload.incident || pagerDutyPayload;
    
    return {
      sourceType: "PAGERDUTY",
      sourceRef: incident.id || incident.incident_number?.toString() || `pd-${Date.now()}`,
      title: incident.title || incident.summary || "PagerDuty Incident",
      description: incident.description || null,
      severity: this.mapPagerDutySeverity(incident.urgency || incident.severity),
      timeline: {
        start: incident.created_at || new Date().toISOString(),
        end: incident.resolved_at || null,
        detectedAt: incident.created_at,
        resolvedAt: incident.resolved_at || null,
      },
      metadata: {
        service: incident.service?.name || incident.service?.id,
        team: incident.assigned_to?.[0]?.summary || incident.team?.name,
        tags: this.extractPagerDutyTags(incident),
        customFields: {
          priority: incident.priority?.name,
          status: incident.status,
          incidentKey: incident.incident_key,
        },
      },
      evidenceLite: this.extractPagerDutyEvidence(incident),
      sourcePayload: pagerDutyPayload,
    };
  }

  /**
   * Normalize Datadog incident format
   */
  normalizeDatadog(datadogPayload: any): NormalizedIncident {
    const incident = datadogPayload.incident || datadogPayload;
    
    return {
      sourceType: "DATADOG",
      sourceRef: incident.id || `dd-${Date.now()}`,
      title: incident.attributes?.title || incident.title || "Datadog Incident",
      description: incident.attributes?.field_notes || incident.description || null,
      severity: this.mapDatadogSeverity(incident.attributes?.severity || incident.severity),
      timeline: {
        start: incident.attributes?.created || incident.created || new Date().toISOString(),
        end: incident.attributes?.resolved || incident.resolved || null,
        detectedAt: incident.attributes?.detected || incident.detected,
        resolvedAt: incident.attributes?.resolved || incident.resolved || null,
      },
      metadata: {
        service: incident.attributes?.customer_impact_scope || incident.service,
        region: incident.attributes?.region,
        environment: incident.attributes?.environment,
        tags: incident.attributes?.tags || incident.tags,
        customFields: {
          state: incident.attributes?.state,
          notificationHandles: incident.attributes?.notification_handles,
        },
      },
      evidenceLite: this.extractDatadogEvidence(incident),
      sourcePayload: datadogPayload,
    };
  }

  /**
   * Normalize New Relic incident format
   */
  normalizeNewRelic(newRelicPayload: any): NormalizedIncident {
    const incident = newRelicPayload.incident || newRelicPayload;
    
    return {
      sourceType: "NEW_RELIC",
      sourceRef: incident.id || incident.incidentId || `nr-${Date.now()}`,
      title: incident.title || incident.name || "New Relic Incident",
      description: incident.description || null,
      severity: this.mapNewRelicSeverity(incident.priority || incident.severity),
      timeline: {
        start: incident.createdAt || incident.created_at || new Date().toISOString(),
        end: incident.resolvedAt || incident.resolved_at || null,
        detectedAt: incident.openedAt || incident.opened_at,
        resolvedAt: incident.resolvedAt || incident.resolved_at || null,
      },
      metadata: {
        service: incident.entityName || incident.service,
        region: incident.region,
        environment: incident.environment,
        tags: incident.tags,
        customFields: {
          state: incident.state,
          policyId: incident.policyId,
        },
      },
      evidenceLite: this.extractNewRelicEvidence(incident),
      sourcePayload: newRelicPayload,
    };
  }

  /**
   * Normalize Google Cloud incident (already has a builder, but normalize for consistency)
   */
  normalizeGoogleCloud(googlePayload: any): NormalizedIncident {
    const evidenceLite = buildGoogleEvidenceLite(googlePayload);
    
    return {
      sourceType: "GOOGLE_CLOUD",
      sourceRef: googlePayload.id || evidenceLite.headline || `gcp-${Date.now()}`,
      title: evidenceLite.headline || "Google Cloud Incident",
      description: null, // GoogleEvidenceLite doesn't have description field
      severity: evidenceLite.severity || "medium",
      timeline: {
        start: evidenceLite.timeline.begin || new Date().toISOString(),
        end: evidenceLite.timeline.end || evidenceLite.timeline.update || null,
        detectedAt: evidenceLite.timeline.begin || undefined,
        resolvedAt: evidenceLite.timeline.end || null,
      },
      metadata: {
        service: evidenceLite.service || undefined,
        region: evidenceLite.region || undefined,
        tags: {
          status: evidenceLite.status,
        },
      },
      evidenceLite,
      sourcePayload: googlePayload,
    };
  }

  // Helper methods for mapping source-specific formats

  private mapPagerDutySeverity(urgency?: string): string {
    const mapping: Record<string, string> = {
      critical: "critical",
      high: "high",
      low: "low",
      urgent: "critical",
      normal: "medium",
    };
    return mapping[urgency?.toLowerCase() || ""] || "medium";
  }

  private mapDatadogSeverity(severity?: string): string {
    const mapping: Record<string, string> = {
      "SEV-1": "critical",
      "SEV-2": "high",
      "SEV-3": "medium",
      "SEV-4": "low",
      "critical": "critical",
      "high": "high",
      "medium": "medium",
      "low": "low",
    };
    return mapping[severity?.toUpperCase() || ""] || "medium";
  }

  private mapNewRelicSeverity(priority?: string): string {
    const mapping: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
      P1: "critical",
      P2: "high",
      P3: "medium",
      P4: "low",
    };
    return mapping[priority?.toUpperCase() || ""] || "medium";
  }

  private extractPagerDutyTags(incident: any): Record<string, string> {
    const tags: Record<string, string> = {};
    if (incident.urgency) tags.urgency = incident.urgency;
    if (incident.priority) tags.priority = incident.priority?.name || incident.priority;
    if (incident.status) tags.status = incident.status;
    return tags;
  }

  private extractPagerDutyEvidence(incident: any): any {
    // PagerDuty doesn't typically include evidence in webhook payloads
    // This would need to be collected separately
    return null;
  }

  private extractDatadogEvidence(incident: any): any {
    // Datadog incidents may include related events/metrics
    // This is a placeholder - would need to fetch from Datadog API
    return null;
  }

  private extractNewRelicEvidence(incident: any): any {
    // New Relic incidents may include related entities/metrics
    // This is a placeholder - would need to fetch from New Relic API
    return null;
  }
}
