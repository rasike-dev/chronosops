import { z } from "zod";

export const MetricsPointSchema = z.object({
  ts: z.string(),         // ISO
  value: z.number(),
});

export const MetricsSeriesSchema = z.object({
  metric: z.string().min(1),     // e.g., "latency_p95"
  unit: z.string().min(1),       // "ms", "%", "rps"
  points: z.array(MetricsPointSchema).max(600), // keep bounded
});

export const MetricsSummarySchema = z.object({
  kind: z.literal("METRICS_SUMMARY_V1"),
  window: z.object({
    start: z.string(),
    end: z.string(),
    stepSeconds: z.number().int().min(10).max(300),
  }),
  series: z.array(MetricsSeriesSchema).max(10),

  // deterministic computed deltas
  aggregates: z.object({
    latencyP95: z.object({ baseline: z.number(), incident: z.number(), delta: z.number() }).optional(),
    errorRate: z.object({ baseline: z.number(), incident: z.number(), delta: z.number() }).optional(),
    rps: z.object({ baseline: z.number(), incident: z.number(), delta: z.number() }).optional(),
  }),

  completeness: z.object({
    mode: z.enum(["REAL", "STUB"]),
    notes: z.array(z.string()).default([]),
  }),
});

export type MetricsSummary = z.infer<typeof MetricsSummarySchema>;
export type MetricsPoint = z.infer<typeof MetricsPointSchema>;
export type MetricsSeries = z.infer<typeof MetricsSeriesSchema>;
