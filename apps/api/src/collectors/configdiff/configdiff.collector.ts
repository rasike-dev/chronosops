import { Injectable } from "@nestjs/common";
import { EvidenceCollector, EvidenceCollectContext, CollectorResult } from "../collector.types";
import { ConfigDiffClient } from "./configdiff.client";
import { ConfigDiffNormalizer } from "./configdiff.normalizer";

@Injectable()
export class ConfigDiffCollector implements EvidenceCollector {
  constructor(
    private readonly client: ConfigDiffClient,
    private readonly normalizer: ConfigDiffNormalizer
  ) {}

  async collect(ctx: EvidenceCollectContext): Promise<CollectorResult | null> {
    try {
      // Extract service and environment hints if available
      const serviceHint = ctx.hints?.find(h => h.startsWith("service:"))?.replace("service:", "") || null;
      const environmentHint = ctx.hints?.find(h => h.startsWith("env:"))?.replace("env:", "") || null;

      // Fetch config diffs
      const result = await this.client.fetchConfigDiffs({
        start: ctx.window.start,
        end: ctx.window.end,
        service: serviceHint,
        environment: environmentHint || "production",
      });

      // Normalize to ConfigDiffSummary
      const summary = this.normalizer.normalizeToSummary({
        window: ctx.window,
        diffs: result.diffs,
        service: serviceHint,
        environment: environmentHint || "production",
        mode: result.mode,
        notes: result.notes,
      });

      // Generate artifact ID (deterministic based on window)
      const artifactId = `config_diff_summary:v1:${ctx.window.start}-${ctx.window.end}`;

      return {
        kind: "config_diff_summary",
        artifactId,
        title: "Config Diff Summary",
        summary: `Config changes for incident ${ctx.incidentId} (${summary.completeness.mode} mode, ${summary.diffs.length} changes)`,
        payload: summary,
        sourceTag: "CONFIG",
        mode: summary.completeness.mode,
      };
    } catch (error: any) {
      console.error('[ConfigDiffCollector.collect] Error:', error?.message || error);
      // Return null on error (collector failure shouldn't break analysis)
      return null;
    }
  }
}
