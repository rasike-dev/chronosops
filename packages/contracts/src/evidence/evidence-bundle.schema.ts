import { z } from "zod";
import { GoogleEvidenceLiteSchema } from "./google-evidence-lite.schema";

export const EvidenceArtifactRefSchema = z.object({
  kind: z.string().min(1).max(64),          // e.g. "google_evidence_lite", "telemetry_summary"
  artifactId: z.string().min(1).max(128),   // stable ID within bundle
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4000),
  payload: z.unknown(),                     // normalized, not raw firehose
});

export const EvidenceBundleSchema = z.object({
  bundleId: z.string().min(16),             // we'll use sha256 hex
  incidentId: z.string().min(1),

  createdAt: z.string(),                    // ISO
  createdBy: z.string().optional().nullable(),

  sources: z.array(z.enum(["SCENARIO", "GOOGLE_CLOUD", "GCP_METRICS", "GCP_LOGS", "GCP_TRACES", "DEPLOYS", "CONFIG"])).default([]),

  // Raw normalized evidence objects (limited)
  googleEvidenceLite: GoogleEvidenceLiteSchema.optional().nullable(),

  // General artifacts list (extensible)
  artifacts: z.array(EvidenceArtifactRefSchema).default([]),

  // Integrity
  hashAlgo: z.literal("sha256"),
  hashInputVersion: z.literal("v1"),
});

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type EvidenceArtifactRef = z.infer<typeof EvidenceArtifactRefSchema>;
