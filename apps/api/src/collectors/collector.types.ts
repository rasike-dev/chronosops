export type EvidenceCollectContext = {
  incidentId: string;
  window: { start: string; end: string };
  // later: tenant/project, service, region, etc.
  hints?: string[];
};

export type CollectorResult = {
  kind: string;
  artifactId: string;
  title: string;
  summary: string;
  payload: unknown;
  sourceTag: "GCP_METRICS" | "SCENARIO" | "GOOGLE_CLOUD" | "DEPLOYS" | "CONFIG" | "GCP_LOGS" | "GCP_TRACES";
  mode: "REAL" | "STUB";
};

export interface EvidenceCollector {
  collect(ctx: EvidenceCollectContext): Promise<CollectorResult | null>;
}
