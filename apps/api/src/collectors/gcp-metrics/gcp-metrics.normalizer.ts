import { Injectable } from "@nestjs/common";
import { MetricsSummarySchema } from "@chronosops/contracts";

@Injectable()
export class GcpMetricsNormalizer {
  /**
   * Normalize raw time series points into MetricsSummary
   * Deterministic preprocessing: computes aggregates, splits baseline vs incident window
   */
  normalizeToSummary(input: {
    window: { start: string; end: string };
    latencyPoints: { ts: string; value: number }[];
    errorRatePoints: { ts: string; value: number }[];
    rpsPoints?: { ts: string; value: number }[];
    mode: "REAL" | "STUB";
    notes: string[];
  }): ReturnType<typeof MetricsSummarySchema.parse> {
    const stepSeconds = 60; // Fixed step for consistency
    const start = new Date(input.window.start);
    const end = new Date(input.window.end);
    const windowMs = end.getTime() - start.getTime();
    const midpoint = new Date(start.getTime() + windowMs / 2);

    // Helper: compute average of points in a time range
    const avgInRange = (points: { ts: string; value: number }[], rangeStart: Date, rangeEnd: Date): number => {
      const filtered = points.filter(p => {
        const ts = new Date(p.ts);
        return ts >= rangeStart && ts <= rangeEnd;
      });
      if (filtered.length === 0) return 0;
      const sum = filtered.reduce((acc, p) => acc + p.value, 0);
      return sum / filtered.length;
    };

    // Compute baseline (first half) and incident (second half) averages
    const latencyBaseline = avgInRange(input.latencyPoints, start, midpoint);
    const latencyIncident = avgInRange(input.latencyPoints, midpoint, end);
    const latencyDelta = latencyIncident - latencyBaseline;

    const errorRateBaseline = avgInRange(input.errorRatePoints, start, midpoint);
    const errorRateIncident = avgInRange(input.errorRatePoints, midpoint, end);
    const errorRateDelta = errorRateIncident - errorRateBaseline;

    const rpsBaseline = input.rpsPoints ? avgInRange(input.rpsPoints, start, midpoint) : 0;
    const rpsIncident = input.rpsPoints ? avgInRange(input.rpsPoints, midpoint, end) : 0;
    const rpsDelta = rpsIncident - rpsBaseline;

    // Build series (limit to 600 points per series, keep bounded)
    const series = [
      {
        metric: "latency_p95",
        unit: "ms",
        points: input.latencyPoints.slice(0, 600),
      },
      {
        metric: "error_rate",
        unit: "%",
        points: input.errorRatePoints.slice(0, 600),
      },
      ...(input.rpsPoints && input.rpsPoints.length > 0
        ? [{
            metric: "rps",
            unit: "rps",
            points: input.rpsPoints.slice(0, 600),
          }]
        : []),
    ];

    const summary = {
      kind: "METRICS_SUMMARY_V1" as const,
      window: {
        start: input.window.start,
        end: input.window.end,
        stepSeconds,
      },
      series,
      aggregates: {
        ...(input.latencyPoints.length > 0
          ? {
              latencyP95: {
                baseline: Number(latencyBaseline.toFixed(2)),
                incident: Number(latencyIncident.toFixed(2)),
                delta: Number(latencyDelta.toFixed(2)),
              },
            }
          : {}),
        ...(input.errorRatePoints.length > 0
          ? {
              errorRate: {
                baseline: Number(errorRateBaseline.toFixed(5)),
                incident: Number(errorRateIncident.toFixed(5)),
                delta: Number(errorRateDelta.toFixed(5)),
              },
            }
          : {}),
        ...(input.rpsPoints && input.rpsPoints.length > 0
          ? {
              rps: {
                baseline: Number(rpsBaseline.toFixed(2)),
                incident: Number(rpsIncident.toFixed(2)),
                delta: Number(rpsDelta.toFixed(2)),
              },
            }
          : {}),
      },
      completeness: {
        mode: input.mode,
        notes: input.notes,
      },
    };

    return MetricsSummarySchema.parse(summary);
  }
}
