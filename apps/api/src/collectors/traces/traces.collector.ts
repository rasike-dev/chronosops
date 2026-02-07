import { Injectable } from "@nestjs/common";
import { EvidenceCollector, EvidenceCollectContext, CollectorResult } from "../collector.types";
import { TracesClient } from "./traces.client";
import { TracesNormalizer } from "./traces.normalizer";

@Injectable()
export class TracesCollector implements EvidenceCollector {
  constructor(
    private readonly client: TracesClient,
    private readonly normalizer: TracesNormalizer
  ) {}

  async collect(ctx: EvidenceCollectContext): Promise<CollectorResult | null> {
    try {
      // Extract service hint if available
      const serviceHint = ctx.hints?.find(h => h.startsWith("service:"))?.replace("service:", "") || null;

      // Fetch spans
      const result = await this.client.fetchSpans({
        start: ctx.window.start,
        end: ctx.window.end,
        service: serviceHint,
        hints: ctx.hints,
      });

      // Normalize to TracesSummary
      const summary = this.normalizer.normalizeToSummary({
        window: ctx.window,
        spans: result.spans,
        mode: result.mode,
        notes: result.notes,
      });

      // Generate artifact ID (deterministic based on window)
      const artifactId = `traces_summary:v1:${ctx.window.start}-${ctx.window.end}`;

      return {
        kind: "traces_summary",
        artifactId,
        title: "Traces Summary",
        summary: `Traces summary for incident ${ctx.incidentId} (${summary.completeness.mode} mode, ${summary.totals.spans} spans, ${summary.topGroups.length} groups)`,
        payload: summary,
        sourceTag: "GCP_TRACES",
        mode: summary.completeness.mode,
      };
    } catch (error: any) {
      console.error('[TracesCollector.collect] Error:', error?.message || error);
      // Return null on error (collector failure shouldn't break analysis)
      return null;
    }
  }
}
