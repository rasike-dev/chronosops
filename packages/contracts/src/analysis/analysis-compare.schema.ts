import { z } from "zod";

export const DiffItemSchema = z.object({
  type: z.enum(["ADDED", "REMOVED", "CHANGED", "UNCHANGED"]),
  key: z.string().min(1).max(200),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  note: z.string().optional().nullable(),
});

export const AnalysisCompareSchema = z.object({
  kind: z.literal("CHRONOSOPS_ANALYSIS_COMPARE_V1"),
  incidentId: z.string().min(1),
  a: z.object({
    analysisId: z.string().min(1),
    createdAt: z.string(),
    evidenceBundleId: z.string().optional().nullable(),
    confidence: z.number().min(0).max(1).optional().nullable(),
  }),
  b: z.object({
    analysisId: z.string().min(1),
    createdAt: z.string(),
    evidenceBundleId: z.string().optional().nullable(),
    confidence: z.number().min(0).max(1).optional().nullable(),
  }),

  evidence: z.object({
    bundleChanged: z.boolean(),
    artifactDiffs: z.array(DiffItemSchema).max(200),
  }),

  reasoning: z.object({
    primarySignalDiff: DiffItemSchema,
    hypothesisDiffs: z.array(DiffItemSchema).max(200),
    actionsDiffs: z.array(DiffItemSchema).max(200),
  }),

  completeness: z.object({
    scoreDiff: DiffItemSchema,
    missingDiffs: z.array(DiffItemSchema).max(200),
  }),

  summary: z.object({
    headline: z.string().min(1).max(300),
    keyChanges: z.array(z.string().min(1).max(400)).max(20).default([]),
  }),
});

export type AnalysisCompare = z.infer<typeof AnalysisCompareSchema>;
export type DiffItem = z.infer<typeof DiffItemSchema>;
