import { z } from "zod";

/**
 * Supported incident source types for ingestion
 */
export const IncidentSourceTypeSchema = z.enum([
  "SCENARIO",
  "GOOGLE_CLOUD",
  "PAGERDUTY",
  "DATADOG",
  "NEW_RELIC",
  "CUSTOM",
]);
export type IncidentSourceType = z.infer<typeof IncidentSourceTypeSchema>;

/**
 * Severity levels for incidents
 */
export const IncidentSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

/**
 * Timeline information for an incident
 */
export const IncidentTimelineSchema = z.object({
  start: z.string().datetime(), // ISO 8601 datetime
  end: z.string().datetime().optional().nullable(), // ISO 8601 datetime, null if ongoing
  detectedAt: z.string().datetime().optional(), // When incident was first detected
  resolvedAt: z.string().datetime().optional().nullable(), // When incident was resolved
});
export type IncidentTimeline = z.infer<typeof IncidentTimelineSchema>;

/**
 * Metadata about the incident (service, region, etc.)
 */
export const IncidentMetadataSchema = z.object({
  service: z.string().optional(), // Service name/ID
  region: z.string().optional(), // Region/zone
  environment: z.string().optional(), // e.g., "production", "staging"
  team: z.string().optional(), // Team/owner
  tags: z.record(z.string()).optional(), // Key-value tags
  customFields: z.record(z.unknown()).optional(), // Source-specific custom fields
});
export type IncidentMetadata = z.infer<typeof IncidentMetadataSchema>;

/**
 * Pre-collected evidence (optional - if source already has evidence)
 */
export const EvidenceLiteSchema = z.object({
  metrics: z
    .array(
      z.object({
        name: z.string(),
        value: z.number(),
        timestamp: z.string().datetime(),
        labels: z.record(z.string()).optional(),
      })
    )
    .optional(),
  logs: z
    .array(
      z.object({
        message: z.string(),
        level: z.string().optional(),
        timestamp: z.string().datetime(),
        service: z.string().optional(),
      })
    )
    .optional(),
  traces: z
    .array(
      z.object({
        traceId: z.string(),
        spanId: z.string(),
        service: z.string(),
        operation: z.string(),
        duration: z.number().optional(),
        timestamp: z.string().datetime(),
      })
    )
    .optional(),
  events: z
    .array(
      z.object({
        type: z.string(),
        description: z.string(),
        timestamp: z.string().datetime(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
});
export type EvidenceLite = z.infer<typeof EvidenceLiteSchema>;

/**
 * Generic Incident Ingestion Request
 * This is the unified format for ingesting incidents from any source
 */
export const IngestIncidentRequestSchema = z.object({
  // Source identification
  sourceType: IncidentSourceTypeSchema,
  sourceRef: z.string().min(1).max(512), // Unique identifier from source system

  // Basic incident information
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  severity: IncidentSeveritySchema.optional(),

  // Timeline
  timeline: IncidentTimelineSchema,

  // Metadata
  metadata: IncidentMetadataSchema.optional(),

  // Optional pre-collected evidence
  evidenceLite: EvidenceLiteSchema.optional(),

  // Source-specific raw payload (for audit/replay)
  sourcePayload: z.unknown().optional(),

  // Collection context (optional overrides)
  collectionContext: z
    .object({
      windowMinutesBefore: z.number().int().min(1).max(120).default(15),
      windowMinutesAfter: z.number().int().min(1).max(120).default(15),
      forceCollect: z.boolean().default(false), // Force evidence collection even if evidenceLite provided
    })
    .optional(),
});
export type IngestIncidentRequest = z.infer<typeof IngestIncidentRequestSchema>;

/**
 * Ingestion Response
 */
export const IngestIncidentResponseSchema = z.object({
  incidentId: z.string(),
  evidenceBundleId: z.string().optional(),
  analysisId: z.string().optional(),
  status: z.string(), // "created" | "analyzed" | "failed"
  message: z.string().optional(),
});
export type IngestIncidentResponse = z.infer<typeof IngestIncidentResponseSchema>;
