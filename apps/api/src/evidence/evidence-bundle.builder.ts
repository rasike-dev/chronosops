import { EvidenceBundleSchema, EvidenceArtifactRefSchema } from "@chronosops/contracts";
import { hashObjectV1 } from "./hash";
import type { CollectorResult } from "../collectors/collector.types";

export function buildEvidenceBundle(input: {
  incidentId: string;
  createdBy?: string | null;
  // pass whatever you already have at analyze time:
  googleEvidenceLite?: any | null;
  scenarioTelemetrySummary?: any | null; // optional
  collectorArtifacts?: CollectorResult[]; // artifacts from collectors
}) {
  const createdAt = new Date().toISOString();

  const sources: string[] = [];
  if (input.googleEvidenceLite) sources.push("GOOGLE_CLOUD");
  if (input.scenarioTelemetrySummary) sources.push("SCENARIO");
  
  // Add sources from collector artifacts
  const collectorArtifacts = input.collectorArtifacts || [];
  collectorArtifacts.forEach(artifact => {
    if (!sources.includes(artifact.sourceTag)) {
      sources.push(artifact.sourceTag);
    }
  });

  // Build artifacts array
  const artifacts = [
    ...(input.scenarioTelemetrySummary
      ? [{
          kind: "telemetry_summary",
          artifactId: "telemetry_summary:v1",
          title: "Telemetry summary",
          summary: "Normalized scenario telemetry summary used for analysis.",
          payload: input.scenarioTelemetrySummary,
        }]
      : []),
    ...collectorArtifacts.map(artifact => ({
      kind: artifact.kind,
      artifactId: artifact.artifactId,
      title: artifact.title,
      summary: artifact.summary,
      payload: artifact.payload,
    })),
  ].map(a => EvidenceArtifactRefSchema.parse(a));

  const payload = {
    incidentId: input.incidentId,
    createdAt,
    createdBy: input.createdBy ?? null,
    sources,
    googleEvidenceLite: input.googleEvidenceLite ?? null,
    artifacts,
    hashAlgo: "sha256" as const,
    hashInputVersion: "v1" as const,
  };

  // hash excludes bundleId itself
  const bundleId = hashObjectV1(payload);

  const bundle = EvidenceBundleSchema.parse({
    bundleId,
    ...payload,
  });

  return bundle;
}
