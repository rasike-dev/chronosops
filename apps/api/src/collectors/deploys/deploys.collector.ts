import { Injectable } from "@nestjs/common";
import { EvidenceCollector, EvidenceCollectContext, CollectorResult } from "../collector.types";
import { DeploysClient } from "./deploys.client";
import { DeploysNormalizer } from "./deploys.normalizer";

@Injectable()
export class DeploysCollector implements EvidenceCollector {
  constructor(
    private readonly client: DeploysClient,
    private readonly normalizer: DeploysNormalizer
  ) {}

  async collect(ctx: EvidenceCollectContext): Promise<CollectorResult | null> {
    try {
      // Extract service hint if available
      const serviceHint = ctx.hints?.find(h => h.startsWith("service:"))?.replace("service:", "") || null;

      // Fetch deploy events
      const result = await this.client.fetchDeployEvents({
        start: ctx.window.start,
        end: ctx.window.end,
        service: serviceHint,
      });

      // Normalize to DeploysSummary
      const summary = this.normalizer.normalizeToSummary({
        window: ctx.window,
        events: result.events,
        mode: result.mode,
        notes: result.notes,
      });

      // Generate artifact ID (deterministic based on window)
      const artifactId = `deploys_summary:v1:${ctx.window.start}-${ctx.window.end}`;

      return {
        kind: "deploys_summary",
        artifactId,
        title: "Deployments Summary",
        summary: `Deployment events for incident ${ctx.incidentId} (${summary.completeness.mode} mode, ${summary.deploys.length} events)`,
        payload: summary,
        sourceTag: "DEPLOYS",
        mode: summary.completeness.mode,
      };
    } catch (error: any) {
      console.error('[DeploysCollector.collect] Error:', error?.message || error);
      // Return null on error (collector failure shouldn't break analysis)
      return null;
    }
  }
}
