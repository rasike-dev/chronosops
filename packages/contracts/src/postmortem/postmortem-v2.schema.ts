import { z } from "zod";

export const PostmortemReferenceSchema = z.object({
  kind: z.enum(["EVIDENCE_BUNDLE", "PROMPT_TRACE", "ANALYSIS"]),
  ref: z.string().min(1),
  hash: z.string().optional().nullable(),
});

export const PostmortemActionSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  title: z.string().min(1).max(200),
  steps: z.array(z.string().min(1).max(600)).min(1).max(15),
  evidenceRefs: z.array(z.string().min(1).max(128)).max(50).default([]),
});

export const PostmortemSectionSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(20000),
});

export const PostmortemV2Schema = z.object({
  kind: z.literal("CHRONOSOPS_POSTMORTEM_V2"),

  incidentId: z.string().min(1),
  analysisId: z.string().min(1),

  generatedAt: z.string(),
  generatorVersion: z.string().min(1).max(64),

  source: z.object({
    sourceType: z.enum(["SCENARIO", "GOOGLE_CLOUD"]),
    sourceRef: z.string().optional().nullable(),
    sourceUrl: z.string().optional().nullable(),
  }),

  summary: z.object({
    headline: z.string().min(1).max(200),
    impact: z.string().min(1).max(2000),
    rootCause: z.string().min(1).max(2000),
    confidence: z.number().min(0).max(1),
  }),

  timeline: z.object({
    start: z.string(),
    end: z.string(),
    notes: z.array(z.string()).max(30).default([]),
  }),

  evidence: z.object({
    bundleId: z.string().min(16),
    completenessScore: z.number().int().min(0).max(100),
    missing: z.array(z.string().min(1).max(400)).max(30).default([]),
    artifactSummaries: z
      .array(
        z.object({
          artifactId: z.string().min(1).max(128),
          kind: z.string().min(1).max(64),
          title: z.string().min(1).max(200),
          summary: z.string().min(1).max(4000),
        })
      )
      .max(80),
  }),

  reasoning: z.object({
    primarySignal: z.enum(["LATENCY", "ERRORS", "UNKNOWN"]),
    rationale: z.string().min(1).max(3000),
    topHypotheses: z
      .array(
        z.object({
          id: z.string().min(1).max(64),
          title: z.string().min(1).max(120),
          confidence: z.number().min(0).max(1),
          rationale: z.string().min(1).max(1200),
          evidenceRefs: z.array(z.string().min(1).max(128)).max(50).default([]),
        })
      )
      .min(1)
      .max(10),
  }),

  actions: z.array(PostmortemActionSchema).max(20).default([]),

  references: z.array(PostmortemReferenceSchema).max(20).default([]),

  sections: z.array(PostmortemSectionSchema).max(30).default([]),
});

export type PostmortemV2 = z.infer<typeof PostmortemV2Schema>;
export type PostmortemReference = z.infer<typeof PostmortemReferenceSchema>;
export type PostmortemAction = z.infer<typeof PostmortemActionSchema>;
export type PostmortemSection = z.infer<typeof PostmortemSectionSchema>;
