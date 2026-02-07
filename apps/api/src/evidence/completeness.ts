import { EvidenceCompletenessSchema, EvidenceNeedSchema } from "@chronosops/contracts";

export function computeEvidenceCompleteness(input: {
  incidentSourceType: "SCENARIO" | "GOOGLE_CLOUD";
  primarySignal?: "latency" | "errors" | "UNKNOWN";
  bundle: any; // stored EvidenceBundle payload
}) {
  const artifacts = Array.isArray(input.bundle?.artifacts) ? input.bundle.artifacts : [];
  const kinds = new Set<string>(artifacts.map((a: any) => a?.kind).filter(Boolean));
  const sources = new Set<string>(Array.isArray(input.bundle?.sources) ? input.bundle.sources : []);

  const present: string[] = [];

  const has = (k: string) => kinds.has(k) || sources.has(k);

  const presentMetrics = has("metrics_summary") || sources.has("GCP_METRICS");
  const presentLogs = has("logs_summary") || sources.has("GCP_LOGS");
  const presentTraces = has("traces_summary") || sources.has("GCP_TRACES");
  const presentDeploys = has("deploys_summary") || sources.has("DEPLOYS");
  const presentConfig = has("config_diff_summary") || sources.has("CONFIG");
  const presentGoogle = Boolean(input.bundle?.googleEvidenceLite) || sources.has("GOOGLE_CLOUD");

  if (presentMetrics) present.push("METRICS");
  if (presentLogs) present.push("LOGS");
  if (presentTraces) present.push("TRACES");
  if (presentDeploys) present.push("DEPLOYS");
  if (presentConfig) present.push("CONFIG");
  if (input.incidentSourceType === "GOOGLE_CLOUD" && presentGoogle) present.push("GOOGLE_STATUS");

  // Base scoring
  let score = 0;
  if (presentMetrics) score += 25;
  if (presentLogs) score += 20;
  if (presentTraces) score += 20;
  if (presentDeploys) score += 15;
  if (presentConfig) score += 15;
  if (input.incidentSourceType === "GOOGLE_CLOUD" && presentGoogle) score += 5;

  // Stub penalty
  let stubPenalty = 0;
  for (const a of artifacts) {
    const mode = a?.payload?.completeness?.mode;
    if (mode === "STUB") stubPenalty += 5;
  }
  score = Math.max(0, Math.min(100, score - stubPenalty));

  const missing: Array<ReturnType<typeof EvidenceNeedSchema.parse>> = [];

  const want = (need: "METRICS" | "LOGS" | "TRACES" | "DEPLOYS" | "CONFIG" | "GOOGLE_STATUS", priority: "P0" | "P1" | "P2", reason: string) =>
    missing.push(EvidenceNeedSchema.parse({ need, priority, reason }));

  // Normalize primarySignal to match schema expectations
  const primarySignal = input.primarySignal === "latency" ? "LATENCY" : 
                        input.primarySignal === "errors" ? "ERRORS" : 
                        "UNKNOWN";

  // Missing needs logic
  if (!presentMetrics) want("METRICS", "P0", "Metrics establish magnitude and timing of impact.");
  
  if (primarySignal === "LATENCY") {
    if (!presentTraces) want("TRACES", "P0", "Traces pinpoint slow spans and downstream dependencies.");
    if (!presentDeploys) want("DEPLOYS", "P1", "Deployments help correlate regressions with changes.");
    if (!presentConfig) want("CONFIG", "P1", "Config diffs identify runtime misconfiguration.");
    if (!presentLogs) want("LOGS", "P2", "Logs may reveal timeouts and errors correlated with latency.");
  } else if (primarySignal === "ERRORS") {
    if (!presentLogs) want("LOGS", "P0", "Logs reveal error signatures and failing code paths.");
    if (!presentTraces) want("TRACES", "P1", "Traces show failing spans and error propagation.");
    if (!presentDeploys) want("DEPLOYS", "P1", "Deployments help correlate error spikes with releases.");
    if (!presentConfig) want("CONFIG", "P1", "Config diffs identify feature flags or bad settings.");
  } else {
    // UNKNOWN
    if (!presentLogs) want("LOGS", "P1", "Logs help classify the failure mode.");
    if (!presentTraces) want("TRACES", "P1", "Traces help localize slow/failing paths.");
  }

  if (input.incidentSourceType === "GOOGLE_CLOUD" && !presentGoogle) {
    want("GOOGLE_STATUS", "P0", "Google status evidence is the primary external signal for this incident.");
  }

  // Deduplicate missing by need (keep highest priority)
  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  const dedup = new Map<string, ReturnType<typeof EvidenceNeedSchema.parse>>();
  for (const m of missing) {
    const cur = dedup.get(m.need);
    if (!cur || priorityRank[m.priority] < priorityRank[cur.priority]) dedup.set(m.need, m);
  }

  const out = EvidenceCompletenessSchema.parse({
    kind: "EVIDENCE_COMPLETENESS_V1",
    score,
    present,
    missing: Array.from(dedup.values()),
    notes: stubPenalty > 0 ? [`Stub evidence penalty applied: -${stubPenalty}`] : [],
  });

  return out;
}
