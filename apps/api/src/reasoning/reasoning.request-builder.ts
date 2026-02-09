import { ReasoningRequestSchema, type IncidentSourceType } from "@chronosops/contracts";
import { PROMPT_VERSION } from "./reasoning.prompt";

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

export function buildReasoningRequest(input: {
  incidentId: string;
  evidenceBundleId: string;
  sourceType: IncidentSourceType;
  incidentSummary: string;
  timeline: { start: string; end: string };
  artifacts: Array<{ artifactId: string; kind: string; title: string; summary: string }>;
  candidates: HypothesisId[];
}) {
  return ReasoningRequestSchema.parse({
    kind: "CHRONOSOPS_REASONING_REQUEST_V1",
    incidentId: input.incidentId,
    evidenceBundleId: input.evidenceBundleId,
    promptVersion: PROMPT_VERSION,
    candidates: input.candidates,
    context: {
      incidentSummary: input.incidentSummary,
      sourceType: input.sourceType,
      timeline: input.timeline,
      evidenceArtifacts: input.artifacts.slice(0, 50),
    },
  });
}
