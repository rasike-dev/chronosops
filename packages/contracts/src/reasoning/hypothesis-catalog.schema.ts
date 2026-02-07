import { z } from "zod";

export const HypothesisIdSchema = z.enum([
  "DB_QUERY_REGRESSION",
  "CONFIG_REGRESSION",
  "DEPLOY_BUG",
  "DOWNSTREAM_OUTAGE",
  "CAPACITY_SATURATION",
  "NETWORK_DNS_ISSUE",
  "CACHE_MISS_STORM",
  "RATE_LIMIT_THROTTLING",
  "AUTH_OIDC_ISSUE",
  "UNKNOWN",
]);

export type HypothesisId = z.infer<typeof HypothesisIdSchema>;

export const HypothesisCatalogItemSchema = z.object({
  id: HypothesisIdSchema,
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(800),

  // Deterministic "signals" that make it plausible
  triggers: z.array(z.string().min(1).max(120)).max(30).default([]),

  // Evidence kinds that strengthen/weakens this hypothesis
  requires: z.array(z.enum(["METRICS", "LOGS", "TRACES", "DEPLOYS", "CONFIG", "GOOGLE_STATUS"])).max(10).default([]),
});

export const HypothesisCatalogSchema = z.array(HypothesisCatalogItemSchema).max(50);

export type HypothesisCatalogItem = z.infer<typeof HypothesisCatalogItemSchema>;
