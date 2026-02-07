import { Injectable } from "@nestjs/common";
import { EvidenceCollector, EvidenceCollectContext, CollectorResult } from "../collector.types";
import { GcpMetricsClient } from "./gcp-metrics.client";
import { GcpMetricsNormalizer } from "./gcp-metrics.normalizer";

@Injectable()
export class GcpMetricsCollector implements EvidenceCollector {
  constructor(
    private readonly client: GcpMetricsClient,
    private readonly normalizer: GcpMetricsNormalizer
  ) {}

  async collect(ctx: EvidenceCollectContext): Promise<CollectorResult | null> {
    try {
      // Fetch time series for key metrics
      const latencyResult = await this.client.fetchTimeSeries({
        metricType: "compute.googleapis.com/instance/cpu/utilization", // Placeholder - adjust to actual latency metric
        start: ctx.window.start,
        end: ctx.window.end,
        alignmentPeriodSeconds: 60,
      });

      const errorRateResult = await this.client.fetchTimeSeries({
        metricType: "compute.googleapis.com/instance/network/received_bytes_count", // Placeholder - adjust to actual error metric
        start: ctx.window.start,
        end: ctx.window.end,
        alignmentPeriodSeconds: 60,
      });

      // Normalize to MetricsSummary
      const summary = this.normalizer.normalizeToSummary({
        window: ctx.window,
        latencyPoints: latencyResult.points,
        errorRatePoints: errorRateResult.points,
        rpsPoints: [], // TODO: Add RPS metric fetch
        mode: latencyResult.mode,
        notes: [...latencyResult.notes, ...errorRateResult.notes],
      });

      // Generate artifact ID (deterministic based on window)
      const artifactId = `gcp_metrics_summary:v1:${ctx.window.start}-${ctx.window.end}`;

      return {
        kind: "metrics_summary",
        artifactId,
        title: "GCP Metrics Summary",
        summary: `Metrics summary for incident ${ctx.incidentId} (${summary.completeness.mode} mode)`,
        payload: summary,
        sourceTag: "GCP_METRICS",
        mode: summary.completeness.mode,
      };
    } catch (error: any) {
      console.error('[GcpMetricsCollector.collect] Error:', error?.message || error);
      // Return null on error (collector failure shouldn't break analysis)
      return null;
    }
  }
}
