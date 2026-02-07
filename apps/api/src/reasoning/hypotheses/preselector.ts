import { HYPOTHESIS_CATALOG } from "./catalog";

// Define HypothesisId type locally
type HypothesisId = 
  | "DB_QUERY_REGRESSION"
  | "CONFIG_REGRESSION"
  | "DEPLOY_BUG"
  | "DOWNSTREAM_OUTAGE"
  | "CAPACITY_SATURATION"
  | "NETWORK_DNS_ISSUE"
  | "CACHE_MISS_STORM"
  | "RATE_LIMIT_THROTTLING"
  | "AUTH_OIDC_ISSUE"
  | "UNKNOWN";

export function selectHypothesisCandidates(input: {
  primarySignal: "LATENCY" | "ERRORS" | "UNKNOWN";
  completenessScore: number;
  has: {
    metrics: boolean;
    logs: boolean;
    traces: boolean;
    deploys: boolean;
    config: boolean;
    googleStatus: boolean;
  };
  flags: {
    recentDeploy: boolean;
    configChanged: boolean;
    newErrorSignature: boolean;
    timeouts: boolean;
  };
}): HypothesisId[] {
  const triggers: string[] = [];

  if (input.primarySignal === "LATENCY") {
    triggers.push("latency_spike", "p95_up");
  }
  if (input.primarySignal === "ERRORS") {
    triggers.push("error_spike", "errors_up");
  }
  if (input.has.googleStatus) {
    triggers.push("google_cloud_incident");
  }
  if (input.flags.recentDeploy) {
    triggers.push("recent_deploy");
  }
  if (input.flags.configChanged) {
    triggers.push("config_changed");
  }
  if (input.flags.newErrorSignature) {
    triggers.push("new_error_signature");
  }
  if (input.flags.timeouts) {
    triggers.push("timeouts");
  }
  if (input.completenessScore < 40) {
    triggers.push("low_completeness");
  }

  // Score each hypothesis by trigger overlap
  const scored = HYPOTHESIS_CATALOG.map((h) => {
    const overlap = h.triggers.filter((t: string) => triggers.includes(t)).length;
    
    // Small bonus if required evidence is present
    const evidenceBonus = h.requires.filter((r: string) => {
      if (r === "METRICS") return input.has.metrics;
      if (r === "LOGS") return input.has.logs;
      if (r === "TRACES") return input.has.traces;
      if (r === "DEPLOYS") return input.has.deploys;
      if (r === "CONFIG") return input.has.config;
      if (r === "GOOGLE_STATUS") return input.has.googleStatus;
      return false;
    }).length * 0.5;

    return { id: h.id, title: h.title, score: overlap + evidenceBonus };
  })
    .sort((a, b) => b.score - a.score);

  const candidates = scored
    .filter((x) => x.score > 0)
    .slice(0, 7)
    .map((x) => x.id);

  // Always include UNKNOWN as fallback
  if (!candidates.includes("UNKNOWN")) {
    candidates.push("UNKNOWN");
  }

  return candidates.slice(0, 8) as HypothesisId[];
}
