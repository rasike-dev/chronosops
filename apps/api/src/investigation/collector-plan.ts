import { EvidenceNeedSchema, type EvidenceNeed } from "@chronosops/contracts";

export type CollectorType = "METRICS" | "LOGS" | "TRACES" | "DEPLOYS" | "CONFIG" | "GOOGLE_STATUS";

export interface CollectorPlan {
  collectors: CollectorType[];
  reason: string;
}

/**
 * Maps missing evidence needs to specific collectors.
 * Prioritizes P0 needs first, then P1, then P2.
 * Picks up to 2 evidence types per iteration to keep bounded.
 */
export function planCollectors(
  missingNeeds: EvidenceNeed[],
  existingSources: string[]
): CollectorPlan {
  // Validate and parse needs
  const needs = missingNeeds.map(n => EvidenceNeedSchema.parse(n));
  
  // Priority ranking
  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  
  // Sort by priority (P0 first)
  const sorted = [...needs].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  
  // Map need to collector type
  const needToCollector: Record<string, CollectorType> = {
    METRICS: "METRICS",
    LOGS: "LOGS",
    TRACES: "TRACES",
    DEPLOYS: "DEPLOYS",
    CONFIG: "CONFIG",
    GOOGLE_STATUS: "GOOGLE_STATUS",
  };
  
  // Filter out needs that already have sources present
  const existingSet = new Set(existingSources);
  const filtered = sorted.filter(need => {
    const collector = needToCollector[need.need];
    if (!collector) return false;
    
    // Check if this evidence type is already present
    const sourceMap: Record<CollectorType, string[]> = {
      METRICS: ["GCP_METRICS", "metrics_summary"],
      LOGS: ["GCP_LOGS", "logs_summary"],
      TRACES: ["GCP_TRACES", "traces_summary"],
      DEPLOYS: ["DEPLOYS", "deploys_summary"],
      CONFIG: ["CONFIG", "config_diff_summary"],
      GOOGLE_STATUS: ["GOOGLE_CLOUD", "googleEvidenceLite"],
    };
    
    const sources = sourceMap[collector] || [];
    return !sources.some(s => existingSet.has(s));
  });
  
  // Pick up to 2 collectors
  const selected = filtered.slice(0, 2);
  const collectors = selected.map(n => needToCollector[n.need]).filter(Boolean) as CollectorType[];
  
  const reasons = selected.map(n => `${n.need} (${n.priority}): ${n.reason}`);
  const reason = collectors.length > 0
    ? `Selected ${collectors.length} collector(s): ${reasons.join("; ")}`
    : "No new collectors needed (all evidence types already present)";
  
  return {
    collectors,
    reason,
  };
}
