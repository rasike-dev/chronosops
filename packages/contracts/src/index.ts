import { z } from "zod";

/** Metric point */
export const MetricPointSchema = z.object({
  serviceId: z.string(),
  metric: z.enum(["p95_latency_ms", "error_rate", "rps"]),
  timestamp: z.string(),
  value: z.number()
});

/** Scenario (MVP minimal) */
export const ScenarioSchema = z.object({
  scenarioId: z.string(),
  title: z.string(),
  description: z.string(),
  deployment: z.object({
    id: z.string(),
    serviceId: z.string(),
    versionFrom: z.string(),
    versionTo: z.string(),
    timestamp: z.string(),
  }),
  metrics: z.array(MetricPointSchema)
});
export type Scenario = z.infer<typeof ScenarioSchema>;

/** Scenario list item */
export const ScenarioListItemSchema = z.object({
  scenarioId: z.string(),
  title: z.string(),
});
export type ScenarioListItem = z.infer<typeof ScenarioListItemSchema>;

export const ScenarioListSchema = z.array(ScenarioListItemSchema);
export type ScenarioList = z.infer<typeof ScenarioListSchema>;

/** Analyze Incident request */
export const AnalyzeIncidentRequestSchema = z.object({
  scenarioId: z.string(),
  windowMinutesBefore: z.number().int().min(1).max(120).default(15),
  windowMinutesAfter: z.number().int().min(1).max(120).default(15),
});
export type AnalyzeIncidentRequest = z.infer<typeof AnalyzeIncidentRequestSchema>;

/** Analyze Incident response */
export const EvidenceSchema = z.object({
  type: z.enum(["metric", "trace", "log"]),
  key: z.string().optional(),
  route: z.string().optional(),
  span: z.string().optional(),
  pattern: z.string().optional(),
  delta: z.string().optional(),
});

export const LikelyRootCauseSchema = z.object({
  rank: z.number().int().min(1),
  title: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).default([]),
  nextActions: z.array(z.string()).default([]),
});

export const ExplainabilitySchema = z.object({
  primarySignal: z.enum(["latency", "errors"]),
  latencyFactor: z.number(),
  errorFactor: z.number(),
  rationale: z.string(),
});

export const EvidenceRowSchema = z.object({
  metric: z.enum(["p95_latency_ms", "error_rate"]),
  baselineAvg: z.number(),
  afterAvg: z.number(),
  delta: z.number(),
  factor: z.number(),
});

export const AnalyzeIncidentResponseSchema = z.object({
  incidentId: z.string(),
  summary: z.string(),
  likelyRootCauses: z.array(LikelyRootCauseSchema),
  blastRadius: z.object({
    impactedServices: z.array(z.string()),
    impactedRoutes: z.array(z.string()),
    userImpact: z.string(),
  }),
  questionsToConfirm: z.array(z.string()).default([]),
  explainability: ExplainabilitySchema,
  evidenceTable: z.array(EvidenceRowSchema),
});
export type AnalyzeIncidentResponse = z.infer<typeof AnalyzeIncidentResponseSchema>;

