import { type EvidenceRequest } from "@chronosops/contracts";
import { GcpMetricsCollector } from "../collectors/gcp-metrics/gcp-metrics.collector";
import { DeploysCollector } from "../collectors/deploys/deploys.collector";
import { ConfigDiffCollector } from "../collectors/configdiff/configdiff.collector";
import { LogsCollector } from "../collectors/logs/logs.collector";
import { TracesCollector } from "../collectors/traces/traces.collector";
import type { EvidenceCollectContext } from "../collectors/collector.types";

export interface CollectorMapping {
  type: string;
  collector: any;
  request: EvidenceRequest;
}

/**
 * Maps evidence requests to specific collectors deterministically.
 * Limits to max 2 needs per iteration (highest priority first).
 */
export function mapRequestsToCollectors(
  approvedRequests: EvidenceRequest[],
  collectors: {
    metrics: GcpMetricsCollector;
    logs: LogsCollector;
    traces: TracesCollector;
    deploys: DeploysCollector;
    config: ConfigDiffCollector;
  }
): CollectorMapping[] {
  // Priority ranking
  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

  // Sort by priority (P0 first)
  const sorted = [...approvedRequests].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  // Limit to 2 collectors per iteration
  const selected = sorted.slice(0, 2);

  const mappings: CollectorMapping[] = [];

  for (const request of selected) {
    let collector: any = null;
    let type = "";

    switch (request.need) {
      case "METRICS":
        collector = collectors.metrics;
        type = "METRICS";
        break;
      case "LOGS":
        collector = collectors.logs;
        type = "LOGS";
        break;
      case "TRACES":
        collector = collectors.traces;
        type = "TRACES";
        break;
      case "DEPLOYS":
        collector = collectors.deploys;
        type = "DEPLOYS";
        break;
      case "CONFIG":
        collector = collectors.config;
        type = "CONFIG";
        break;
      case "GOOGLE_STATUS":
        // No-op: already present if imported; else no collector available
        continue;
      default:
        continue;
    }

    if (collector) {
      mappings.push({
        type,
        collector,
        request,
      });
    }
  }

  return mappings;
}

/**
 * Builds collection context from request scope, falling back to session window.
 */
export function buildCollectContext(
  request: EvidenceRequest,
  sessionWindow: { start: string; end: string },
  incidentId: string,
  baseHints: string[] = []
): EvidenceCollectContext {
  const windowStart = request.scope?.windowStart || sessionWindow.start;
  const windowEnd = request.scope?.windowEnd || sessionWindow.end;

  const hints = [...baseHints];
  if (request.scope?.service) {
    hints.push(`service:${request.scope.service}`);
  }
  if (request.scope?.region) {
    hints.push(`region:${request.scope.region}`);
  }

  return {
    incidentId,
    window: {
      start: windowStart,
      end: windowEnd,
    },
    hints,
  };
}
