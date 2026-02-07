import { GoogleEvidenceLiteSchema } from "@chronosops/contracts";

function uniq(xs: string[]) {
  return Array.from(new Set(xs.map((s) => s.trim()).filter(Boolean)));
}

export function buildGoogleEvidenceLite(input: {
  sourceRef: string;
  url?: string | null;
  service?: string | null;
  region?: string | null;
  status: "investigating" | "identified" | "monitoring" | "resolved" | "unknown";
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  begin?: string | null;
  update?: string | null;
  end?: string | null;
  headline: string;
  summary?: string | null;
}) {
  const hints: string[] = [];

  // Deterministic hints only (simple rules)
  if (input.status !== "resolved") hints.push("incident_ongoing");
  if (input.severity === "critical" || input.severity === "high") hints.push("high_severity");
  if (input.service) hints.push(`service:${input.service}`);
  if (input.region) hints.push(`region:${input.region}`);

  const evidence = {
    kind: "GOOGLE_EVIDENCE_LITE" as const,
    sourceRef: input.sourceRef,
    url: input.url ?? null,
    service: input.service ?? null,
    region: input.region ?? null,
    status: input.status,
    severity: input.severity,
    timeline: {
      begin: input.begin ?? null,
      update: input.update ?? null,
      end: input.end ?? null,
    },
    headline: input.headline,
    summary: input.summary?.trim() || input.headline,
    hypothesisHints: uniq(hints),
  };

  return GoogleEvidenceLiteSchema.parse(evidence);
}
