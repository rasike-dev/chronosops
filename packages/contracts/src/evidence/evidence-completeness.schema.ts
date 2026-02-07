import { z } from "zod";

export const EvidenceNeedSchema = z.object({
  need: z.enum([
    "METRICS",
    "LOGS",
    "TRACES",
    "DEPLOYS",
    "CONFIG",
    "GOOGLE_STATUS",   // for GOOGLE_CLOUD sources
  ]),
  priority: z.enum(["P0", "P1", "P2"]),
  reason: z.string().min(1).max(400),
});

export const EvidenceCompletenessSchema = z.object({
  kind: z.literal("EVIDENCE_COMPLETENESS_V1"),
  score: z.number().int().min(0).max(100),

  present: z.array(z.string().min(1)).default([]),
  missing: z.array(EvidenceNeedSchema).default([]),

  notes: z.array(z.string()).default([]),
});

export type EvidenceCompleteness = z.infer<typeof EvidenceCompletenessSchema>;
export type EvidenceNeed = z.infer<typeof EvidenceNeedSchema>;
