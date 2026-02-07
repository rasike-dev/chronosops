import { z } from "zod";

export const TraceSpanExemplarSchema = z.object({
  id: z.string().min(1).max(128),
  ts: z.string(),
  service: z.string().optional().nullable(),
  operation: z.string().min(1).max(200),
  durationMs: z.number().min(0),
  status: z.enum(["OK", "ERROR", "UNSET"]),
  attributes: z.record(z.string().max(200)).optional().default({}),
});

export const TraceGroupSchema = z.object({
  signature: z.string().min(1).max(300), // e.g. service|operation|status
  count: z.number().int().min(1),
  p50Ms: z.number().min(0),
  p95Ms: z.number().min(0),
  maxMs: z.number().min(0),
  exemplarIds: z.array(z.string().min(1).max(128)).max(10),
});

export const TracesSummarySchema = z.object({
  kind: z.literal("TRACES_SUMMARY_V1"),
  window: z.object({ start: z.string(), end: z.string() }),
  totals: z.object({
    spans: z.number().int().min(0),
    errorSpans: z.number().int().min(0),
  }),
  topGroups: z.array(TraceGroupSchema).max(50),
  exemplars: z.array(TraceSpanExemplarSchema).max(200),
  completeness: z.object({
    mode: z.enum(["REAL", "STUB"]),
    notes: z.array(z.string()).default([]),
  }),
});

export type TracesSummary = z.infer<typeof TracesSummarySchema>;
export type TraceSpanExemplar = z.infer<typeof TraceSpanExemplarSchema>;
export type TraceGroup = z.infer<typeof TraceGroupSchema>;
