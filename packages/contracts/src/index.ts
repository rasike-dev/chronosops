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

/** Incident Source Type */
export const IncidentSourceTypeSchema = z.enum(["SCENARIO", "GOOGLE_CLOUD"]);
export type IncidentSourceType = z.infer<typeof IncidentSourceTypeSchema>;

/** Incident schema (for responses) */
export const IncidentSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  title: z.string().nullable().optional(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  sourceType: IncidentSourceTypeSchema.default("SCENARIO"),
  sourceRef: z.string().min(1).max(512).nullable().optional(),
  sourcePayload: z.unknown().nullable().optional(),
});
export type Incident = z.infer<typeof IncidentSchema>;

/** Create Incident request (for creating incidents) */
export const CreateIncidentRequestSchema = z.object({
  scenarioId: z.string(),
  title: z.string().nullable().optional(),
  sourceType: IncidentSourceTypeSchema.optional(),
  sourceRef: z.string().min(1).max(512).nullable().optional(),
  sourcePayload: z.unknown().nullable().optional(),
});
export type CreateIncidentRequest = z.infer<typeof CreateIncidentRequestSchema>;

/** Import Google Incidents */
export * from "./import-google.schema";

/** Google Evidence Lite */
export * from "./evidence/google-evidence-lite.schema";

/** Evidence Bundle */
export * from "./evidence/evidence-bundle.schema";

/** Metrics Evidence */
export * from "./evidence/metrics-evidence.schema";

/** Deployments Evidence */
export * from "./evidence/deploys-evidence.schema";

/** Config Diff Evidence */
export * from "./evidence/configdiff-evidence.schema";

/** Logs Evidence */
export * from "./evidence/logs-evidence.schema";

/** Traces Evidence */
export * from "./evidence/traces-evidence.schema";

/** Evidence Completeness */
export * from "./evidence/evidence-completeness.schema";

/** Reasoning */
export * from "./reasoning/reasoning.schema";
export * from "./reasoning/hypothesis-catalog.schema";
export * from "./reasoning/evidence-request-tool.schema";

/** Postmortem */
export * from "./postmortem/postmortem-v2.schema";

/** Analysis Compare */
export * from "./analysis/analysis-compare.schema";

/** Investigation */
export * from "./investigation/investigation.schema";

/** UI */
export * from "./ui/explainability-graph.schema";