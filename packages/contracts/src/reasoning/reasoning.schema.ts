import { z } from "zod";

export const HypothesisSchema = z.object({
  id: z.string().min(1).max(64),                // e.g. "DB_QUERY_REGRESSION"
  title: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(1200),
  evidenceRefs: z.array(z.string().min(1).max(128)).max(50).default([]), // artifactIds
});

export const ExplainabilitySchema = z.object({
  primarySignal: z.enum(["LATENCY", "ERRORS", "UNKNOWN"]),
  latencyFactor: z.number().min(0).max(1),
  errorFactor: z.number().min(0).max(1),
  rationale: z.string().min(1).max(1500),
  evidenceRefs: z.array(z.string().min(1).max(128)).max(50).default([]),
});

export const RecommendedActionSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  steps: z.array(z.string().min(1).max(500)).min(1).max(12),
  priority: z.enum(["P0", "P1", "P2"]),
  evidenceRefs: z.array(z.string().min(1).max(128)).max(50).default([]),
});

export const EvidenceRequestSchema = z.object({
  need: z.enum(["METRICS", "LOGS", "TRACES", "DEPLOYS", "CONFIG", "GOOGLE_STATUS"]),
  priority: z.enum(["P0", "P1", "P2"]),
  reason: z.string().min(1).max(400),
  scope: z
    .object({
      windowStart: z.string().optional(),
      windowEnd: z.string().optional(),
      service: z.string().optional(),
      region: z.string().optional(),
    })
    .optional(),
});

export const ReasoningResponseSchema = z.object({
  kind: z.literal("CHRONOSOPS_REASONING_V1"),
  model: z.string().min(1).max(120),
  promptVersion: z.string().min(1).max(64),

  hypotheses: z.array(HypothesisSchema).min(1).max(10),
  explainability: ExplainabilitySchema,
  recommendedActions: z.array(RecommendedActionSchema).max(10).default([]),
  missingEvidenceRequests: z.array(EvidenceRequestSchema).max(10).default([]),

  overallConfidence: z.number().min(0).max(1),
});

export type ReasoningResponse = z.infer<typeof ReasoningResponseSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type Explainability = z.infer<typeof ExplainabilitySchema>;
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;
export type EvidenceRequest = z.infer<typeof EvidenceRequestSchema>;

// Request is intentionally bounded + references evidence bundle artifacts by id.
export const ReasoningRequestSchema = z.object({
  kind: z.literal("CHRONOSOPS_REASONING_REQUEST_V1"),
  incidentId: z.string().min(1),
  evidenceBundleId: z.string().min(16),
  promptVersion: z.string().min(1).max(64),

  // Candidate hypothesis IDs (deterministic preselector output)
  candidates: z.array(z.string().min(1).max(64)).min(1).max(10),

  // What Gemini sees: curated summaries only
  context: z.object({
    incidentSummary: z.string().min(1).max(2000),
    sourceType: z.enum(["SCENARIO", "GOOGLE_CLOUD"]),
    timeline: z.object({
      start: z.string(),
      end: z.string(),
    }),
    evidenceArtifacts: z
      .array(
        z.object({
          artifactId: z.string().min(1).max(128),
          kind: z.string().min(1).max(64),
          title: z.string().min(1).max(200),
          summary: z.string().min(1).max(4000),
        })
      )
      .max(50),
  }),
});

export type ReasoningRequest = z.infer<typeof ReasoningRequestSchema>;
