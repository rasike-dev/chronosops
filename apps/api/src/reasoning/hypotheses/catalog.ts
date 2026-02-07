// Define catalog item type locally (contracts export may not be available yet)
type HypothesisCatalogItem = {
  id: string;
  title: string;
  description: string;
  triggers: readonly string[];
  requires: readonly string[];
};

export const HYPOTHESIS_CATALOG: readonly HypothesisCatalogItem[] = [
  {
    id: "DB_QUERY_REGRESSION",
    title: "Database query regression",
    description: "A query plan change, missing index, or N+1 behavior caused latency and/or errors.",
    triggers: ["latency_spike", "p95_up", "db_time_up", "timeouts", "recent_deploy"],
    requires: ["METRICS", "TRACES", "DEPLOYS"],
  },
  {
    id: "CONFIG_REGRESSION",
    title: "Configuration regression",
    description: "A runtime config/feature flag/env change caused failure or degraded performance.",
    triggers: ["config_changed", "error_spike", "recent_deploy"],
    requires: ["CONFIG", "DEPLOYS", "LOGS"],
  },
  {
    id: "DEPLOY_BUG",
    title: "Deployment introduced a bug",
    description: "A code change caused new errors/latency; correlates strongly with a deployment event.",
    triggers: ["recent_deploy", "new_error_signature", "error_spike", "latency_spike"],
    requires: ["DEPLOYS", "LOGS", "TRACES"],
  },
  {
    id: "DOWNSTREAM_OUTAGE",
    title: "Downstream dependency outage",
    description: "An external or internal downstream service is degraded/unavailable, causing cascading failures.",
    triggers: ["errors_up", "timeouts", "google_cloud_incident"],
    requires: ["TRACES", "LOGS", "GOOGLE_STATUS"],
  },
  {
    id: "CAPACITY_SATURATION",
    title: "Capacity saturation / resource exhaustion",
    description: "CPU/memory/connections are saturated leading to queueing, latency, and errors.",
    triggers: ["rps_up", "latency_spike", "errors_up"],
    requires: ["METRICS", "LOGS"],
  },
  {
    id: "NETWORK_DNS_ISSUE",
    title: "Network or DNS issue",
    description: "Network connectivity problems, DNS resolution failures, or routing issues causing timeouts and errors.",
    triggers: ["timeouts", "errors_up", "latency_spike"],
    requires: ["TRACES", "LOGS"],
  },
  {
    id: "CACHE_MISS_STORM",
    title: "Cache miss storm",
    description: "Cache invalidation or miss storm causing increased load on downstream systems and latency spikes.",
    triggers: ["latency_spike", "rps_up", "recent_deploy"],
    requires: ["METRICS", "TRACES"],
  },
  {
    id: "RATE_LIMIT_THROTTLING",
    title: "Rate limit or throttling",
    description: "Rate limits or throttling mechanisms triggered, causing errors and degraded performance.",
    triggers: ["errors_up", "rps_up", "timeouts"],
    requires: ["METRICS", "LOGS"],
  },
  {
    id: "AUTH_OIDC_ISSUE",
    title: "Authentication or OIDC issue",
    description: "Authentication provider or OIDC service issues causing 401/403 errors and access failures.",
    triggers: ["error_spike", "auth_errors", "google_cloud_incident"],
    requires: ["LOGS", "GOOGLE_STATUS"],
  },
  {
    id: "UNKNOWN",
    title: "Unknown / insufficient evidence",
    description: "Evidence is incomplete or conflicting; more data is required to conclude.",
    triggers: ["low_completeness"],
    requires: [],
  },
] as const;
