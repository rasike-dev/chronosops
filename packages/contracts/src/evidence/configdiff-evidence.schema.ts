import { z } from "zod";

export const ConfigDiffItemSchema = z.object({
  key: z.string().min(1).max(256),
  before: z.string().optional().nullable(),
  after: z.string().optional().nullable(),
  changeType: z.enum(["ADDED", "REMOVED", "UPDATED", "UNKNOWN"]),
});

export const ConfigDiffSummarySchema = z.object({
  kind: z.literal("CONFIG_DIFF_SUMMARY_V1"),
  scope: z.object({
    service: z.string().optional().nullable(),
    environment: z.string().optional().nullable(),
  }),
  window: z.object({
    start: z.string(),
    end: z.string(),
  }),
  diffs: z.array(ConfigDiffItemSchema).max(500),
  completeness: z.object({
    mode: z.enum(["REAL", "STUB"]),
    notes: z.array(z.string()).default([]),
  }),
});

export type ConfigDiffSummary = z.infer<typeof ConfigDiffSummarySchema>;
export type ConfigDiffItem = z.infer<typeof ConfigDiffItemSchema>;
