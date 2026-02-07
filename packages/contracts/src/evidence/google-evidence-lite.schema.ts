import { z } from "zod";

export const GoogleEvidenceLiteSchema = z.object({
  kind: z.literal("GOOGLE_EVIDENCE_LITE"),
  sourceRef: z.string().min(1),
  url: z.string().url().optional().nullable(),

  service: z.string().optional().nullable(),
  region: z.string().optional().nullable(),

  status: z.enum(["investigating", "identified", "monitoring", "resolved", "unknown"]),
  severity: z.enum(["low", "medium", "high", "critical", "unknown"]),

  timeline: z.object({
    begin: z.string().optional().nullable(),   // ISO
    update: z.string().optional().nullable(),  // ISO
    end: z.string().optional().nullable(),     // ISO
  }),

  headline: z.string().min(1).max(500),
  summary: z.string().min(1).max(4000),

  // deterministic "hints" (NOT AI)
  hypothesisHints: z.array(z.string().min(1).max(200)).default([]),
});

export type GoogleEvidenceLite = z.infer<typeof GoogleEvidenceLiteSchema>;
