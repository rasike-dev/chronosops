import { z } from "zod";

export const LogExemplarSchema = z.object({
  id: z.string().min(1).max(128),
  ts: z.string(), // ISO
  severity: z.enum(["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL", "UNKNOWN"]),
  service: z.string().optional().nullable(),
  message: z.string().min(1).max(1000),
  attributes: z.record(z.string().max(200)).optional().default({}),
});

export const LogSignatureGroupSchema = z.object({
  signature: z.string().min(1).max(300),     // deterministic signature
  count: z.number().int().min(1),
  firstSeen: z.string(),
  lastSeen: z.string(),
  exemplarIds: z.array(z.string().min(1).max(128)).max(10),
});

export const LogsSummarySchema = z.object({
  kind: z.literal("LOGS_SUMMARY_V1"),
  window: z.object({ start: z.string(), end: z.string() }),
  totals: z.object({
    lines: z.number().int().min(0),
    errorLines: z.number().int().min(0),
    warnLines: z.number().int().min(0),
  }),
  topGroups: z.array(LogSignatureGroupSchema).max(50),
  exemplars: z.array(LogExemplarSchema).max(200),
  completeness: z.object({
    mode: z.enum(["REAL", "STUB"]),
    notes: z.array(z.string()).default([]),
  }),
});

export type LogsSummary = z.infer<typeof LogsSummarySchema>;
export type LogExemplar = z.infer<typeof LogExemplarSchema>;
export type LogSignatureGroup = z.infer<typeof LogSignatureGroupSchema>;
