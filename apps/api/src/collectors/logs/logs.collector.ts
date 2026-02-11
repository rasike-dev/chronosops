import { Injectable } from "@nestjs/common";
import { EvidenceCollector, EvidenceCollectContext, CollectorResult } from "../collector.types";
import { LogsClient } from "./logs.client";
import { LogsNormalizer } from "./logs.normalizer";

@Injectable()
export class LogsCollector implements EvidenceCollector {
  constructor(
    private readonly client: LogsClient,
    private readonly normalizer: LogsNormalizer
  ) {}

  async collect(ctx: EvidenceCollectContext): Promise<CollectorResult | null> {
    try {
      // Extract service hint if available
      const serviceHint = ctx.hints?.find(h => h.startsWith("service:"))?.replace("service:", "") || null;

      // Fetch logs
      const result = await this.client.fetchLogs({
        start: ctx.window.start,
        end: ctx.window.end,
        service: serviceHint,
      });

      // Normalize to LogsSummary
      const summary = this.normalizer.normalizeToSummary({
        window: ctx.window,
        logs: result.logs,
        mode: result.mode,
        notes: result.notes,
      });

      // Generate artifact ID (deterministic based on window)
      const artifactId = `logs_summary:v1:${ctx.window.start}-${ctx.window.end}`;

      return {
        kind: "logs_summary",
        artifactId,
        title: "Logs Summary",
        summary: `Logs summary for incident ${ctx.incidentId} (${summary.completeness.mode} mode, ${summary.totals.lines} lines, ${summary.topGroups.length} groups)`,
        payload: summary,
        sourceTag: "GCP_LOGS",
        mode: summary.completeness.mode,
      };
    } catch (error: any) {
      console.error('[LogsCollector.collect] Error:', error?.message || error);
      // Return null on error (collector failure shouldn't break analysis)
      return null;
    }
  }
}
