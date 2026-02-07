import { z } from "zod";

export const DeployEventSchema = z.object({
  id: z.string().min(1).max(128),
  ts: z.string(), // ISO
  system: z.enum(["CLOUD_BUILD", "GITHUB", "MANUAL", "UNKNOWN"]),
  service: z.string().optional().nullable(),
  environment: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  commitSha: z.string().optional().nullable(),
  actor: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
});

export const DeploysSummarySchema = z.object({
  kind: z.literal("DEPLOYS_SUMMARY_V1"),
  window: z.object({
    start: z.string(),
    end: z.string(),
  }),
  deploys: z.array(DeployEventSchema).max(200),
  completeness: z.object({
    mode: z.enum(["REAL", "STUB"]),
    notes: z.array(z.string()).default([]),
  }),
});

export type DeploysSummary = z.infer<typeof DeploysSummarySchema>;
export type DeployEvent = z.infer<typeof DeployEventSchema>;
